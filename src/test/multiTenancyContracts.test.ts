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
});
