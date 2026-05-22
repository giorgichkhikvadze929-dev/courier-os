import { NextResponse, type NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { generateInvoice } from '@/lib/invoice-generator'

/**
 * Automatic invoice generator — PRD §7 "ინვოისის ავტომატური გენერაცია".
 *
 * Vercel Cron hits this daily (see vercel.json). Each call:
 *   - finds every active company whose billing cycle is due today
 *   - generates an invoice covering the previous billing period
 *   - stamps `lastAutoInvoiceAt` so re-runs the same day are no-ops
 *
 * Cycles:
 *   MONTHLY — fires on `billingAnchorDay` (1-28), bills previous calendar month.
 *   WEEKLY  — fires on `billingAnchorDay` weekday (0=Sun … 6=Sat), bills previous 7 days.
 *   OFF     — never fires automatically; admin generates manually.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * when CRON_SECRET is set as an env var (Vercel docs). Reject anything else so
 * the endpoint can't be invoked from the public internet.
 */

const TAX_RATE = 0.18  // 18% Georgian VAT
const DUE_DAYS = 14

type CycleResult =
  | { kind: 'skip'; reason: string }
  | { kind: 'due'; periodStart: Date; periodEnd: Date }

function computeDue(
  cycle: string,
  anchorDay: number,
  now: Date,
  lastAuto: Date | null,
): CycleResult {
  if (cycle === 'OFF') return { kind: 'skip', reason: 'cycle OFF' }

  if (cycle === 'MONTHLY') {
    const day = now.getUTCDate()
    if (day !== anchorDay) return { kind: 'skip', reason: `today ${day} != anchor ${anchorDay}` }

    // Bill the previous calendar month [first day 00:00, last day 23:59:59.999].
    const year  = now.getUTCFullYear()
    const month = now.getUTCMonth()  // 0-based, current month
    const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
    const periodEnd   = new Date(Date.UTC(year, month,     0, 23, 59, 59, 999))  // last day of prev month

    // Idempotency: if we already auto-issued in the last 25 days, skip.
    // (Re-run same day after a hotfix deploy must not double-bill.)
    if (lastAuto && (now.getTime() - lastAuto.getTime()) < 25 * 24 * 3600 * 1000) {
      return { kind: 'skip', reason: 'already auto-invoiced this period' }
    }
    return { kind: 'due', periodStart, periodEnd }
  }

  if (cycle === 'WEEKLY') {
    const dow = now.getUTCDay()  // 0=Sun … 6=Sat
    if (dow !== anchorDay) return { kind: 'skip', reason: `today dow ${dow} != anchor ${anchorDay}` }

    // Bill the previous 7 days ending yesterday end-of-day.
    const periodEnd = new Date(now); periodEnd.setUTCHours(0, 0, 0, 0)
    periodEnd.setUTCMilliseconds(-1)  // yesterday 23:59:59.999
    const periodStart = new Date(periodEnd); periodStart.setUTCDate(periodEnd.getUTCDate() - 6); periodStart.setUTCHours(0, 0, 0, 0)

    if (lastAuto && (now.getTime() - lastAuto.getTime()) < 6 * 24 * 3600 * 1000) {
      return { kind: 'skip', reason: 'already auto-invoiced this week' }
    }
    return { kind: 'due', periodStart, periodEnd }
  }

  return { kind: 'skip', reason: `unknown cycle ${cycle}` }
}

export async function GET(req: NextRequest) {
  // Auth: accept Vercel Cron's bearer or an explicit secret header for manual triggers.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
  }

  const now = new Date()
  const companies = await prisma.company.findMany({
    where: { active: true },
    select: { id: true, name: true, billingCycle: true, billingAnchorDay: true, lastAutoInvoiceAt: true },
  })

  const log: Array<{ company: string; status: string; detail?: string }> = []
  let issued = 0

  for (const c of companies) {
    const due = computeDue(c.billingCycle, c.billingAnchorDay, now, c.lastAutoInvoiceAt)
    if (due.kind === 'skip') {
      log.push({ company: c.name, status: 'skip', detail: due.reason })
      continue
    }

    const result = await generateInvoice({
      companyId:   c.id,
      periodStart: due.periodStart,
      periodEnd:   due.periodEnd,
      taxRate:     TAX_RATE,
      dueDays:     DUE_DAYS,
      actorId:     null,
      source:      'auto',
    })

    if (result.ok) {
      await prisma.company.update({
        where: { id: c.id },
        data:  { lastAutoInvoiceAt: now },
      })
      issued += 1
      log.push({ company: c.name, status: 'issued', detail: `${result.invoiceNumber} — ${result.lineCount} parcels, ${result.total.toFixed(2)} ₾` })
    } else {
      // No-parcels-in-period is normal — still stamp lastAutoInvoiceAt so we don't retry every cron tick this period.
      if (result.reason.includes('No uninvoiced')) {
        await prisma.company.update({
          where: { id: c.id },
          data:  { lastAutoInvoiceAt: now },
        })
      }
      log.push({ company: c.name, status: 'no-op', detail: result.reason })
    }
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    companies: companies.length,
    issued,
    log,
  })
}
