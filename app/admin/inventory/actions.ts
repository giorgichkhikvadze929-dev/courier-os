'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { audit } from '@/lib/audit'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')
  return session
}

function readForm(formData: FormData) {
  const name     = (formData.get('name') as string).trim()
  const sku      = (formData.get('sku') as string | null)?.trim() || null
  const qtyRaw   = (formData.get('quantity') as string | null)?.trim()
  const quantity = qtyRaw ? Math.max(0, Math.floor(Number(qtyRaw))) : 0
  const location = (formData.get('location') as string | null)?.trim() || null
  const notes    = (formData.get('notes') as string | null)?.trim() || null
  return { name, sku, quantity: Number.isFinite(quantity) ? quantity : 0, location, notes }
}

export async function createInventoryItem(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const data = readForm(formData)
  const created = await prisma.inventoryItem.create({
    data: { ...data, createdById: actorId },
  })
  await audit({
    actorId,
    action: 'CREATE',
    entity: 'InventoryItem',
    entityId: created.id,
    after: data,
    note: `Created inventory item "${data.name}"`,
  })
  revalidatePath('/admin/inventory')
  redirect(`/admin/inventory/${created.id}`)
}

export async function updateInventoryItem(id: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const before = await prisma.inventoryItem.findUnique({ where: { id } })
  if (!before) return
  const data = readForm(formData)
  const after = await prisma.inventoryItem.update({ where: { id }, data })

  // Build a precise diff so the history reads cleanly: "qty 12 → 25, location 'A1' → 'B3'"
  const diff: Record<string, { from: unknown; to: unknown }> = {}
  for (const k of ['name', 'sku', 'quantity', 'location', 'notes'] as const) {
    if (before[k] !== after[k]) diff[k] = { from: before[k], to: after[k] }
  }

  await audit({
    actorId,
    action: 'UPDATE',
    entity: 'InventoryItem',
    entityId: id,
    before: { name: before.name, sku: before.sku, quantity: before.quantity, location: before.location, notes: before.notes },
    after:  { name: after.name,  sku: after.sku,  quantity: after.quantity,  location: after.location,  notes: after.notes  },
    note: Object.keys(diff).length > 0
      ? Object.entries(diff).map(([k, v]) => `${k}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}`).join('; ')
      : 'No fields changed',
  })

  revalidatePath('/admin/inventory')
  revalidatePath(`/admin/inventory/${id}`)
  redirect(`/admin/inventory/${id}`)
}

/** Quick stock adjustment (delta against current quantity). */
export async function adjustQuantity(id: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const before = await prisma.inventoryItem.findUnique({ where: { id } })
  if (!before) return
  const deltaRaw = (formData.get('delta') as string | null)?.trim()
  const delta = Math.floor(Number(deltaRaw))
  if (!Number.isFinite(delta) || delta === 0) return
  const note = (formData.get('note') as string | null)?.trim() || null

  const newQty = Math.max(0, before.quantity + delta)
  const after = await prisma.inventoryItem.update({ where: { id }, data: { quantity: newQty } })

  await audit({
    actorId,
    action: 'UPDATE',
    entity: 'InventoryItem',
    entityId: id,
    before: { quantity: before.quantity },
    after:  { quantity: after.quantity },
    note: note
      ? `Stock ${delta > 0 ? '+' : ''}${delta} (${before.quantity} → ${after.quantity}) — ${note}`
      : `Stock ${delta > 0 ? '+' : ''}${delta} (${before.quantity} → ${after.quantity})`,
  })

  revalidatePath('/admin/inventory')
  revalidatePath(`/admin/inventory/${id}`)
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const before = await prisma.inventoryItem.findUnique({ where: { id } })
  if (!before) return
  await prisma.inventoryItem.delete({ where: { id } })
  await audit({
    actorId,
    action: 'DELETE',
    entity: 'InventoryItem',
    entityId: id,
    before: { name: before.name, sku: before.sku, quantity: before.quantity, location: before.location, notes: before.notes },
    note: `Deleted inventory item "${before.name}"`,
  })
  revalidatePath('/admin/inventory')
  redirect('/admin/inventory')
}
