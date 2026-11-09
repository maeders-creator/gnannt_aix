-- Integration fixture runs entirely inside a transaction and always rolls back.
-- It must never create persistent synthetic catalog data.
begin;
insert into public.wuerth_products(source_key,article_number,description,product_group,source_row)
values ('top-artikel-fensterbau','TEST OCI MEDIA','Synthetic transaction-only fixture','Test',999999);
set local role service_role;
do $$
declare sid uuid:=gen_random_uuid(); sid2 uuid:=gen_random_uuid(); h text:=repeat('c',64); h2 text:=repeat('d',64); result uuid; payload jsonb; snapshots jsonb;
begin
 insert into public.wuerth_oci_sessions(id,owner_hash,state_hash) values(sid,repeat('e',64),h),(sid2,repeat('e',64),h2);
 payload:='{"status":"catalog_preview","ordered":false,"priceSource":"unverified_browser_return","items":[{"index":1,"supplierArticle":"testocimedia","price":"0","currency":"EUR","priceUnit":"100","unit":"ST","quantity":"10","imageUrl":"https://media.wuerth.com/test.jpg","imageStatus":"available"},{"index":2,"supplierArticle":"TEST OCI MEDIA","price":"12.340","currency":"EUR","priceUnit":"1","unit":"ST","quantity":"3","imageUrl":null,"imageStatus":"not_supplied"},{"index":3,"materialNumber":"TEST OCI MEDIA","price":"99","priceUnit":"1"},{"index":4,"supplierArticle":"UNKNOWN-TEST-SKU","price":"88","priceUnit":"1"}]}'::jsonb;
 result:=public.wuerth_receive_cart(h,payload);
 if result is distinct from sid then raise exception 'first return failed'; end if;
 select items into snapshots from public.wuerth_product_catalog where article_number='TEST OCI MEDIA';
 if jsonb_array_length(snapshots)<>2 or snapshots->0->>'price'<>'0' or snapshots->1->>'price'<>'12.340' or snapshots->0->>'priceUnit'<>'100' then raise exception 'matching, duplicates, or price precision failed'; end if;
 if snapshots->0->>'imageUrl'<>'https://media.wuerth.com/test.jpg' then raise exception 'image preservation failed'; end if;
 result:=public.wuerth_receive_cart(h,payload);
 if result is not null then raise exception 'replay accepted'; end if;
 update public.wuerth_oci_sessions set expires_at=now()-interval '1 minute' where id=sid2;
 result:=public.wuerth_receive_cart(h2,payload);
 if result is not null then raise exception 'expired callback accepted'; end if;
 if (select source_session_id from public.wuerth_product_catalog where article_number='TEST OCI MEDIA') is distinct from sid then raise exception 'replay overwrote snapshot'; end if;
end $$;
reset role;
select 'passed: exact matching, duplicates, zero, precision, images, replay, expiry, service role' as integration_check;
rollback;
