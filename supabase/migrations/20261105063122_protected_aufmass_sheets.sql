-- Run only after review on the same database as projects and monteur_access.
-- No changes to existing project permissions or public attachment storage.
begin;
create table public.aufmass_sheets (
  id uuid primary key,
  project_id bigint not null references public.projects(id) on delete restrict,
  version integer not null check (version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 6291456),
  position_count integer not null check (position_count between 0 and 50),
  last_request_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by text not null,
  updated_by text not null,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index aufmass_sheets_project_updated_idx on public.aufmass_sheets(project_id, updated_at desc);
create index aufmass_sheets_updated_idx on public.aufmass_sheets(updated_at desc);
alter table public.aufmass_sheets enable row level security;
-- Deliberately no browser policies: authenticated custom staff access is checked
-- by aufmass-api before its server-side service client reaches this table.
revoke all on public.aufmass_sheets from public, anon, authenticated;
grant select, insert, update on public.aufmass_sheets to service_role;
commit;
