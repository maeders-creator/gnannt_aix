-- New temporary, service-only data. No existing table or credential changes.
create table public.wuerth_oci_sessions (
 id uuid primary key,
 owner_hash text not null check (owner_hash ~ '^[0-9a-f]{64}$'),
 state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'pending' check (status in ('pending','returned')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '15 minutes',
 cart jsonb check (cart is null or octet_length(cart::text)<=262144)
);
alter table public.wuerth_oci_sessions enable row level security;
revoke all on public.wuerth_oci_sessions from public,anon,authenticated;
grant select,insert,update,delete on public.wuerth_oci_sessions to service_role;
create index wuerth_oci_owner_created on public.wuerth_oci_sessions(owner_hash,created_at);

create function public.wuerth_create_session(p_id uuid,p_owner text,p_state text)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare expiry timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('wuerth_oci_launch',0));
 if (select count(*) from public.wuerth_oci_sessions where owner_hash=p_owner and created_at>now()-interval '1 minute')>=5
 or (select count(*) from public.wuerth_oci_sessions where created_at>now()-interval '1 hour')>=100 then
   raise exception 'RATE_LIMIT';
 end if;
 delete from public.wuerth_oci_sessions where expires_at<now()-interval '24 hours';
 insert into public.wuerth_oci_sessions(id,owner_hash,state_hash) values(p_id,p_owner,p_state) returning expires_at into expiry;
 return expiry;
end $$;
revoke all on function public.wuerth_create_session(uuid,text,text) from public,anon,authenticated;
grant execute on function public.wuerth_create_session(uuid,text,text) to service_role;

create function public.wuerth_receive_cart(p_state text,p_cart jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare session_id uuid;
begin
 if p_cart is null or p_cart->>'status' is distinct from 'catalog_preview'
 or p_cart->>'ordered' is distinct from 'false'
 or p_cart->>'priceSource' is distinct from 'unverified_browser_return' then
   raise exception 'INVALID_CART';
 end if;
 update public.wuerth_oci_sessions set status='returned',cart=p_cart
 where state_hash=p_state and status='pending' and expires_at>now()
 returning id into session_id;
 return session_id;
end $$;
revoke all on function public.wuerth_receive_cart(text,jsonb) from public,anon,authenticated;
grant execute on function public.wuerth_receive_cart(text,jsonb) to service_role;
