# Role Model Alignment

This is the current safe baseline for roles in the app.

## Current practical model

- frontend app roles: `student`, `lecturer`, `admin`
- database enum: `public.app_role = student | lecturer | admin`
- backend authorization source: `public.user_roles`
- compatibility mirror still in use: `public.profiles.role`

The app is still in a compatibility phase. The goal is to treat `user_roles` as canonical for authorization while keeping `profiles.role` synchronized until the older reads are removed.

## What was tightened here

- frontend role parsing is now centralized in one helper instead of being repeated in multiple files
- public signup is limited to `student` or `lecturer` at the type level in the app
- the database role enum now includes `admin`
- the signup trigger now ignores `admin` in public auth metadata and only creates `student` or `lecturer`
- edge-function staff authorization no longer trusts `profiles.role` alone
- edge-function staff authorization now resolves roles from `user_roles` first and falls back to `profiles.role`
- admin is treated as lecturer-equivalent only where the app already exposes lecturer workflow access

## Drift audit query

Use this against a Supabase database to find role mismatches:

```sql
with profile_roles as (
  select id as user_id, role::text as profile_role
  from public.profiles
),
user_role_rollup as (
  select
    user_id,
    string_agg(role::text, ',' order by role::text) as user_roles
  from public.user_roles
  group by user_id
)
select
  coalesce(p.user_id, u.user_id) as user_id,
  p.profile_role,
  u.user_roles
from profile_roles p
full outer join user_role_rollup u on u.user_id = p.user_id
where coalesce(p.profile_role, '') <> coalesce(u.user_roles, '');
```

## Safe admin capabilities

Low-risk admin actions:

- view admin metrics
- filter and review user accounts
- change `student <-> lecturer` through the protected RPC only
- open admin-safe reporting views

Do not treat admin as a direct editor of assignments, submissions, or grades unless those paths get dedicated admin-aware backend checks.
