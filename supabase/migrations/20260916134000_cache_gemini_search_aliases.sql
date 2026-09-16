-- Cache only search-query translations. Overture place records remain unchanged.
create table public.search_query_aliases (
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  normalized_query text not null check (length(normalized_query) between 2 and 100),
  japanese_queries text[] not null default '{}'::text[] check (cardinality(japanese_queries) <= 6),
  generator text not null default 'gemini',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (country_code, normalized_query)
);

alter table public.search_query_aliases enable row level security;
revoke all on public.search_query_aliases from public, anon, authenticated;
grant select, insert, update on public.search_query_aliases to service_role;
