-- Personal link secrets never enter source control: only their SHA-256 hashes
-- are provisioned separately. Only the authenticated backend can read them.
create table public.monteur_access (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.monteur_access enable row level security;
revoke all on public.monteur_access from public, anon, authenticated;
grant select, insert, update, delete on public.monteur_access to service_role;

alter table public.projects
  add column created_by uuid references public.monteur_access(id),
  add column created_by_name text,
  add column client_request_id uuid;
create unique index projects_creator_request_unique
  on public.projects(created_by, client_request_id)
  where client_request_id is not null;

-- Existing shared office access remains functional and is identified honestly.
-- A browser cannot impersonate a personal creator or rewrite existing history.
create function public.protect_project_creator() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_by_name := old.created_by_name;
    new.client_request_id := old.client_request_id;
    new.created_at := old.created_at;
  else
    new.created_at := now();
    if current_user in ('service_role', 'postgres') and new.created_by is not null then
      select name into new.created_by_name from public.monteur_access
        where id = new.created_by and active;
      if new.created_by_name is null then raise exception 'Invalid project creator'; end if;
    else
      new.created_by := null;
      new.created_by_name := 'Büro / Planer';
      new.client_request_id := null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_project_creator() from public, anon, authenticated;
create trigger protect_project_creator
  before insert or update on public.projects
  for each row execute function public.protect_project_creator();
