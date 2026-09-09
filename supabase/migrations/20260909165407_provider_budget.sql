create table private.provider_settings(provider text primary key check(provider in('google','kakao')),enabled boolean not null default false,daily_limit integer not null default 100 check(daily_limit between 0 and 10000),monthly_limit integer not null default 1000 check(monthly_limit between 0 and 100000),monthly_budget_micros bigint not null default 10000000 check(monthly_budget_micros between 0 and 1000000000));
insert into private.provider_settings(provider) values('google'),('kakao');
create table private.provider_usage_events(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles on delete set null,provider text not null,operation text not null,status text not null default 'reserved',estimated_micros bigint not null,latency_ms integer,created_at timestamptz not null default now());
create index provider_usage_time on private.provider_usage_events(provider,created_at);
create table private.provider_sessions(id uuid primary key,user_id uuid not null references public.profiles on delete cascade,map_id uuid not null references public.theme_maps,created_at timestamptz not null default now(),requests integer not null default 0,ended boolean not null default false);
alter table private.provider_settings enable row level security;
alter table private.provider_usage_events enable row level security;
alter table private.provider_sessions enable row level security;
revoke all on private.provider_settings,private.provider_usage_events,private.provider_sessions from anon,authenticated;

create function private.reserve_provider(p text,op text,u uuid,m uuid,session_id uuid,cost bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare settings private.provider_settings; sid private.provider_sessions; r uuid; daily integer; monthly integer; amount bigint;
begin
 if cost<0 or cost>1000000 or op not in('autocomplete','details','keyword') then raise exception 'Invalid reservation'; end if;
 if not exists(select 1 from private.user_roles where user_id=u and not suspended) or not private.public_map(m) then raise exception 'Forbidden'; end if;
 select * into settings from private.provider_settings where provider=p for update;
 if not found or not settings.enabled then raise exception '외부 검색이 일시 중지되어 있습니다.'; end if;
 select count(*) filter(where created_at>=date_trunc('day',now())),count(*),coalesce(sum(estimated_micros),0) into daily,monthly,amount from private.provider_usage_events where provider=p and created_at>=date_trunc('month',now());
 if daily>=settings.daily_limit or monthly>=settings.monthly_limit or amount+cost>settings.monthly_budget_micros then raise exception '외부 검색 예산에 도달했습니다.'; end if;
 if (select count(*) from private.provider_usage_events where user_id=u and created_at>now()-interval '1 hour')>=60 then raise exception '검색 요청 한도에 도달했습니다.'; end if;
 if p='google' then
  insert into private.provider_sessions(id,user_id,map_id) values(session_id,u,m) on conflict do nothing;
  select * into sid from private.provider_sessions where id=session_id for update;
  if sid.user_id<>u or sid.map_id<>m or sid.ended or sid.created_at<now()-interval '15 minutes' or sid.requests>=20 then raise exception '검색 세션이 만료되었습니다. 다시 검색해 주세요.'; end if;
  if op='details' and sid.requests=0 then raise exception '검색부터 시작해 주세요.'; end if;
  update private.provider_sessions set requests=requests+1,ended=(op='details') where id=session_id;
 end if;
 insert into private.provider_usage_events(user_id,provider,operation,estimated_micros) values(u,p,op,cost) returning id into r;
 return r;
end $$;
create function public.reserve_provider(p text,op text,u uuid,m uuid,session_id uuid,cost bigint) returns uuid language sql security invoker set search_path='' as $$ select private.reserve_provider(p,op,u,m,session_id,cost) $$;
create function private.finish_provider(r uuid,result text,ms integer) returns void language sql security definer set search_path='' as $$ update private.provider_usage_events set status=left(result,40),latency_ms=ms where id=r $$;
create function public.finish_provider(r uuid,result text,ms integer) returns void language sql security invoker set search_path='' as $$ select private.finish_provider(r,result,ms) $$;
create function private.resolve_provider(p text,external_id_value text) returns uuid language sql stable security definer set search_path='' as $$ select r.place_id from private.place_provider_refs r join public.places v on v.id=r.place_id where r.provider=p and r.external_id=external_id_value and v.status='active' $$;
create function public.resolve_provider(p text,external_id_value text) returns uuid language sql stable security invoker set search_path='' as $$ select private.resolve_provider(p,external_id_value) $$;
create function private.link_provider(mp uuid,u uuid,p text,external_id_value text) returns void language plpgsql security definer set search_path='' as $$ declare pid uuid; begin
 select place_id into pid from public.map_places where id=mp and added_by=u;
 if pid is null then raise exception 'Missing proposal'; end if;
 insert into private.place_provider_refs(place_id,provider,external_id) values(pid,p,external_id_value) on conflict(provider,external_id) do nothing;
end $$;
create function public.link_provider(mp uuid,u uuid,p text,external_id_value text) returns void language sql security invoker set search_path='' as $$ select private.link_provider(mp,u,p,external_id_value) $$;
create function private.usage_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if not private.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
 return jsonb_build_object('settings',(select jsonb_agg(s) from private.provider_settings s),'events',(select coalesce(jsonb_agg(r),'[]') from(select id,provider,operation,status,estimated_micros,latency_ms,created_at from private.provider_usage_events order by created_at desc limit 100)r),'totals',(select coalesce(jsonb_agg(r),'[]') from(select provider,count(*) requests,sum(estimated_micros) estimated_micros from private.provider_usage_events where created_at>=date_trunc('month',now()) group by provider)r)); end $$;
create function public.usage_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$ select private.usage_snapshot() $$;
revoke execute on all functions in schema private from public;
revoke execute on function public.reserve_provider(text,text,uuid,uuid,uuid,bigint),public.finish_provider(uuid,text,integer),public.resolve_provider(text,text),public.link_provider(uuid,uuid,text,text),public.usage_snapshot() from public;
grant execute on function private.reserve_provider(text,text,uuid,uuid,uuid,bigint),private.finish_provider(uuid,text,integer),private.resolve_provider(text,text),private.link_provider(uuid,uuid,text,text),public.reserve_provider(text,text,uuid,uuid,uuid,bigint),public.finish_provider(uuid,text,integer),public.resolve_provider(text,text),public.link_provider(uuid,uuid,text,text) to service_role;
grant execute on function private.usage_snapshot(),public.usage_snapshot() to authenticated;
-- Verified server claims only. Canonical creation and optional ref binding are atomic.
create function private.submit_resolved_proposal(payload jsonb,u uuid,p text,external_id_value text,allow_ref boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; existing uuid; begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform pg_advisory_xact_lock(hashtextextended(p||':'||external_id_value,0));
 if allow_ref then
  select r.place_id into existing from private.place_provider_refs r join public.places v on v.id=r.place_id where r.provider=p and r.external_id=external_id_value and v.status='active';
  if existing is not null then payload:=jsonb_set(payload,'{placeId}',to_jsonb(existing)); end if;
  if exists(select 1 from private.place_provider_refs where provider=p and external_id=external_id_value) and existing is null then raise exception '이 장소는 이미 검토 대기 중입니다.'; end if;
 end if;
 result_id:=private.submit_proposal(payload);
 if allow_ref then perform private.link_provider(result_id,u,p,external_id_value); end if;
 return result_id;
end $$;
create function public.submit_resolved_proposal(payload jsonb,u uuid,p text,external_id_value text,allow_ref boolean) returns uuid language sql security invoker set search_path='' as $$ select private.submit_resolved_proposal(payload,u,p,external_id_value,allow_ref) $$;
revoke execute on function private.submit_resolved_proposal(jsonb,uuid,text,text,boolean),public.submit_resolved_proposal(jsonb,uuid,text,text,boolean) from public;
grant execute on function private.submit_resolved_proposal(jsonb,uuid,text,text,boolean),public.submit_resolved_proposal(jsonb,uuid,text,text,boolean) to service_role;
