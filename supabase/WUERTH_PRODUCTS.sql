-- Private product reference data. Imported spreadsheet rows are not in git.
-- The authenticated wuerth-oci function is the only portal read path.
create table public.wuerth_products (
  source_key text not null,
  article_number text not null check (length(article_number) between 1 and 40),
  description text not null check (length(description) between 1 and 300),
  product_group text not null check (length(product_group) between 1 and 120),
  source_row integer not null check (source_row > 0),
  imported_at timestamptz not null default now(),
  primary key (source_key, article_number)
);
alter table public.wuerth_products enable row level security;
revoke all on public.wuerth_products from public, anon, authenticated;
revoke all on public.wuerth_products from service_role;
grant select on public.wuerth_products to service_role;
create index wuerth_products_group on public.wuerth_products(source_key, product_group);
