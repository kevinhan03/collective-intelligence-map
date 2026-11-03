-- Freeze legacy anonymous votes. Aggregation, account merge and canonical-place
-- merge triggers remain intact; no historical rows are deleted or rewritten.
create or replace function private.record_anonymous_vote(
  p_target uuid, p_token_hash text, p_value smallint
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  raise exception '로그인 후 투표해 주세요.' using errcode='42501';
end $$;
revoke all on function private.record_anonymous_vote(uuid,text,smallint),
  public.record_anonymous_vote(uuid,text,smallint)
  from public, anon, authenticated, service_role;
revoke insert, update on public.anonymous_map_place_votes from service_role;
notify pgrst, 'reload schema';
