'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { audit } from '@/lib/audit'
import { parseRows, type CanonicalRow } from '@/lib/import'
import { notify } from '@/lib/notifications'
import { generateTrackingNumber } from '@/lib/tracking'
import { createOrderForBatch } from '@/lib/order'

async function requireCompany() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user?.role as string
  if (!['COMPANY', 'ADMIN'].includes(role)) redirect('/login')
  return session
}

export type CompanyUploadOutcome = {
  batchId: string
  totalRows: number
  validRows: number
  errorRows: number
  duplicateRows: number
  // How many parcels actually landed in the verify queue (status = RECEIVED).
  // Should equal validRows minus in-DB duplicates, on a clean run.
  createdDeliveries: number
  duplicatesInDb: number
}

/**
 * Company asks the admin for permission to upload Excel batches.
 * Sets `uploadRequestedAt` on the company. Admins are notified.
 * Idempotent — multiple calls just refresh the timestamp.
 */
export async function requestUploadAccess(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await requireCompany()
  const userId = (session.user as { id?: string }).id ?? null
  const companyId = (session.user as { companyId?: string | null }).companyId ?? null

  if (!companyId) return { ok: false, reason: 'No company linked to your account' }

  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) return { ok: false, reason: 'Company not found' }
  if (company.uploadEnabled) return { ok: false, reason: 'Upload access is already enabled' }

  await prisma.company.update({
    where: { id: companyId },
    data: { uploadRequestedAt: new Date() },
  })

  await audit({
    actorId: userId,
    action: 'UPDATE',
    entity: 'Company',
    entityId: companyId,
    note: 'Company requested Excel-upload access',
  })

  // Notify all active admins
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } })
  for (const a of admins) {
    await notify(
      a.id,
      'Upload access request',
      `${company.name} is requesting permission to upload Excel batches.`,
      'INFO',
      `/admin/companies/${companyId}`,
    )
  }

  revalidatePath('/company/import')
  revalidatePath('/admin/companies')
  return { ok: true }
}

/**
 * Stages an Excel/CSV upload from a company.
 * Stores the (parsed-and-validated) rows in an ImportBatch DRAFT record
 * for the admin to review and commit on /admin/import.
 *
 * REJECTS the request if the company's upload access has not been enabled by an admin.
 */
