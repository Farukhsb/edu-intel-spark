// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("multi-tenancy identity contracts", () => {
  it("creates an institutions table and backfills a default institution", () => {
    const source = readRepoFile("supabase/migrations/20260525090000_add_identity_institutions.sql");

    expect(source).toContain("create table if not exists public.institutions");
    expect(source).toContain("slug text not null unique");
    expect(source).toContain("values ('Default Institution', 'default', 'active')");
    expect(source).toContain("alter table public.profiles");
    expect(source).toContain("add column if not exists institution_id uuid");
    expect(source).toContain("alter table public.user_roles");
    expect(source).toContain("alter column institution_id set not null");
  });

  it("adds shared institution helpers for later RLS scoping", () => {
    const source = readRepoFile("supabase/migrations/20260525090000_add_identity_institutions.sql");

    expect(source).toContain("create or replace function private.user_institution_id(_user_id uuid)");
    expect(source).toContain("create or replace function private.current_institution_id()");
    expect(source).toContain("create or replace function private.same_institution(_institution_id uuid)");
  });

  it("makes signup assign an institution through the central auth trigger", () => {
    const source = readRepoFile("supabase/migrations/20260525090000_add_identity_institutions.sql");

    expect(source).toContain("create or replace function public.resolve_signup_institution_id(_raw_user_meta_data jsonb)");
    expect(source).toContain("_institution_id uuid := public.resolve_signup_institution_id(new.raw_user_meta_data);");
    expect(source).toContain("institution_id");
    expect(source).toContain("insert into public.user_roles (user_id, role, institution_id)");
  });

  it("keeps the signup institution resolver internal and search-path safe", () => {
    const source = readRepoFile("supabase/migrations/20260602123000_harden_function_search_path_and_rpc_grants.sql");

    expect(source).toContain("create or replace function public.try_parse_uuid(_value text)");
    expect(source).toContain("set search_path = public");
    expect(source).toContain("create or replace function public.sync_profile_department_columns()");
    expect(source).toContain("create or replace function public.sync_assignment_department_columns()");
    expect(source).toContain("revoke all on function public.try_parse_uuid(text) from authenticated");
    expect(source).toContain("revoke all on function public.resolve_signup_institution_id(jsonb) from authenticated");
  });

  it("keeps student projection RPCs on invoker semantics and removes signup helper grants", () => {
    const source = readRepoFile("supabase/migrations/20260602125500_reduce_security_definer_surface.sql");

    expect(source).toContain("create or replace function public.get_student_grade_assignment_metadata()");
    expect(source).toContain("security invoker");
    expect(source).toContain("create or replace function public.get_student_submission_grade_projection()");
    expect(source).toContain("create or replace function public.send_submission_to_moderation(_submission_id uuid)");
    expect(source).toContain("revoke all on function public.resolve_signup_institution_id(jsonb) from public");
    expect(source).toContain("revoke all on function public.resolve_signup_institution_id(jsonb) from anon");
    expect(source).toContain("revoke all on function public.resolve_signup_institution_id(jsonb) from authenticated");
  });

  it("hardens admin dashboards, student projection RPCs, and submission-file reads to the current institution", () => {
    const source = readRepoFile("supabase/migrations/20260606120000_harden_multi_tenant_admin_and_student_surfaces.sql");

    expect(source).toContain("create or replace function public.get_admin_dashboard_metrics()");
    expect(source).toContain("where institution_id = private.current_institution_id()");
    expect(source).toContain("create or replace function public.get_admin_assignment_oversight()");
    expect(source).toContain("and a.institution_id = private.current_institution_id()");
    expect(source).toContain("and s.institution_id = a.institution_id");
    expect(source).toContain("create or replace function public.get_admin_moderation_overview()");
    expect(source).toContain("and mc.institution_id = private.current_institution_id()");
    expect(source).toContain("and a.institution_id = mc.institution_id");
    expect(source).toContain("create or replace function public.get_student_grade_assignment_metadata()");
    expect(source).toContain("and s.institution_id = private.current_institution_id()");
    expect(source).toContain("create or replace function public.get_student_submission_grade_projection()");
    expect(source).toContain("and g.institution_id = s.institution_id");
    expect(source).toContain("create or replace function public.send_submission_to_moderation(_submission_id uuid)");
    expect(source).toContain("where id = _submission_id");
    expect(source).toContain("and institution_id = private.current_institution_id()");
    expect(source).toContain("drop policy if exists \"Users can view authorized submission files\" on storage.objects;");
    expect(source).toContain("and private.same_institution(s.institution_id)");
  });

  it("seeds a two-institution isolation fixture with mirrored risk data", () => {
    const source = readRepoFile("supabase/fixtures/multi-tenant-isolation-fixture.sql");

    expect(source).toContain("Isolation Institution A");
    expect(source).toContain("Isolation Institution B");
    expect(source).toContain("isolation.student.a@edu-intel.test");
    expect(source).toContain("isolation.student.b@edu-intel.test");
    expect(source).toContain("11111111-1111-4111-8111-111111111111");
    expect(source).toContain("22222222-2222-4222-8222-222222222222");
    expect(source).toContain("student_risk_snapshots");
    expect(source).toContain("student_risk_predictions");
    expect(source).toContain("student_risk_outcomes");
  });

  it("adds institution scoping to core workflow tables with automatic derivation hooks", () => {
    const source = readRepoFile("supabase/migrations/20260525093000_add_workflow_institutions.sql");

    expect(source).toContain("alter table public.assignments add column if not exists institution_id uuid;");
    expect(source).toContain("alter table public.submissions add column if not exists institution_id uuid;");
    expect(source).toContain("alter table public.grades add column if not exists institution_id uuid;");
    expect(source).toContain("alter table public.academic_integrity_reviews add column if not exists institution_id uuid;");
    expect(source).toContain("alter table public.communication_messages add column if not exists institution_id uuid;");
    expect(source).toContain("alter table public.workflow_notification_log add column if not exists institution_id uuid;");
    expect(source).toContain("create or replace function public.sync_submission_institution_id()");
    expect(source).toContain("create or replace function public.sync_grade_institution_id()");
    expect(source).toContain("create or replace function public.sync_communication_message_institution_id()");
    expect(source).toContain("create trigger sync_submission_institution_id");
    expect(source).toContain("create trigger sync_grade_institution_id");
  });

  it("adds workflow run telemetry with institution-aware admin access", () => {
    const source = readRepoFile("supabase/migrations/20260602084500_add_workflow_runs_telemetry.sql");

    expect(source).toContain("create table if not exists public.workflow_runs");
    expect(source).toContain("workflow_name text not null");
    expect(source).toContain("retry_count integer not null default 0");
    expect(source).toContain("status text not null check (status in ('running', 'succeeded', 'failed'))");
    expect(source).toContain("grant select on public.workflow_runs to authenticated;");
    expect(source).toContain("grant insert, update on public.workflow_runs to service_role;");
    expect(source).toContain("create policy \"Admins can read workflow runs\"");
    expect(source).toContain("private.same_institution(institution_id)");
  });

  it("adds workflow notification delivery telemetry with institution-aware admin access", () => {
    const source = readRepoFile("supabase/migrations/20260602082000_admin_workflow_notification_log_policy.sql");

    expect(source).toContain("grant select on public.workflow_notification_log to authenticated;");
    expect(source).toContain('create policy "Admins can read workflow notification log"');
    expect(source).toContain("for select");
    expect(source).toContain("private.is_admin()");
    expect(source).toContain("private.same_institution(institution_id)");
  });

  it("adds admin-only risk intelligence tables with institution-scoped telemetry", () => {
    const source = readRepoFile("supabase/migrations/20260603102000_add_admin_risk_intelligence_tables.sql");
    const policies = readRepoFile("supabase/migrations/20260604104000_switch_risk_policies_to_private_is_admin.sql");

    expect(source).toContain("create table if not exists public.student_risk_snapshots");
    expect(source).toContain("create table if not exists public.student_risk_predictions");
    expect(source).toContain("create table if not exists public.risk_feedback");
    expect(source).toContain("student_id uuid not null references public.profiles(id)");
    expect(source).toContain("institution_id uuid not null references public.institutions(id)");
    expect(source).toContain("feature_version text not null default 'v1'");
    expect(source).toContain("risk_score numeric(5,4) not null check (risk_score >= 0 and risk_score <= 1)");
    expect(source).toContain("reason_codes text[] not null default '{}'::text[]");
    expect(source).toContain("feedback_type in ('useful', 'false_alarm', 'student_recovered', 'intervention_sent', 'other')");
    expect(source).toContain("grant select on public.student_risk_snapshots to authenticated;");
    expect(source).toContain("grant select on public.student_risk_predictions to authenticated;");
    expect(source).toContain("grant select, insert on public.risk_feedback to authenticated;");
    expect(source).toContain("grant insert, update on public.student_risk_snapshots to service_role;");
    expect(source).toContain("grant insert, update on public.student_risk_predictions to service_role;");
    expect(source).toContain("create trigger sync_student_risk_snapshot_institution_id");
    expect(source).toContain("create trigger sync_student_risk_prediction_institution_id");
    expect(source).toContain("create trigger sync_risk_feedback_institution_id");
    expect(policies).toContain("private.is_admin()");
    expect(policies).toContain("private.same_institution(institution_id)");
  });

  it("adds student risk outcomes for supervised model labels with institution-scoped access", () => {
    const source = readRepoFile("supabase/migrations/20260603212000_add_student_risk_outcomes.sql");
    const traceability = readRepoFile("supabase/migrations/20260604103000_add_source_grade_traceability_to_risk_outcomes.sql");
    const policies = readRepoFile("supabase/migrations/20260604104000_switch_risk_policies_to_private_is_admin.sql");

    expect(source).toContain("create table if not exists public.student_risk_outcomes");
    expect(source).toContain("prediction_id uuid references public.student_risk_predictions(id) on delete set null");
    expect(source).toContain("snapshot_id uuid references public.student_risk_snapshots(id) on delete set null");
    expect(source).toContain("label_window_days integer not null default 30 check (label_window_days > 0)");
    expect(source).toContain("label_value text not null check (label_value in ('low', 'medium', 'high'))");
    expect(source).toContain("outcome_status text not null check (");
    expect(source).toContain("outcome_source text not null check (outcome_source in ('manual', 'grade', 'import', 'system'))");
    expect(source).toContain("grant select on public.student_risk_outcomes to authenticated;");
    expect(source).toContain("grant select, insert, update on public.student_risk_outcomes to service_role;");
    expect(source).toContain("create trigger sync_student_risk_outcome_institution_id");
    expect(traceability).toContain("create unique index if not exists idx_student_risk_outcomes_source_grade_id");
    expect(traceability).toContain("student_risk_outcomes_grade_traceability");
    expect(traceability).toContain("drop constraint if exists student_risk_outcomes_grade_traceability");
    expect(traceability).toContain("add constraint student_risk_outcomes_grade_traceability");
    expect(traceability).toContain("source_grade_id uuid references public.grades(id) on delete set null");
    expect(traceability).toContain("source_submission_id uuid references public.submissions(id) on delete set null");
    expect(policies).toContain('create policy "Admins can read student risk outcomes"');
    expect(policies).toContain('create policy "Admins can insert student risk outcomes"');
    expect(policies).toContain('create policy "Admins can update student risk outcomes"');
    expect(policies).toContain("private.is_admin()");
    expect(policies).toContain("private.same_institution(institution_id)");
  });

  it("switches the risk table policies to private admin checks for API callers", () => {
    const source = readRepoFile("supabase/migrations/20260604104000_switch_risk_policies_to_private_is_admin.sql");

    expect(source).toContain("private.is_admin()");
    expect(source).toContain('create policy "Admins can read student risk snapshots"');
    expect(source).toContain('create policy "Admins can read student risk predictions"');
    expect(source).toContain('create policy "Admins can read risk feedback"');
    expect(source).toContain('create policy "Admins can insert risk feedback"');
    expect(source).toContain('create policy "Admins can read student risk outcomes"');
    expect(source).toContain('create policy "Admins can insert student risk outcomes"');
    expect(source).toContain('create policy "Admins can update student risk outcomes"');
  });

  it("keeps grading error events readable only by admins", () => {
    const source = readRepoFile("supabase/migrations/20260519221000_create_grading_error_events.sql");

    expect(source).toContain("create table if not exists public.grading_error_events");
    expect(source).toContain("grant select on public.grading_error_events to authenticated;");
    expect(source).toContain("grant insert on public.grading_error_events to service_role;");
    expect(source).toContain('create policy "Admins can read grading error events"');
    expect(source).toContain("exists (");
    expect(source).toContain("profiles.role = 'admin'");
  });

  it("adds text overloads for institution helper compatibility on legacy text-key paths", () => {
    const source = readRepoFile("supabase/migrations/20260525094500_add_text_institution_helper_overloads.sql");

    expect(source).toContain("create or replace function private.assignment_institution_id(_assignment_id text)");
    expect(source).toContain("select private.assignment_institution_id(public.try_parse_uuid(_assignment_id))");
    expect(source).toContain("create or replace function private.submission_institution_id(_submission_id text)");
    expect(source).toContain("select private.submission_institution_id(public.try_parse_uuid(_submission_id))");
  });

  it("enforces institution-aware helpers and core RLS policies", () => {
    const source = readRepoFile("supabase/migrations/20260525100000_enforce_multi_tenant_rls.sql");

    expect(source).toContain("create or replace function private.has_role(_user_id uuid, _role public.app_role)");
    expect(source).toContain("and private.same_institution(ur.institution_id)");
    expect(source).toContain("drop policy if exists \"Admins can view all assignments\" on public.assignments;");
    expect(source).toContain("and private.same_institution(institution_id)");
    expect(source).toContain("create policy \"Students can view own grades\"");
    expect(source).toContain("create policy \"Users can view authorized submission files\"");
  });

  it("scopes admin workflows to the current institution", () => {
    const source = readRepoFile("supabase/migrations/20260525100000_enforce_multi_tenant_rls.sql");

    expect(source).toContain("if _target_profile.institution_id <> private.current_institution_id() then");
    expect(source).toContain("raise exception 'Admins can only update users in their institution'");
    expect(source).toContain("create or replace function public.get_admin_recent_activity()");
    expect(source).toContain("and a.institution_id = private.current_institution_id()");
    expect(source).toContain("and gal.institution_id = private.current_institution_id()");
  });

  it("extends institution scoping to analytics, audit events, and student projection RPCs", () => {
    const source = readRepoFile("supabase/migrations/20260525103000_scope_remaining_multi_tenant_surfaces.sql");

    expect(source).toContain("alter table public.analytics_recommendations");
    expect(source).toContain("alter table public.academic_access_events");
    expect(source).toContain("alter table public.grading_error_events");
    expect(source).toContain("create trigger sync_analytics_recommendation_institution_id");
    expect(source).toContain("create policy \"Admins can view all academic access events\"");
    expect(source).toContain("create policy \"Admins can read grading error events\"");
    expect(source).toContain("create or replace function public.get_student_submission_grade_projection()");
    expect(source).toContain("and s.institution_id = private.current_institution_id()");
  });

  it("lets authenticated users read only their own institution record", () => {
    const source = readRepoFile("supabase/migrations/20260525110000_add_institution_read_policy.sql");

    expect(source).toContain("create policy \"Users can view own institution\"");
    expect(source).toContain("using (private.same_institution(id))");
  });

  it("adds a guarded institution provisioning function for bootstrap admins", () => {
    const source = readRepoFile("supabase/migrations/20260525113000_add_institution_provisioning.sql");

    expect(source).toContain("create or replace function private.current_institution_slug()");
    expect(source).toContain("create or replace function public.admin_create_institution(");
    expect(source).toContain("if _current_slug is distinct from 'default' then");
    expect(source).toContain("raise exception 'Only default institution admins can provision new institutions'");
    expect(source).toContain("insert into public.institutions (name, slug, status)");
    expect(source).toContain("'institution_created'");
  });

  it("adds a guarded user-to-institution reassignment path for bootstrap admins only", () => {
    const source = readRepoFile("supabase/migrations/20260525120000_add_user_institution_provisioning.sql");

    expect(source).toContain("create or replace function public.admin_assign_user_to_institution(");
    expect(source).toContain("raise exception 'Only default institution admins can reassign users across institutions'");
    expect(source).toContain("raise exception 'Users with institution-linked activity cannot be reassigned automatically'");
    expect(source).toContain("update public.profiles");
    expect(source).toContain("set institution_id = _target_institution.id");
    expect(source).toContain("update public.user_roles");
    expect(source).toContain("'user_reassigned_institution'");
  });

  it("grants authenticated users the institutions privileges needed by the invoker provisioning path", () => {
    const source = readRepoFile("supabase/migrations/20260602141000_grant_authenticated_institution_table_access.sql");

    expect(source).toContain("grant select, insert on public.institutions to authenticated;");
  });

  it("grants authenticated users the audit-log insert needed by the invoker provisioning path", () => {
    const source = readRepoFile("supabase/migrations/20260602141500_grant_authenticated_admin_audit_log_insert.sql");

    expect(source).toContain("grant insert on public.admin_audit_log to authenticated;");
  });

  it("fixes the reassignment RPC parameter ambiguity while keeping invoker semantics", () => {
    const source = readRepoFile("supabase/migrations/20260602142000_fix_admin_assign_user_to_institution_ambiguity.sql");

    expect(source).toContain("drop function if exists public.admin_assign_user_to_institution(uuid, text);");
    expect(source).toContain("create function public.admin_assign_user_to_institution(");
    expect(source).toContain("p_target_user_id uuid");
    expect(source).toContain("where id = p_target_user_id");
    expect(source).toContain("where a.lecturer_id = p_target_user_id");
    expect(source).toContain("where user_id = p_target_user_id");
    expect(source).toContain("security invoker");
  });

  it("allows default admins to update managed profiles and roles across institutions", () => {
    const source = readRepoFile("supabase/migrations/20260602143000_allow_default_admin_cross_institution_profile_updates.sql");

    expect(source).toContain('drop policy if exists "Admins can update managed profiles" on public.profiles;');
    expect(source).toContain('drop policy if exists "Admins can manage user roles" on public.user_roles;');
    expect(source).toContain("private.current_institution_slug() = 'default'");
    expect(source).toContain("private.same_institution(institution_id)");
  });

  it("extends the base profile self-update policy to cover default admins", () => {
    const source = readRepoFile("supabase/migrations/20260602144000_allow_default_admin_profile_self_update_path.sql");

    expect(source).toContain('drop policy if exists "Users can update own profile" on public.profiles;');
    expect(source).toContain('create policy "Users can update own profile"');
    expect(source).toContain("private.current_institution_slug() = 'default'");
    expect(source).toContain("private.same_institution(institution_id)");
  });

  it("moves the actual institution reassignment writes into a private definer helper", () => {
    const source = readRepoFile("supabase/migrations/20260602145000_add_private_institution_reassignment_helper.sql");

    expect(source).toContain("create or replace function private.reassign_user_institution(");
    expect(source).toContain("security definer");
    expect(source).toContain("perform private.reassign_user_institution(p_target_user_id, _target_institution.id)");
    expect(source).toContain("grant execute on function private.reassign_user_institution(uuid, uuid) to authenticated");
  });

  it("lets default admins read profiles needed to complete institution reassignment round-trips", () => {
    const source = readRepoFile("supabase/migrations/20260602150000_allow_default_admin_profile_read_access.sql");

    expect(source).toContain('drop policy if exists "Users can view own profile" on public.profiles;');
    expect(source).toContain('create policy "Users can view own profile"');
    expect(source).toContain("private.current_institution_slug() = 'default'");
    expect(source).toContain("private.same_institution(institution_id)");
  });
});
