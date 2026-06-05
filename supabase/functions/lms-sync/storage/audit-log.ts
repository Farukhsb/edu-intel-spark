export type LmsSyncAuditRecord = {
  provider: string;
  action: string;
  subjectId: string | null;
  createdAt: string;
};
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function recordLmsAuditEvent(
  supabaseAdmin: SupabaseClient,
  payload: {
    institutionId: string;
    provider: string;
    entityType: string;
    entityExternalId: string;
    eventType: string;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await supabaseAdmin.from("lms_audit_log").insert({
    institution_id: payload.institutionId,
    provider: payload.provider,
    entity_type: payload.entityType,
    entity_external_id: payload.entityExternalId,
    event_type: payload.eventType,
    payload: payload.payload ?? {},
  });

  if (error) {
    throw error;
  }
}
