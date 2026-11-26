import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Append-only audit trail for sensitive administrative changes
 * (school suspend/reactivate, approvals, curriculum edits, user status…).
 * Never include student chat content or personal data in `details`.
 */
export async function audit(entry: {
  actorId?: string | null
  schoolId?: string | null
  action: string
  entity?: string
  entityId?: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      actor_id: entry.actorId ?? null,
      school_id: entry.schoolId ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? {}
    })
  } catch (err) {
    console.error('audit_write_failed', err)
  }
}
