import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { ZONES, ZONE_LABEL } from '@/app/components/StatusBadge'
import { updateDeliveryFields } from '../../actions'

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
const PACKAGE_TYPES = ['', 'SMALL', 'MEDIUM', 'LARGE', 'FRAGILE', 'DOCUMENT']

export default async function EditDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { id } = await params
  const d = await prisma.delivery.findUnique({ where: { id } })
  if (!d) notFound()

  return (
    <Shell currentPath="/admin/deliveries">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/deliveries" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← Deliveries</Link>
        <span className="text-[var(--color-text-faint)]">/</span>
        <Link href={`/admin/deliveries/${id}`} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] font-mono">{d.trackingNumber}</Link>
        <span className="text-[var(--color-text-faint)]">/</span>
        <h1 className="text-lg font-bold text-[var(--color-text-strong)]">Edit</h1>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 max-w-2xl">
        <form action={updateDeliveryFields.bind(null, id)} className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">Customer</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Customer Name *</label>
                <input name="customerName" required defaultValue={d.customerName} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Phone *</label>
                <input name="customerPhone" required defaultValue={d.customerPhone} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Email</label>
                <input name="customerEmail" type="email" defaultValue={d.customerEmail ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">Delivery</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Dropoff Address *</label>
                <input name="dropoffAddress" required defaultValue={d.dropoffAddress} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Zone</label>
                  <select name="zone" defaultValue={d.zone ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                    <option value="">—</option>
                    {ZONES.map((z) => <option key={z} value={z}>{ZONE_LABEL[z]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Priority</label>
                  <select name="priority" defaultValue={d.priority} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Package Type</label>
                  <select name="packageType" defaultValue={d.packageType ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                    {PACKAGE_TYPES.map((p) => <option key={p || 'none'} value={p}>{p || '—'}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">COD Amount</label>
                <input name="codAmount" type="number" step="0.01" min="0" defaultValue={d.codAmount ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Notes</label>
                <textarea name="notes" rows={2} defaultValue={d.notes ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
              Save Changes
            </button>
            <Link href={`/admin/deliveries/${id}`} className="flex-1 text-center border border-[var(--color-border-strong)] rounded-xl py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)] transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <p className="text-xs text-[var(--color-text-faint)] mt-4">All field changes are recorded in the audit log.</p>
    </Shell>
  )
}
