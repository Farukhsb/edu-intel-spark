revoke all on function public.admin_set_user_role(uuid, public.app_role) from authenticated;
grant execute on function public.admin_set_user_role(uuid, public.app_role) to service_role;
