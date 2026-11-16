import { db } from '@/lib/db'

export const ADMIN_ACTOR = 'security.admin@acme-corp.test'

export async function logAudit(action: string, actor: string, detail: string) {
  await db.auditLog.create({ data: { action, actor, detail } })
}
