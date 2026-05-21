import prisma from './prisma'

/**
 * Resolve the active tariff for (companyId, zone) — the most recent effective row
 * whose `effective` date is at or before `at` (default = now).
 */
export async function resolveTariff(
  companyId: string | null | undefined,
  zone: string | null | undefined,
  at: Date = new Date(),
): Promise<{ amount: number; effective: Date } | null> {
  if (!companyId || !zone) return null
  const t = await prisma.tariff.findFirst({
    where: { companyId, zone, effective: { lte: at } },
    orderBy: { effective: 'desc' },
    select: { amount: true, effective: true },
  })
  return t
}

export async function tariffMatrix(companyId: string): Promise<Record<string, number>> {
  const all = await prisma.tariff.findMany({
    where: { companyId },
    orderBy: { effective: 'desc' },
  })
  const out: Record<string, number> = {}
  for (const t of all) {
    if (out[t.zone] === undefined) out[t.zone] = t.amount
  }
  return out
}
