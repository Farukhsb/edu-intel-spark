-- Harden submission file reads by tying storage access to the same viewer
-- authorization rules as the linked submission workflow.
--
-- This migration deliberately keeps the submissions bucket private and scopes
-- reads to exact object names stored in public.submissions.file_url.
-- If file_url is ever stored as a full URL, normalize it back to the exact
-- storage object path before comparing it to storage.objects.name.

create or replace function public.normalize_submission_storage_object_name(_file_url text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  _trimmed text;
  _match text[];
begin
  _trimmed := nullif(btrim(coalesce(_file_url, '')), '');

  if _trimmed is null then
    return null;
  end if;

  if _trimmed ~ '^[a-z]+://' then
    _match := regexp_match(
      _trimmed,
      '/storage/v1/object/(?:sign|public|authenticated)/submissions/([^?]+)'
    );

    if _match is not null and array_length(_match, 1) = 1 then
      return _match[1];
    end if;

    _match := regexp_match(
      _trimmed,
      '/object/(?:sign|public|authenticated)/submissions/([^?]+)'
    );

    if _match is not null and array_length(_match, 1) = 1 then
      return _match[1];
    end if;
  end if;

  return ltrim(_trimmed, '/');
end;
$$;

create or replace function public.user_can_view_submission(_submission_id uuid, _viewer_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.submissions s
    left join public.assignments a
      on a.id::text = s.assignment_id::text
    left join public.moderation_cases mc
      on mc.submission_id = s.id
    where s.id = _submission_id
      and (
        s.student_id = _viewer_id
        or a.lecturer_id = _viewer_id
        or mc.moderator_id = _viewer_id
        or public.has_role(_viewer_id, 'admin')
      )
  )
$$;

drop policy if exists "Users can view authorized submission files" on storage.objects;

create policy "Users can view authorized submission files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'submissions'
  and exists (
    select 1
    from public.submissions s
    where public.normalize_submission_storage_object_name(s.file_url) = storage.objects.name
      and public.user_can_view_submission(s.id, auth.uid())
  )
);

comment on policy "Users can view authorized submission files" on storage.objects is
'Keep submission files private. Storage reads are allowed only when auth.uid() is authorised to view the exact linked submission row.';

-- Replace the broad lecturer profile read policy with connected-profile access.
-- Lecturers can see only:
-- - themselves
-- - students linked to assignments they own, including targeted students for those assignments
-- - staff linked to moderation workflows they own or are assigned to
-- - admins can see all profiles

create or replace function public.user_can_view_profile(_profile_id uuid, _viewer_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    _profile_id = _viewer_id
    or public.has_role(_viewer_id, 'admin')
    or exists (
      select 1
      from public.submissions s
      join public.assignments a
        on a.id::text = s.assignment_id::text
      where a.lecturer_id = _viewer_id
        and s.student_id = _profile_id
    )
    or exists (
      select 1
      from public.assignments a
      join public.profiles p
        on p.id = _profile_id
       and p.role::text = 'student'
      where a.lecturer_id = _viewer_id
        and public.student_matches_assignment_target(a.id, _profile_id)
    )
    or exists (
      select 1
      from public.moderation_cases mc
      where (
        mc.lecturer_id = _viewer_id
        or mc.first_marker_id = _viewer_id
        or mc.moderator_id = _viewer_id
      )
      and (
        mc.lecturer_id = _profile_id
        or mc.first_marker_id = _profile_id
        or mc.moderator_id = _profile_id
      )
    )
    or exists (
      select 1
      from public.moderation_cases mc
      join public.submissions s
        on s.id = mc.submission_id
      where (
        mc.lecturer_id = _viewer_id
        or mc.first_marker_id = _viewer_id
        or mc.moderator_id = _viewer_id
      )
      and s.student_id = _profile_id
    )
  )
$$;

drop policy if exists "Lecturers can view all profiles" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users can view connected profiles" on public.profiles;

create policy "Users can view connected profiles"
on public.profiles
for select
to authenticated
using (public.user_can_view_profile(id, auth.uid()));

comment on policy "Users can view connected profiles" on public.profiles is
'Restrict profile reads to the signed-in user, admins, students linked to owned assignments, and staff linked through owned or assigned moderation workflows.';
