-- Only the existing, signed Planer-session backend may append Planer comments.
-- No author argument, access changes, or rewriting of historical notes.
create function public.planner_append_comment(p_project_id bigint, p_comment text)
returns setof public.projects
language plpgsql security invoker set search_path = '' as $$
declare
  entry text;
begin
  if p_project_id is null or p_project_id <= 0 then
    raise exception 'Invalid project';
  end if;
  if p_comment is null or length(btrim(p_comment)) = 0 or length(btrim(p_comment)) > 2000 then
    raise exception 'Invalid comment';
  end if;
  entry := '[' || to_char(now() at time zone 'Europe/Berlin', 'DD.MM.YY HH24:MI') || E' · Planer]\n' || btrim(p_comment);
  return query update public.projects
    set notiz = concat_ws(E'\n\n', nullif(notiz, ''), entry)
    where id = p_project_id returning *;
end;
$$;
revoke all on function public.planner_append_comment(bigint, text) from public, anon, authenticated;
grant execute on function public.planner_append_comment(bigint, text) to service_role;
