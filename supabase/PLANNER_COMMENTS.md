# Planer comments

The existing office login is the shared `Planer` account. Its comment author is
therefore `Planer`, not an inferred employee name. Personal mobile logins retain
their existing account names. The team filter remains independent of attribution.

The browser sends `planner-projects` / `comment` with project ID and comment text.
The existing `gnannt-calculator` handler validates the signed, expiring planner
session before dispatching to `plannerProjects`. No author is accepted from the
request. The service-role-only `planner_append_comment` SQL function fixes the
author and appends atomically, preserving existing history and concurrent writes.
No account, credential, table grant, or existing role scope is changed.

`functions/gnannt-calculator/planner-projects.mjs` is the tracked replacement for
that file in the deployed calculator bundle. Preserve the existing entrypoint,
authentication handler, planner credential configuration, calculator bundle and
other modules when deploying. Do not commit credential material to this repo.

Release order: apply the additive SQL migration, replace the backend module in
the existing Edge Function, then deploy the frontend through GitHub/Vercel.
Old frontend clients remain compatible. Run `node --test tests/*.test.mjs` and
`npm run build`; test invalid sessions and authors, preserved history, repeated
submission, failed saves, filters, mobile attribution and restored sessions.

Legacy planner project-detail editing still permits editing the free-text notes
field as before. This fix attributes newly appended comments; it is not a new
tamper-proof audit-log design or a replacement of that existing editing workflow.