export async function uploadBatch(rowsJson: string, filename: string | null): Promise<CompanyUploadOutcome> {
  try {
    const session = await requireCompany()
    const userId = (session.user as { id?: string }).id ?? null
    const companyId = (session.user as { companyId?: string | null }).companyId ?? null

    // Gate: company must be approved to upload.
    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { uploadEnabled: true, name: true },
      })
      if (!company?.uploadEnabled) {
        throw new Error('Upload access has not been approved by an admin yet.')
      }
    }

    const rawRows = JSON.parse(rowsJson) as Record<string, unknown>[]
    const parsed = parseRows(rawRows)

    const errors = parsed.rows
      .filter((r) => r.errors.length > 0)
      .map((r) => ({ rowNumber: r.rowNumber, reason: r.errors.join('; ') }))

    // Hard gate: if ANY row in this chunk is missing required fields, refuse
    // the whole chunk. The company must fix it before sending. Partial uploads
    // are not allowed per product policy.
    if (errors.length > 0) {
      const firstFew = errors.slice(0, 3).map((e) => `row ${e.rowNumber}: ${e.reason}`).join(' | ')
      throw new Error(
        `Upload refused — ${errors.length} row${errors.length === 1 ? '' : 's'} missing required fields. ${firstFew}${errors.length > 3 ? ` …+${errors.length - 3} more` : ''}`,
      )
    }

    // ── Create real Delivery rows (status RECEIVED → verify queue) ──────────
    // Optimized for large uploads: build the full insert array, then run TWO bulk
    // SQL writes (createMany for Delivery, createMany for DeliveryHistory) instead
    // of N×2 round-trips. For 5,000 rows this drops from ~10,000 SQL round-trips
    // to ~3 — orders of magnitude faster on SQLite.

    // De-dup against active deliveries currently in the system.
    const existing = await prisma.delivery.findMany({
      where: { status: { in: ['RECEIVED', 'IN_WAREHOUSE', 'ASSIGNED', 'IN_TRANSIT'] } },
      select: { customerPhone: true, dropoffAddress: true },
    })
    const existingKeys = new Set(
      existing.map((d) => `${d.customerPhone}::${d.dropoffAddress.toLowerCase()}`),
    )

    let duplicatesInDb = 0
    let failed = 0
    const inlineErrors: { rowNumber: number; reason: string }[] = []
    const deliveriesToCreate: {
      trackingNumber: string
      status: string
      priority: string
      customerName: string
      customerPhone: string
      customerEmail: string | null
      dropoffAddress: string
      zone: string | null
      city: string | null
      postalCode: string | null
      packageType: string | null
      weightKg: number | null
      sizeCm: string | null
      codAmount: number | null
      notes: string | null
      companyId: string | null
      orderId: string | null
    }[] = []

    for (const row of parsed.rows) {
      if (row.errors.length > 0) continue
      const d = row.data as Required<Pick<CanonicalRow, 'customerName' | 'customerPhone' | 'dropoffAddress'>> & CanonicalRow
      const key = `${d.customerPhone}::${d.dropoffAddress.toLowerCase()}`
      if (existingKeys.has(key)) {
        duplicatesInDb++
        continue
      }
      deliveriesToCreate.push({
        trackingNumber: generateTrackingNumber(),
        status:         'RECEIVED',
        priority:       d.priority ?? 'NORMAL',
        customerName:   d.customerName,
        customerPhone:  d.customerPhone,
        customerEmail:  d.customerEmail ?? null,
        dropoffAddress: d.dropoffAddress,
        zone:           d.zone ?? null,
        city:           d.city ?? null,
        postalCode:     d.postalCode ?? null,
        packageType:    d.packageType ?? null,
        weightKg:       d.weightKg ?? null,
        sizeCm:         d.sizeCm ?? null,
        codAmount:      d.codAmount ?? null,
        notes:          d.notes ?? null,
        companyId,
        orderId:        null,  // assigned after Order is created below
      })
      existingKeys.add(key)
    }

    let created = 0
    let orderId: string | null = null
    let orderNumber: string | null = null
    if (deliveriesToCreate.length > 0) {
      try {
        // Create the parent Order for this upload first so we can stamp
        // orderId on every Delivery row we insert. Skip Order creation if
        // there's no companyId (ADMINs without a linked company); deliveries
        // still get inserted, just unattached to an Order.
        if (companyId) {
          const totalValue = deliveriesToCreate.reduce((s, d) => s + (d.codAmount ?? 0), 0)
          const order = await createOrderForBatch({
            companyId,
            parcelCount: deliveriesToCreate.length,
            totalValue,
            notes:       filename ? `Imported from ${filename}` : 'Imported by company',
          })
          orderId = order.id
          orderNumber = order.orderNumber
          for (const d of deliveriesToCreate) d.orderId = orderId
        }

        // 1. Bulk-insert deliveries.
        const result = await prisma.delivery.createMany({ data: deliveriesToCreate })
        created = result.count

        // 2. Look up the ids we just inserted so we can attach history rows to them.
        //    trackingNumber is unique so this is a deterministic lookup.
        const trackingNumbers = deliveriesToCreate.map((d) => d.trackingNumber)
        const inserted = await prisma.delivery.findMany({
          where: { trackingNumber: { in: trackingNumbers } },
          select: { id: true },
        })

        // 3. Bulk-insert one history row per delivery.
        if (inserted.length > 0) {
          await prisma.deliveryHistory.createMany({
            data: inserted.map((d) => ({
              deliveryId: d.id,
              status: 'RECEIVED',
              note: 'Imported by company',
              actorId: userId,
            })),
          })
        }
      } catch (err) {
        failed = deliveriesToCreate.length
        created = 0
        inlineErrors.push({
          rowNumber: -1,
          reason: `Bulk insert failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
        // Bulk insert failed — drop the empty Order so it doesn't dangle.
        if (orderId) {
          try { await prisma.order.delete({ where: { id: orderId } }) } catch {}
          orderId = null
          orderNumber = null
        }
      }
    }

    // Record the upload as a COMMITTED batch so it shows up in import history.
    const batch = await prisma.importBatch.create({
      data: {
        companyId,
        uploadedBy: userId,
        filename,
        totalRows: parsed.totalRows,
        importedRows: created,
        errorRows: parsed.errorRows + failed,
        duplicateRows: parsed.duplicateRows + duplicatesInDb,
        errorsJson: errors.length + inlineErrors.length > 0
          ? JSON.stringify([...errors, ...inlineErrors])
          : null,
        status: 'COMMITTED',
      },
    })

    // Link the Order back to its ImportBatch (1-1) for the audit trail.
    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data:  { importBatchId: batch.id },
      })
    }

    await audit({
      actorId: userId,
      action: 'IMPORT',
      entity: 'ImportBatch',
      entityId: batch.id,
      note: `Company import — ${created} deliveries created · ${duplicatesInDb} dup-in-db · ${parsed.errorRows} validation errors · ${failed} failed${orderNumber ? ' · order ' + orderNumber : ''}`,
    })

    // Notify admins so they know there are new parcels in the verify queue.
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } })
    for (const a of admins) {
      await notify(
        a.id,
        'New parcels awaiting verification',
        `A company uploaded ${created} parcels — review them in the verify queue.`,
        'INFO',
        `/admin/verify`,
      )
    }

    revalidatePath('/company/import')
    revalidatePath('/company/orders')
    revalidatePath('/admin/verify')
    revalidatePath('/admin/deliveries')
    revalidatePath('/admin/orders')
    return {
      batchId: batch.id,
      totalRows: parsed.totalRows,
      validRows: parsed.validRows,
      errorRows: parsed.errorRows + failed,
      duplicateRows: parsed.duplicateRows + duplicatesInDb,
      createdDeliveries: created,
      duplicatesInDb,
    }
  } catch (err) {
    // Re-throw as a plain Error string. Without this, Next.js 16 dev overlay can
    // mask the real cause behind a misleading "Maximum array nesting exceeded"
    // when it tries to serialize a complex thrown object for display.
    const msg = err instanceof Error ? err.message : 'uploadBatch failed (unknown error)'
    console.error('[uploadBatch] failed:', msg)
    throw new Error(msg)
  }
}
