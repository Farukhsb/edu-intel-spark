create or replace function public.consume_edge_rate_limit(
  p_scope text,
  p_identifier text,
  p_limit integer,
  p_window_seconds integer,
  p_now timestamptz default now()
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  current_count integer,
  window_started_at timestamptz
)
language sql
security definer
set search_path = private, public
as $$
  select *
  from private.consume_edge_rate_limit(
    p_scope,
    p_identifier,
    p_limit,
    p_window_seconds,
    p_now
  );
$$;

revoke all on function public.consume_edge_rate_limit(text, text, integer, integer, timestamptz) from public;
revoke all on function public.consume_edge_rate_limit(text, text, integer, integer, timestamptz) from authenticated;
grant execute on function public.consume_edge_rate_limit(text, text, integer, integer, timestamptz) to service_role;
