export type LmsSyncCursorRecord = {
  provider: string;
  courseId: string;
  cursor: string;
  updatedAt: string;
};
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function upsertLmsSyncCursor(
  supabaseAdmin: SupabaseClient,
  payload: {
    institutionId: string;
    provider: string;
    scopeKey: string;
    cursorState: Record<string, unknown>;
  },
) {
  const { error } = await supabaseAdmin.from("lms_sync_cursors").upsert({
    institution_id: payload.institutionId,
    provider: payload.provider,
    scope_key: payload.scopeKey,
    cursor_state: payload.cursorState,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}
