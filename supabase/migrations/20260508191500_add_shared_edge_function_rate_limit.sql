create table if not exists private.edge_rate_limit_counters (
  scope text not null,
  identifier text not null,
  window_started_at timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, identifier)
);

revoke all on table private.edge_rate_limit_counters from public;
revoke all on table private.edge_rate_limit_counters from authenticated;
grant select, insert, update, delete on table private.edge_rate_limit_counters to service_role;

create or replace function private.consume_edge_rate_limit(
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
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_row private.edge_rate_limit_counters%rowtype;
  v_window_started_at timestamptz;
  v_retry_after integer;
begin
  if coalesce(trim(p_scope), '') = '' then
    raise exception 'p_scope is required';
  end if;

  if coalesce(trim(p_identifier), '') = '' then
    raise exception 'p_identifier is required';
  end if;

  if p_limit <= 0 then
    raise exception 'p_limit must be greater than zero';
  end if;

  if p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be greater than zero';
  end if;

  insert into private.edge_rate_limit_counters as counters (
    scope,
    identifier,
    window_started_at,
    count,
    updated_at
  )
  values (
    p_scope,
    p_identifier,
    p_now,
    1,
    p_now
  )
  on conflict (scope, identifier)
  do update
  set
    window_started_at = case
      when counters.window_started_at + make_interval(secs => p_window_seconds) <= p_now then p_now
      else counters.window_started_at
    end,
    count = case
      when counters.window_started_at + make_interval(secs => p_window_seconds) <= p_now then 1
      else counters.count + 1
    end,
    updated_at = p_now
  returning * into v_row;

  v_window_started_at := v_row.window_started_at;

  if v_row.count > p_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from ((v_window_started_at + make_interval(secs => p_window_seconds)) - p_now)))
    )::integer;

    return query
    select false, v_retry_after, v_row.count, v_window_started_at;
    return;
  end if;

  return query
  select true, 0, v_row.count, v_window_started_at;
end;
$$;

revoke all on function private.consume_edge_rate_limit(text, text, integer, integer, timestamptz) from public;
revoke all on function private.consume_edge_rate_limit(text, text, integer, integer, timestamptz) from authenticated;
grant execute on function private.consume_edge_rate_limit(text, text, integer, integer, timestamptz) to service_role;

create or replace function private.cleanup_edge_rate_limit_counters(
  p_before timestamptz default now() - interval '1 day'
)
returns integer
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_deleted integer;
begin
  delete from private.edge_rate_limit_counters
  where updated_at < p_before;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function private.cleanup_edge_rate_limit_counters(timestamptz) from public;
revoke all on function private.cleanup_edge_rate_limit_counters(timestamptz) from authenticated;
grant execute on function private.cleanup_edge_rate_limit_counters(timestamptz) to service_role;
