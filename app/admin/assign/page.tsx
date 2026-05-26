import { redirect } from 'next/navigation'

/**
 * /admin/assign was folded into /admin/deliveries.
 *
 * The Deliveries page is the single place to triage parcels now:
 *   - status quick-chip = IN_WAREHOUSE
 *   - BulkPanel exposes "Pick courier + Create order" when IN_WAREHOUSE
 *     rows are selected
 *
 * Any link or bookmark to /admin/assign lands on the same view.
 */
export default function AssignRedirect() {
  redirect('/admin/deliveries?status=IN_WAREHOUSE')
}
