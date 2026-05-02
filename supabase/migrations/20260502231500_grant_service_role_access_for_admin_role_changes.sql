grant usage on schema public to service_role;

grant select, update on table public.profiles to service_role;
grant select, insert, delete on table public.user_roles to service_role;
grant insert on table public.admin_audit_log to service_role;
