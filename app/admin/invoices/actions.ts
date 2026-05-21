'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { audit } from '@/lib/audit'
import { notify } from '@/lib/notifications'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')
  return session
}

// ─── Invoice number sequence ─────────────────────────────────────────────
// Format: INV-YYYY-NNNN — sequential per year. Looks human-readable on a bill.
async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `INV-${year}-`
  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  })
  const lastSeq = latest?.invoiceNumber?.slice(prefix.length) ?? '0000'
  const next = String(parseInt(lastSeq, 10) + 1).padStart(4, '0')
  return `${prefix}${next}`
}

// ─── Tariff lookup ───────────────────────────────────────────────────────
// Finds the most-recent effective tariff for (companyId, zone) at or before the
// given date. Falls back to amount = 0 if no tariff exists — admin can still
// edit the invoice line items by hand if they want a custom rate.
async function tariffFor(companyId: string, zone: string | null | undefined, at: Date): Promise<number> {
  if (!zone) return 0
  const t = await prisma.tariff.findFirst({
    where: { companyId, zone, effective: { lte: at } },
    orderBy: { effective: 'desc' },
    select: { amount: true },
  })
  return t?.amount ?? 0
}

export type GenerateInvoiceArgs = {
  companyId: string
  periodStart?: string  // ISO date — inclusive
  periodEnd?: string    // ISO date — inclusive
  taxRate?: number      // e.g. 0.18 for 18% VAT. Default 0.
  dueDays?: number      // days from today until invoice is due. Default 14.
}

export type GenerateInvoiceResult =
  | { ok: true;  invoiceId: string; invoiceNumber: string; lineCount: number; total: number }
  | { ok: false; reason: string }

/**
 * Generate a new invoice for `companyId` covering every DELIVERED parcel for that
 * company in the given period that hasn't already been billed. Line items are
 * priced from the company's tariff-per-zone at delivery time.
 */
export async function generateInvoiceForCompany(args: GenerateInvoiceArgs): Promise<GenerateInvoiceResult> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null

  const company = await prisma.company.findUnique({ where: { id: args.companyId }, select: { id: true, name: true } })
  if (!company) return { ok: false, reason: 'Company not found' }

  const periodStart = args.periodStart ? new Date(args.periodStart) : null
  const periodEnd   = args.periodEnd   ? new Date(args.periodEnd)   : null
  // Snap periodEnd to end-of-day so the user-supplied date is inclusive.
  if (periodEnd) periodEnd.setUTCHours(23, 59, 59, 999)

  const taxRate = args.taxRate ?? 0
  const dueDays = args.dueDays ?? 14

  // Find delivered parcels for this company in the window that aren't already on
  // any invoice. The "no existing line item" filter prevents double-billing.
  const candidates = await prisma.delivery.findMany({
    where: {
      companyId: company.id,
      status: 'DELIVERED',
      ...(periodStart || periodEnd ? {
        deliveredAt: {
          ...(periodStart ? { gte: periodStart } : {}),
          ...(periodEnd   ? { lte: periodEnd }   : {}),
        },
      } : {}),
      invoiceLineItems: { none: {} },
    },
    select: {
      id: true,
      trackingNumber: true,
      zone: true,
      packageType: true,
      deliveredAt: true,
    },
    orderBy: { deliveredAt: 'asc' },
  })

  if (candidates.length === 0) {
    return { ok: false, reason: 'No uninvoiced delivered parcels found in this period' }
  }

  // Compute prices using each parcel's deliveredAt for tariff selection.
  type LineDraft = { deliveryId: string; description: string; unitPrice: number }
  const lines: LineDraft[] = []
  for (const d of candidates) {
    const at = d.deliveredAt ?? new Date()
    const price = await tariffFor(company.id, d.zone, at)
    const desc  = `${d.trackingNumber} — ${d.zone ?? 'unknown zone'} / ${d.packageType ?? 'pkg'}`
    lines.push({ deliveryId: d.id, description: desc, unitPrice: price })
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice, 0)
  const tax      = +(subtotal * taxRate).toFixed(2)
  const total    = +(subtotal + tax).toFixed(2)

  const invoiceNumber = await nextInvoiceNumber()
  const now = new Date()
  const dueAt = new Date(now); dueAt.setDate(now.getDate() + dueDays)

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      companyId: company.id,
      periodStart,
      periodEnd,
      status: 'ISSUED',
      subtotal: +subtotal.toFixed(2),
      taxRate,
      tax,
      total,
      issuedAt: now,
      dueAt,
      items: {
        create: lines.map((l) => ({
          deliveryId: l.deliveryId,
          description: l.description,
          quantity: 1,
          unitPrice: +l.unitPrice.toFixed(2),
          amount: +l.unitPrice.toFixed(2),
        })),
      },
    },
  })

  await audit({
    actorId,
    action: 'CREATE',
    entity: 'Invoice',
    entityId: invoice.id,
    after: { invoiceNumber, companyId: company.id, total, lineCount: lines.length },
    note: `Invoice ${invoiceNumber} issued to ${company.name} — ${lines.length} parcels, total ${total.toFixed(2)}`,
  })

  // Notify the company's active users so they see a new invoice landed.
  const companyUsers = await prisma.user.findMany({
    where: { companyId: company.id, active: true },
    select: { id: true },
  })
  for (const u of companyUsers) {
    await notify(
      u.id,
      `New invoice ${invoiceNumber}`,
      `An invoice for ${lines.length} parcels has been issued. Total ${total.toFixed(2)}. Due ${dueAt.toISOString().slice(0, 10)}.`,
      'INFO',
      `/company/invoices/${invoice.id}`,
    )
  }

  revalidatePath('/admin/invoices')
  revalidatePath('/company/invoices')
  return { ok: true, invoiceId: invoice.id, invoiceNumber, lineCount: lines.length, total }
}

