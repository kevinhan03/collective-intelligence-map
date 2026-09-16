-- Service-only reservation: counters commit before the external network call.
create table private.search_operation_limits (
  operation text not null,
  scope text not null,
  period timestamptz not null,
  count integer not null default 0,
  primary key(operation, scope, period)
);
alter table private.search_operation_limits enable row level security;
revoke all on private.search_operation_limits from public, anon, authenticated;
grant select, insert, update, delete on private.search_operation_limits to service_role;
create function public.reserve_search_operation(u uuid, operation text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare hourly_cap int; daily_cap int; user_count int; global_count int;
begin
  if operation not in ('gemini','geocode') then return false; end if;
  if not exists(select 1 from public.profiles where id=u)
     or exists(select 1 from private.user_roles where user_id=u and suspended)
  then return false; end if;
  hourly_cap := case when operation='gemini' then 30 else 60 end;
  daily_cap := case when operation='gemini' then 1000 else 2000 end;
  perform pg_advisory_xact_lock(hashtextextended('search-limit:' || operation,0));
  delete from private.search_operation_limits where period < now()-interval '2 days';
  select count into user_count from private.search_operation_limits l
    where l.operation=reserve_search_operation.operation and scope=u::text and period=date_trunc('hour',now());
  select count into global_count from private.search_operation_limits l
    where l.operation=reserve_search_operation.operation and scope='global' and period=date_trunc('day',now());
  if coalesce(user_count,0)>=hourly_cap or coalesce(global_count,0)>=daily_cap then return false; end if;
  insert into private.search_operation_limits values(operation,u::text,date_trunc('hour',now()),1)
    on conflict on constraint search_operation_limits_pkey do update set count=private.search_operation_limits.count+1;
  insert into private.search_operation_limits values(operation,'global',date_trunc('day',now()),1)
    on conflict on constraint search_operation_limits_pkey do update set count=private.search_operation_limits.count+1;
  return true;
end $$;
grant select on private.user_roles to service_role;
grant select on public.profiles to service_role;
revoke all on function public.reserve_search_operation(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_search_operation(uuid,text) to service_role;
notify pgrst, 'reload schema';
