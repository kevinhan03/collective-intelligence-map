-- Place-name matches are useful for contribution flows; broad address/category
-- matches are not. Rank exact and prefix matches first, and only retain strong
-- name similarity as an expandable related result.
create or replace function public.search_overture_places(q text,m uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  with input as (
    select lower(btrim(q)) as query
  ), ranked as (
    select
      s.*,
      case
        when lower(s.primary_name) = i.query then 0
        when exists (select 1 from unnest(s.alternate_names) name where lower(name) = i.query) then 1
        when lower(s.primary_name) like i.query || '%' then 2
        when exists (select 1 from unnest(s.alternate_names) name where lower(name) like i.query || '%') then 3
        else 4
      end as match_rank,
      greatest(
        extensions.similarity(lower(s.primary_name), i.query),
        coalesce((select max(extensions.similarity(lower(name), i.query)) from unnest(s.alternate_names) name), 0)
      ) as name_similarity
    from public.our_search_places s
    join public.theme_maps t on t.id=m
    cross join input i
    where t.status='published'
      and s.country_code=t.country
      and length(i.query) between 3 and 100
      and s.location operator(extensions.&&) extensions.st_makeenvelope((t.bounds->>'west')::float,(t.bounds->>'south')::float,(t.bounds->>'east')::float,(t.bounds->>'north')::float,4326)
      and (
        lower(s.primary_name) = i.query
        or lower(s.primary_name) like i.query || '%'
        or exists (select 1 from unnest(s.alternate_names) name where lower(name) = i.query or lower(name) like i.query || '%')
        or extensions.similarity(lower(s.primary_name), i.query) >= 0.55
        or exists (select 1 from unnest(s.alternate_names) name where extensions.similarity(lower(name), i.query) >= 0.55)
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
      case when s.match_rank <= 1 then 'exact' when s.match_rank <= 3 then 'prefix' else 'similar' end "matchType"
    from ranked s
    order by s.match_rank, s.name_similarity desc, s.source_id
    limit 10
  ) r
$$;