export async function markInvoicePaid(invoiceId: string): Promise<{ ok: boolean; reason?: string }> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null

  const before = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { status: true, invoiceNumber: true, companyId: true } })
  if (!before) return { ok: false, reason: 'Invoice not found' }
  if (before.status === 'PAID')      return { ok: false, reason: 'Already paid' }
  if (before.status === 'CANCELLED') return { ok: false, reason: 'Cancelled — cannot mark paid' }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'PAID', paidAt: new Date() },
  })
  await audit({
    actorId, action: 'STATUS_CHANGE', entity: 'Invoice', entityId: invoiceId,
    before: { status: before.status }, after: { status: 'PAID' },
    note: `Invoice ${before.invoiceNumber} marked PAID`,
  })

  const companyUsers = await prisma.user.findMany({
    where: { companyId: before.companyId, active: true },
    select: { id: true },
  })
  for (const u of companyUsers) {
    await notify(
      u.id,
      `Invoice ${before.invoiceNumber} marked paid`,
      `Thank you — your payment has been recorded.`,
      'SUCCESS',
      `/company/invoices/${invoiceId}`,
    )
  }

  revalidatePath('/admin/invoices')
  revalidatePath(`/admin/invoices/${invoiceId}`)
  revalidatePath('/company/invoices')
  revalidatePath(`/company/invoices/${invoiceId}`)
  return { ok: true }
}

export async function cancelInvoice(invoiceId: string, reason: string): Promise<{ ok: boolean; reason?: string }> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null

  if (!reason.trim()) return { ok: false, reason: 'A cancellation reason is required' }

  const before = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { status: true, invoiceNumber: true, companyId: true } })
  if (!before) return { ok: false, reason: 'Invoice not found' }
  if (before.status === 'PAID')      return { ok: false, reason: 'Cannot cancel a paid invoice' }
  if (before.status === 'CANCELLED') return { ok: false, reason: 'Already cancelled' }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), notes: reason },
  })
  await audit({
    actorId, action: 'STATUS_CHANGE', entity: 'Invoice', entityId: invoiceId,
    before: { status: before.status }, after: { status: 'CANCELLED', cancelledReason: reason },
    note: `Invoice ${before.invoiceNumber} cancelled — ${reason}`,
  })

  revalidatePath('/admin/invoices')
  revalidatePath(`/admin/invoices/${invoiceId}`)
  revalidatePath('/company/invoices')
  return { ok: true }
}
