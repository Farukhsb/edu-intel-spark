import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LmsSyncMode, LmsSyncSummary } from "../../lms/types.ts";
import type { LmsProviderId } from "../types.ts";

export type LmsSyncRun = {
  id: string;
  provider: LmsProviderId;
  syncMode: LmsSyncMode;
  institutionId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  summary: LmsSyncSummary;
  warnings: string[];
  errorMessage: string | null;
};

export async function createLmsSyncRun(
  supabaseAdmin: SupabaseClient,
  run: Omit<LmsSyncRun, "id" | "completedAt">,
) {
  const id = crypto.randomUUID();
  const { error } = await supabaseAdmin.from("lms_sync_runs").insert({
    id,
    provider: run.provider,
    institution_id: run.institutionId,
    sync_mode: run.syncMode,
    status: run.status,
    started_at: run.startedAt,
    completed_at: null,
    summary: run.summary,
    warnings: run.warnings,
    error_message: run.errorMessage,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  return id;
}

export async function finishLmsSyncRun(
  supabaseAdmin: SupabaseClient,
  runId: string,
  updates: Partial<Pick<LmsSyncRun, "status" | "summary" | "warnings" | "errorMessage">> & { completedAt?: string },
) {
  const { error } = await supabaseAdmin
    .from("lms_sync_runs")
    .update({
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.summary ? { summary: updates.summary } : {}),
      ...(updates.warnings ? { warnings: updates.warnings } : {}),
      ...(updates.errorMessage !== undefined ? { error_message: updates.errorMessage } : {}),
      ...(updates.completedAt ? { completed_at: updates.completedAt } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
}
