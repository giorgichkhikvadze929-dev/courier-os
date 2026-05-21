import prisma from './prisma'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'ASSIGN'
  | 'ASSIGN_PICKUP'
  | 'VERIFY'
  | 'TARIFF_CHANGE'
  | 'IMPORT'
  | 'LOGIN'
  | 'IMPERSONATE_START'
  | 'IMPERSONATE_STOP'

export async function audit(opts: {
  actorId?: string | null
  action: AuditAction
  entity: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  note?: string
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId:  opts.actorId ?? null,
        action:   opts.action,
        entity:   opts.entity,
        entityId: opts.entityId ?? null,
        before:   opts.before !== undefined ? JSON.stringify(opts.before) : null,
        after:    opts.after  !== undefined ? JSON.stringify(opts.after)  : null,
        note:     opts.note   ?? null,
      },
    })
  } catch (err) {
    // Audit failures must never break the parent operation
    console.error('[audit] failed to log', err)
  }
}
