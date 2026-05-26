import { redirect } from 'next/navigation'

/**
 * /admin/denied was folded into /admin/deliveries.
 *
 * The Deliveries page Completed tab now has a REFUSED quick-chip that
 * shows the same list. Any link or bookmark lands here and forwards.
 */
export default function DeniedRedirect() {
  redirect('/admin/deliveries?view=completed&status=REFUSED')
}
