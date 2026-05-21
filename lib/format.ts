/**
 * Format a monetary amount with thousands separators and exactly 2 decimals.
 *
 *   money(37877)     => '$37,877.00'
 *   money(45.5)      => '$45.50'
 *   money(null)      => '—'
 *   money(0)         => '$0.00'
 *
 * Single source of truth so every page/list/card/PDF reads consistently.
 */
export function money(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
