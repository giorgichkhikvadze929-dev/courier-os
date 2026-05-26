import { redirect } from 'next/navigation'

/**
 * /admin/verify was folded into /admin/deliveries.
 *
 * The Deliveries page now hosts the verify workflow:
 *   - status quick-chip = RECEIVED
 *   - BulkPanel exposes Verify + Deny actions when RECEIVED rows are selected
 *
 * Any link or bookmark to /admin/verify lands on the same view.
 */
export default function VerifyRedirect() {
  redirect('/admin/deliveries?status=RECEIVED')
}
