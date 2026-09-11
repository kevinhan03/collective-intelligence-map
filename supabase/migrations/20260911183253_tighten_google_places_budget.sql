-- Google Places Autocomplete sessions are capped at twelve autocomplete calls
-- plus one terminating Details request. This prevents a script from spending
-- the monthly budget by minting an unlimited number of search requests.
create or replace function private.reserve_provider(
  p text,
  op text,
  u uuid,
  m uuid,
  session_id uuid,
  cost bigint
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  settings private.provider_settings;
  sid private.provider_sessions;
  r uuid;
  daily integer;
  monthly integer;
  amount bigint;
begin
  if cost < 0 or cost > 1000000 or op not in ('autocomplete', 'details', 'keyword') then
    raise exception 'Invalid reservation';
  end if;
  if not exists (
    select 1 from private.user_roles where user_id = u and not suspended
  ) or not private.public_map(m) then
    raise exception 'Forbidden';
  end if;
  select * into settings from private.provider_settings where provider = p for update;
  if not found or not settings.enabled then
    raise exception '외부 검색이 일시 중지되어 있습니다.';
  end if;
  select
    count(*) filter (where created_at >= date_trunc('day', now())),
    count(*),
    coalesce(sum(estimated_micros), 0)
  into daily, monthly, amount
  from private.provider_usage_events
  where provider = p and created_at >= date_trunc('month', now());
  if daily >= settings.daily_limit
    or monthly >= settings.monthly_limit
    or amount + cost > settings.monthly_budget_micros then
    raise exception '외부 검색 예산에 도달했습니다.';
  end if;
  if (
    select count(*) from private.provider_usage_events
    where user_id = u and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception '검색 요청 한도에 도달했습니다.';
  end if;
  if p = 'google' then
    insert into private.provider_sessions(id, user_id, map_id)
    values (session_id, u, m)
    on conflict do nothing;
    select * into sid from private.provider_sessions where id = session_id for update;
    if sid.user_id <> u
      or sid.map_id <> m
      or sid.ended
      or sid.created_at < now() - interval '15 minutes' then
      raise exception '검색 세션이 만료되었습니다. 다시 검색해 주세요.';
    end if;
    if op = 'autocomplete' and sid.requests >= 12 then
      raise exception '이번 검색의 입력 횟수가 한도에 도달했습니다. 다시 검색해 주세요.';
    end if;
    if op = 'details' and sid.requests = 0 then
      raise exception '검색부터 시작해 주세요.';
    end if;
    update private.provider_sessions
      set requests = requests + 1, ended = (op = 'details')
      where id = session_id;
  end if;
  insert into private.provider_usage_events(user_id, provider, operation, estimated_micros)
  values (u, p, op, cost)
  returning id into r;
  return r;
end $$;
