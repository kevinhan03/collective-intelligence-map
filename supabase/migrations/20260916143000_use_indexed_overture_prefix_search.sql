-- The spatial-first plan scanned every Tokyo record and exceeded Supabase's
-- statement timeout. search_text has a trigram index and starts with the
-- primary name, so an anchored prefix query remains precise and is fast.
create or replace function public.search_overture_places(q text,m uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  with input as (
    select
      lower(btrim(q)) as query,
      replace(replace(replace(lower(btrim(q)), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') as query_pattern
  ), ranked as (
    select
      s.*,
      case
        when lower(s.primary_name) = i.query then 0
        when exists (select 1 from unnest(s.alternate_names) name where lower(name) = i.query) then 1
        when lower(s.primary_name) like i.query_pattern || '%' escape E'\\' then 2
        else 3
      end as match_rank
    from public.our_search_places s
    join public.theme_maps t on t.id=m
    cross join input i
    where t.status='published'
      and s.country_code=t.country
      and length(i.query) between 2 and 100
      and s.location operator(extensions.&&) extensions.st_makeenvelope((t.bounds->>'west')::float,(t.bounds->>'south')::float,(t.bounds->>'east')::float,(t.bounds->>'north')::float,4326)
      and (
        -- search_text starts with the primary name. The second indexed pattern
        -- reaches an alternate name after its separating space.
        s.search_text ilike i.query_pattern || '%' escape E'\\'
        or s.search_text ilike '% ' || i.query_pattern || '%' escape E'\\'
      )
  )
  select coalesce(jsonb_agg(r), '[]') from (
    select
      'overture' provider,
      s.source_id "externalId",
      s.primary_name label,
      s.address,
      s.latitude lat,
      s.longitude lng,
      s.category,
      s.locality,
      s.country_code "countryCode",
      'Overture Maps' attribution,
      case when s.match_rank <= 1 then 'exact' else 'prefix' end "matchType"
    from ranked s
    order by s.match_rank, s.source_id
    limit 10
  ) r
$$;
