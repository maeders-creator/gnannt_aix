-- Only actual OCI returns enrich existing products. These catalog snapshots are
-- private to the portal, not public quotes and not an ordering interface.
create table public.wuerth_product_catalog (
 source_key text not null,
 article_number text not null,
 items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 200 and octet_length(items::text)<=262144),
 imported_at timestamptz not null default now(),
 source_session_id uuid not null,
 primary key (source_key,article_number),
 foreign key (source_key,article_number) references public.wuerth_products(source_key,article_number)
);
alter table public.wuerth_product_catalog enable row level security;
revoke all on public.wuerth_product_catalog from public,anon,authenticated;
revoke all on public.wuerth_product_catalog from service_role;
grant select,insert,update on public.wuerth_product_catalog to service_role;

-- Replacement keeps the existing callback RPC contract. Acceptance and import
-- are one transaction: expired/replayed callbacks cannot change catalog data.
create or replace function public.wuerth_receive_cart(p_state text,p_cart jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare session_id uuid;
begin
 if p_cart is null or p_cart->>'status' is distinct from 'catalog_preview'
 or p_cart->>'ordered' is distinct from 'false'
 or p_cart->>'priceSource' is distinct from 'unverified_browser_return'
 or jsonb_typeof(p_cart->'items') is distinct from 'array' then
   raise exception 'INVALID_CART';
 end if;
 if jsonb_array_length(p_cart->'items') not between 1 and 200 then
   raise exception 'INVALID_CART';
 end if;
 update public.wuerth_oci_sessions set status='returned',cart=p_cart
 where state_hash=p_state and status='pending' and expires_at>now()
 returning id into session_id;
 if session_id is null then return null; end if;
 insert into public.wuerth_product_catalog(source_key,article_number,items,imported_at,source_session_id)
 select p.source_key,p.article_number,jsonb_agg(i.item order by i.position),now(),session_id
 from public.wuerth_products p
 join jsonb_array_elements(p_cart->'items') with ordinality as i(item,position)
 on upper(regexp_replace(p.article_number,'[[:space:]]','','g'))=upper(regexp_replace(i.item->>'supplierArticle','[[:space:]]','','g'))
 where p.source_key='top-artikel-fensterbau'
 group by p.source_key,p.article_number
 on conflict(source_key,article_number) do update
 set items=excluded.items,imported_at=excluded.imported_at,source_session_id=excluded.source_session_id
 where public.wuerth_product_catalog.imported_at<=excluded.imported_at;
 return session_id;
end $$;
revoke all on function public.wuerth_receive_cart(text,jsonb) from public,anon,authenticated;
grant execute on function public.wuerth_receive_cart(text,jsonb) to service_role;
