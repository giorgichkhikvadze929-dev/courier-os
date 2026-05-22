/**
 * Format a monetary amount with thousands separators and exactly 2 decimals,
 * suffixed with the Georgian Lari symbol (₾).
 *
 *   money(37877)     => '37,877.00 ₾'
 *   money(45.5)      => '45.50 ₾'
 *   money(null)      => '—'
 *   money(0)         => '0.00 ₾'
 *
 * Single source of truth so every page/list/card/PDF reads consistently in GEL.
 */
export const CURRENCY_SYMBOL = '₾'

export function money(amount: number | null | undefined): string {
  if (amount == null) return '—'
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${formatted} ${CURRENCY_SYMBOL}`
}
