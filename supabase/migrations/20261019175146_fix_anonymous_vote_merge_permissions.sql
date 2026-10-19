-- The invoker wrapper needs permission to call its private implementation.
revoke execute on function private.merge_anonymous_votes(text) from public, anon;
grant execute on function private.merge_anonymous_votes(text) to authenticated;
revoke execute on function public.merge_anonymous_votes(text) from public, anon;
grant execute on function public.merge_anonymous_votes(text) to authenticated;
