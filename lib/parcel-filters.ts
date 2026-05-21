/**
 * Shared filter builder used by /company/parcels (page), /company/export (xlsx)
 * and /company/export/pdf so what the user sees on screen is exactly what comes
 * out of the export — single source of truth, no drift between page + download.
 */

export type ParcelFilterParams = {
  q?: string
  status?: string
  from?: string
  to?: string
}

export function buildParcelWhere(companyId: string | null | undefined, p: ParcelFilterParams) {
  const fromDate = p.from ? new Date(p.from) : undefined
  const toDate = p.to ? new Date(`${p.to}T23:59:59.999`) : undefined

  return {
    ...(companyId ? { companyId } : {}),
    ...(p.status ? { status: p.status } : {}),
    ...(fromDate || toDate ? {
      createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate   ? { lte: toDate }   : {}),
      },
    } : {}),
    ...(p.q ? {
      OR: [
        { trackingNumber: { contains: p.q } },
        { customerName:   { contains: p.q } },
        { customerPhone:  { contains: p.q } },
      ],
    } : {}),
  }
}

export function parcelFiltersFromUrl(url: URL): ParcelFilterParams {
  return {
    q:      url.searchParams.get('q')      ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    from:   url.searchParams.get('from')   ?? undefined,
    to:     url.searchParams.get('to')     ?? undefined,
  }
}
