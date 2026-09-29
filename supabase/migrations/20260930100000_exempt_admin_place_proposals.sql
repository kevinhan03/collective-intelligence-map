-- Admin proposals are already reviewed and published immediately. Keep the
-- hourly proposal guard for other contributors and all other write buckets.
create or replace function private.rate_limit(bucket_name text, max_count integer)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); c integer;
begin
  if bucket_name = 'proposal' and private.is_admin() then return; end if;

  insert into private.write_limits(user_id, bucket, period, count)
  values(u, bucket_name, date_trunc('hour', now()), 1)
  on conflict(user_id, bucket, period)
  do update set count = private.write_limits.count + 1
  returning count into c;

  if c > max_count then
    raise exception '요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
      using errcode = 'P0001';
  end if;
end $$;
