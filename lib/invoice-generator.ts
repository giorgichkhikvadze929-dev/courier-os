import prisma from './prisma'
import { audit } from './audit'
import { notify } from './notifications'

/**
 * Shared invoice generator. Called from:
 *   - admin "Generate invoice" panel (app/admin/invoices/actions.ts)
 *   - automatic monthly cron (app/api/cron/generate-invoices/route.ts)
 *
 * No auth check here — callers gate access. Cron passes actorId=null.
 */

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

async function tariffFor(companyId: string, zone: string | null | undefined, at: Date): Promise<number> {
  if (!zone) return 0
  const t = await prisma.tariff.findFirst({
    where: { companyId, zone, effective: { lte: at } },
    orderBy: { effective: 'desc' },
    select: { amount: true },
  })
  return t?.amount ?? 0
}

export type GenerateInvoiceInput = {
  companyId: string
  periodStart?: Date | null
  periodEnd?: Date | null
  taxRate?: number   // e.g. 0.18 for 18% Georgian VAT
  dueDays?: number   // default 14
  actorId?: string | null
  source?: 'manual' | 'auto'  // marker for audit / notification copy
}

export type GenerateInvoiceOutcome =
  | { ok: true;  invoiceId: string; invoiceNumber: string; lineCount: number; total: number }
  | { ok: false; reason: string }

export async function generateInvoice(input: GenerateInvoiceInput): Promise<GenerateInvoiceOutcome> {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, name: true },
  })
  if (!company) return { ok: false, reason: 'Company not found' }

  const periodStart = input.periodStart ?? null
  const periodEnd   = input.periodEnd ? new Date(input.periodEnd) : null
  if (periodEnd) periodEnd.setUTCHours(23, 59, 59, 999)

  const taxRate = input.taxRate ?? 0
  const dueDays = input.dueDays ?? 14
  const source  = input.source ?? 'manual'

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
    actorId: input.actorId ?? null,
    action: 'CREATE',
    entity: 'Invoice',
    entityId: invoice.id,
    after: { invoiceNumber, companyId: company.id, total, lineCount: lines.length, source },
    note: `Invoice ${invoiceNumber} ${source === 'auto' ? 'auto-issued' : 'issued'} to ${company.name} — ${lines.length} parcels, total ${total.toFixed(2)} ₾`,
  })

  const companyUsers = await prisma.user.findMany({
    where: { companyId: company.id, active: true },
    select: { id: true },
  })
  const dueIso = dueAt.toISOString().slice(0, 10)
  for (const u of companyUsers) {
    await notify(
      u.id,
      `New invoice ${invoiceNumber}`,
      `${source === 'auto' ? 'Automatically issued — ' : ''}${lines.length} parcels, total ${total.toFixed(2)} ₾. Due ${dueIso}.`,
      'INFO',
      `/company/invoices/${invoice.id}`,
    )
  }

  return { ok: true, invoiceId: invoice.id, invoiceNumber, lineCount: lines.length, total }
}
