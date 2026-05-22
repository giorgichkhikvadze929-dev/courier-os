'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { audit } from '@/lib/audit'
import { notify } from '@/lib/notifications'
import { generateInvoice } from '@/lib/invoice-generator'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')
  return session
}

export type GenerateInvoiceArgs = {
  companyId: string
  periodStart?: string  // ISO date — inclusive
  periodEnd?: string    // ISO date — inclusive
  taxRate?: number      // e.g. 0.18 for 18% VAT. Default 0.
  dueDays?: number      // default 14
}

export type GenerateInvoiceResult =
  | { ok: true;  invoiceId: string; invoiceNumber: string; lineCount: number; total: number }
  | { ok: false; reason: string }

export async function generateInvoiceForCompany(args: GenerateInvoiceArgs): Promise<GenerateInvoiceResult> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null

  const result = await generateInvoice({
    companyId:   args.companyId,
    periodStart: args.periodStart ? new Date(args.periodStart) : null,
    periodEnd:   args.periodEnd   ? new Date(args.periodEnd)   : null,
    taxRate:     args.taxRate,
    dueDays:     args.dueDays,
    actorId,
    source:      'manual',
  })

  if (result.ok) {
    revalidatePath('/admin/invoices')
    revalidatePath('/company/invoices')
  }
  return result
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
