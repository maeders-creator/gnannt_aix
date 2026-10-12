-- Keep reopening possible on every device and across sessions, including office edits.
alter table public.projects
  add column status_before_done text,
  add column details_version bigint not null default 0,
  add column details_updated_by text,
  add column details_updated_at timestamptz;

create function public.track_project_details() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.status_before_done := old.status_before_done;
  if new.status = 'ERLEDIGT' and old.status is distinct from 'ERLEDIGT' then
    new.status_before_done := case when old.status in ('AUFMASS', 'KONSTRUKTION', 'PRODUKTION', 'MONTAGE', 'IN_ARBEIT') then old.status else 'AUFMASS' end;
  end if;
  new.details_version := old.details_version;
  new.details_updated_at := old.details_updated_at;
  if row(new.projekt, new.kunde, new.ort, new.adresse, new.telefon, new.email_kunde, new.lead, new.mitarbeiter, new.prioritaet, new.termin, new.uhrzeit)
    is distinct from row(old.projekt, old.kunde, old.ort, old.adresse, old.telefon, old.email_kunde, old.lead, old.mitarbeiter, old.prioritaet, old.termin, old.uhrzeit) then
    new.details_version := old.details_version + 1;
    new.details_updated_at := now();
    if current_user not in ('service_role', 'postgres') or new.details_updated_by is null then
      new.details_updated_by := 'Büro / Planer';
    end if;
  else
    new.details_updated_by := old.details_updated_by;
  end if;
  return new;
end;
$$;
revoke all on function public.track_project_details() from public, anon, authenticated;
create trigger track_project_details before update on public.projects
  for each row execute function public.track_project_details();
