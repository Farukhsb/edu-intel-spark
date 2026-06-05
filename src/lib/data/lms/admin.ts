import { supabase } from "@/integrations/supabase/client";
import type { LmsProviderId, LmsSyncMode } from "@/lib/lms";
import { normalizeLmsBaseUrl } from "@/lib/lms";

export type AdminLmsConnectionRow = {
  id: string;
  institution_id: string;
  provider: LmsProviderId;
  base_url: string;
  access_token_secret_name: string | null;
  enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AdminLmsSyncRunRow = {
  id: string;
  institution_id: string;
  provider: LmsProviderId;
  sync_mode: LmsSyncMode;
  course_external_id: string | null;
  assignment_external_id: string | null;
  status: "queued" | "running" | "succeeded" | "failed";
  summary: {
    coursesSynced: number;
    assignmentsSynced: number;
    submissionsSynced: number;
    gradesSynced: number;
    eventsSynced: number;
  };
  warnings: string[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminLmsSyncResponse = {
  success: boolean;
  provider: LmsProviderId;
  syncMode: LmsSyncMode;
  message: string;
  summary: {
    coursesSynced: number;
    assignmentsSynced: number;
    submissionsSynced: number;
    gradesSynced: number;
    eventsSynced: number;
  };
  warnings: string[];
};

export type AdminLmsConnectionInput = {
  institutionId: string;
  provider: LmsProviderId;
  baseUrl: string;
  enabled: boolean;
  accessTokenSecretName: string | null;
  metadata: Record<string, unknown>;
};

const lmsSupabase = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string) => any;
    upsert: (value: Record<string, unknown>, options?: { onConflict?: string }) => any;
    delete: () => any;
    eq: (column: string, value: unknown) => any;
    order: (column: string, options?: { ascending?: boolean }) => any;
    limit: (count: number) => any;
    maybeSingle: () => Promise<{ data: AdminLmsConnectionRow | null; error: Error | null }>;
    single: () => Promise<{ data: AdminLmsConnectionRow; error: Error | null }>;
  };
  functions: {
    invoke: (name: string, options?: { body?: unknown }) => Promise<{ data: unknown; error: Error | null }>;
  };
};

const BASE_RUN_FIELDS =
  "id, institution_id, provider, sync_mode, course_external_id, assignment_external_id, status, summary, warnings, error_message, started_at, completed_at, created_at, updated_at";
const BASE_CONNECTION_FIELDS = "id, institution_id, provider, base_url, access_token_secret_name, enabled, metadata, created_at, updated_at";

export async function fetchAdminLmsConnections(institutionId: string) {
  const [connectionsRes, runsRes] = await Promise.all([
    lmsSupabase
      .from("lms_connections")
      .select(BASE_CONNECTION_FIELDS)
      .eq("institution_id", institutionId)
      .order("updated_at", { ascending: false }),
    lmsSupabase
      .from("lms_sync_runs")
      .select(BASE_RUN_FIELDS)
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (connectionsRes.error) throw connectionsRes.error;
  if (runsRes.error) throw runsRes.error;

  return {
    connections: (connectionsRes.data ?? []) as AdminLmsConnectionRow[],
    syncRuns: (runsRes.data ?? []) as AdminLmsSyncRunRow[],
  };
}

export async function saveAdminLmsConnection(input: AdminLmsConnectionInput) {
  const { data, error } = await lmsSupabase
    .from("lms_connections")
    .upsert(
      {
        institution_id: input.institutionId,
        provider: input.provider,
        base_url: normalizeLmsBaseUrl(input.baseUrl),
        access_token_secret_name: input.accessTokenSecretName?.trim() || null,
        enabled: input.enabled,
        metadata: input.metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "institution_id,provider" },
    )
    .select(BASE_CONNECTION_FIELDS)
    .single();

  if (error) throw error;
  return data as AdminLmsConnectionRow;
}

export async function deleteAdminLmsConnection(institutionId: string, provider: LmsProviderId) {
  const { error } = await lmsSupabase
    .from("lms_connections")
    .delete()
    .eq("institution_id", institutionId)
    .eq("provider", provider);

  if (error) throw error;
}

export async function seedCanvasLmsConnection(institutionId: string) {
  return await saveAdminLmsConnection({
    institutionId,
    provider: "canvas",
    baseUrl: "https://canvas.instructure.com",
    enabled: true,
    accessTokenSecretName: "CANVAS_ACCESS_TOKEN",
    metadata: {},
  });
}

export async function runAdminLmsSync(options: {
  institutionId: string;
  institutionSlug: string;
  provider: LmsProviderId;
  syncMode?: LmsSyncMode;
}) {
  const { data, error } = await lmsSupabase.functions.invoke("lms-sync", {
    body: {
      institutionId: options.institutionId,
      institutionSlug: options.institutionSlug,
      provider: options.provider,
      syncMode: options.syncMode ?? "incremental",
    },
  });

  if (error) throw error;
  return data as AdminLmsSyncResponse;
}
