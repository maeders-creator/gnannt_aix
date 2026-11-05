-- Supabase hosted default grants include DELETE; retain only required operations.
revoke all on public.aufmass_sheets from service_role;
grant select, insert, update on public.aufmass_sheets to service_role;
