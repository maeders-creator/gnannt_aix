-- Backend-only atomic append: long histories are never placed in URL filters,
-- and simultaneous comments are serialized by the row update itself.
create function public.monteur_append_comment(p_project_id bigint, p_actor_id uuid, p_comment text)
returns setof public.projects
language plpgsql security invoker set search_path = '' as $$
declare
  actor_name text;
  entry text;
begin
  select name into actor_name from public.monteur_access where id = p_actor_id and active;
  if actor_name is null then raise exception 'Invalid actor'; end if;
  if p_comment is null or length(btrim(p_comment)) = 0 or length(p_comment) > 2000 then
    raise exception 'Invalid comment';
  end if;
  entry := '[' || to_char(now() at time zone 'Europe/Berlin', 'DD.MM.YY HH24:MI') || ' · ' || actor_name || E']\n' || btrim(p_comment);
  return query update public.projects
    set notiz = concat_ws(E'\n\n', nullif(btrim(notiz), ''), entry)
    where id = p_project_id returning *;
end;
$$;
revoke all on function public.monteur_append_comment(bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.monteur_append_comment(bigint, uuid, text) to service_role;
