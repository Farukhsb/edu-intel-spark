# Admin Dashboard Rollout

This dashboard now prefers server-side RPCs for the main admin oversight sections. If these migrations are not applied, the UI still falls back to older client-side logic, but you will not be testing the intended production path.

## New migrations

Apply these migrations to the linked Supabase project:

- `supabase/migrations/20260503120500_add_admin_dashboard_metrics_rpc.sql`
- `supabase/migrations/20260503122000_add_admin_assignment_oversight_rpc.sql`
- `supabase/migrations/20260503123500_add_admin_moderation_overview_rpc.sql`
- `supabase/migrations/20260503125000_add_admin_recent_activity_rpc.sql`

## Apply locally

If your project is already linked:

```powershell
npx supabase db push --linked
```

If you prefer to inspect pending migrations first:

```powershell
npx supabase migration list --linked
```

## What each RPC powers

- `get_admin_dashboard_metrics()`
  Powers the top overview cards.
- `get_admin_assignment_oversight()`
  Powers assignment oversight counts per assignment.
- `get_admin_moderation_overview()`
  Powers integrity and moderation rows plus moderation KPI cards.
- `get_admin_recent_activity()`
  Powers the recent activity feed.

## Local verification checklist

Sign in as an admin and verify these routes:

### 1. Overview

Open:

```text
/dashboard
```

Check:

- Top summary cards render counts without obvious delays.
- System health wording reads as observed/inferred state, not hard claims.
- Recent activity feed shows platform events.
- User, assignment, and moderation preview sections render.

### 2. Users

Open:

```text
/dashboard?view=users
```

Check:

- Search by user name works.
- Search by email works.
- Pagination buttons appear when enough users exist.
- Student `View` opens the admin-safe summary modal.
- Student and lecturer role changes still require confirmation.
- Admin rows still show `No role change`.

### 3. Assignments

Open:

```text
/dashboard?view=assignments
```

Check:

- Search by assignment title, module code, and lecturer works.
- Pagination works.
- `Submissions`, `Graded`, and `Released` values look correct for known assignments.

### 4. Submissions

Open:

```text
/dashboard?view=submissions
```

Check:

- Search by file name works.
- Search by student or assignment works.
- Pagination works.
- Submission statuses render with the expected badges.

### 5. System

Open:

```text
/dashboard?view=system
```

Check:

- Moderation KPI cards render.
- Moderation rows show marker names, risk, confidence, and status.
- No section claims fake operational certainty such as generic `Healthy` or `Online` from inferred data alone.

### 6. Audit

Open:

```text
/dashboard?view=audit
```

Check:

- Role changes appear in the audit log.
- Workflow audit rows appear if grade audit data exists.
- Recent activity remains populated.

## Expected fallback behavior

If the new RPCs are not yet applied, the dashboard should still render because the UI falls back to client-side aggregation for:

- overview counts
- assignment oversight
- moderation overview
- recent activity

That fallback is only for rollout safety. The intended production path is the RPC-backed path.

## Current focused test

You can rerun the dashboard-focused test with:

```powershell
npm run test -- AdminDashboard
```

Current coverage includes:

- role change confirmation
- admin-safe student view modal
- system health wording
- user search and pagination
- submission search
