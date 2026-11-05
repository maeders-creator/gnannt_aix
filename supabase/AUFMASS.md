# Protected Aufmaß module

## Scope and access

`aufmass-api` stores measurement headers, positions, normalized sketch strokes and compressed raster photos in `aufmass_sheets.payload`. Photos never go to the legacy public uploads bucket or receive public URLs. API responses use `Cache-Control: no-store`. No customer data is committed to the repository.

The new table has RLS enabled, no browser policies and grants revoked from `public`, `anon` and `authenticated`. Only the server-side service role receives select/insert/update. No delete operation is exposed. Existing `projects` permissions are unchanged. Read-only production inspection on 2026-11-05 confirmed `projects` and `monteur_access` have RLS enabled, no browser policies, and no anon/authenticated table grants in project `xhpwmebwvjpdhsjeyrug`. Earlier repository notes describing unrestricted legacy access are historical and do not describe this inspected deployment. Selecting/creating projects continues through the existing authenticated APIs; this change does not alter their access model.

All active internal Monteur accounts and the existing shared Planer login can read and edit all Aufmaß sheets. This matches the existing shared internal project pool; it is NOT per-customer, tenant or assigned-employee isolation. Identity is assigned server-side. Monteur credentials are checked against active token hashes on every request. Planer sessions are sent only to the same fixed trusted calculator service already used by `plannerClient.mjs`, which verifies signature and expiry before its `planner-projects` handler. A filtered read of project -1 checks authentication without retrieving customer records. If that service fails or returns an unexpected shape, access is denied. The full planner authentication implementation is not in this repository. Read-only inspection of deployed `gnannt-calculator` version 12 on 2026-11-05 confirmed HMAC signature and expiry checks before `planner-projects`; a live deliberately invalid session returned 401. Successful authentication with an actual existing user session still requires staging verification before release.

## Deployment prerequisites

1. Review migration and existing project schema. Apply the migration to the database containing `projects` and `monteur_access` (the same target as `monteur-api`). Do not use the calculator project's database merely because planner sessions are validated there.
2. Deploy `aufmass-api` using the supplied `verify_jwt=false` setting. This is intentional custom bearer authentication; the handler independently validates each request. Server service credentials must never be placed in Vite variables.
3. Set server `AUFMASS_ALLOWED_ORIGINS` to comma-separated exact approved portal/preview origins. When the variable is absent, only the three verified production aliases hardcoded in index.ts are allowed; explicitly setting it empty denies all browser origins. Do not use `*`.
4. Set frontend `VITE_AUFMASS_API_URL` to that deployed function's HTTPS URL. Missing configuration must not fall back to public project storage. No live URL is configured by this change.
5. Verify real Planer and active Monteur sessions, expired/disabled sessions, anonymous direct table requests, wrong origins, two-editor conflicts, interrupted retries and photo round-trip on staging. Re-run database advisors. The mocked unit tests do not replace these deployment checks.

## API

POST JSON `{action, ...input}` with exactly one of `x-monteur-token` or `x-planer-session`. Responses `{data}` on success, `{error}` on failure.

- `list`, optional `projectId`: up to 1,000 latest summaries. Summary `payload` has `header` only and empty `positions`; `positionCount` is provided. Fetch with `get` before editing. Photos are never loaded by the list.
- `get`, `id` UUID: full sheet `{id,projectId,version,payload,updatedAt,updatedBy,positionCount}`.
- `save`, `id` stable UUID, positive `projectId`, `version` (0 for new), `requestId` fresh UUID per save attempt, `payload:{header,positions}`. Preserve the same requestId and content when retrying an uncertain save. Successful saves return the incremented version. A reused requestId with changed content/actor or a stale version returns 409. A saved sheet cannot be moved to another project.

Header: `kunde`, `ausfuehrung` (Holz/Kunststoff), `farbe`, `glasBemerkungen`.
Positions: UUID `id`, `bezeichnung`, boolean `rollladen`, `rollladenLeisten`, `fensterbankInnen`, `fensterbankAussen`, `glasart`, `randverbundFarbe`, `zusatztext`, `stueckzahl`, `breite`, `hoehe`, `rahmenSeitlich`, `rahmenOben`, `rahmenUnten`, `nutmass`, `leibungAussenBreite`, `leibungAussenHoehe`, `leibungInnenBreite`, `leibungInnenHoehe`, `schraegmass`, `versatz`, `sketch`, `photos`.

Dimensions remain raw recorded millimetres. No deductions or order dimensions are calculated. At least one position and a positive integer Stückzahl are required. Empty draft dimension fields are accepted; filled width/height must be positive, other dimensions nonnegative except signed Versatz. Up to three decimal places accepted, decimal commas normalized. Sketch is an array of strokes, each an array of `{x,y}` in [0,1]. Photos are `{id,name,dataUrl}`, only signature-checked JPEG/PNG/WebP, never SVG or remote URLs. Limits: 50 positions, 3 photos per position, 700,000 data-URL characters each, 6 MiB entire request, 20,000 sketch points per position. For larger projects a future private asset store should replace embedded photos.

## Checks

Run `node --test tests/*.test.mjs` and `npm run build`. Backend tests cover validation, auth denial, upstream failure, byte limits, allowed origins, round-trip, idempotency, immutable project and optimistic conflict handling. New-table SQL was generated with Supabase CLI. Deployment requires explicit user authorization.

Local verification also executed this migration in an isolated PGlite/Postgres instance with `anon`, `authenticated`, and `service_role` roles: denied browser reads/writes, allowed service select/insert/update, denied delete, checked the project foreign key and stale-version update predicate. This does not verify the hosted deployment or its existing role configuration.

## Frontend behavior

The shared `AufmassApp` is available in office and Monteur navigation. Drafts stay in component memory across normal section changes, with a browser close/reload warning; there is intentionally no persistent local customer/photo cache. This is not an offline-sync implementation. Save explicitly before closing or signing out. The unconfigured build clearly labels preview mode and disables remote save/new-project creation.

New projects require customer, project name, location and responsible employee to match the existing project creation contract. The office legacy project API has no idempotent insert contract: after an uncertain project-create error the UI blocks repeat creation and asks the user to refresh/check the project pool. Aufmaß saves themselves are retry-safe and version checked. Existing sheets cannot be reassigned to another project.

Print/PDF uses the browser print dialog and dedicated print styles. It is not an automatic archived PDF attachment. The first version captures raw measures only and does not implement production approval, calculated ordering dimensions or PDF upload to a public bucket.

## Verified production targets (read-only inspection, 2026-11-05)

Supabase project: `xhpwmebwvjpdhsjeyrug` (Produktionsboard), Postgres 17, contains both `projects` (bigint primary key) and `monteur_access`; the new table/function do not yet exist. Vercel project: `gnannt-aix-83xs`, ID `prj_lXx9qX0dtpfL8qSgU0ugUtZeK4eU`, team `team_lgn6KB2HpkyY8zrUU1nakCeO`. Production deployment `dpl_4N4fL1A8JzGCz3Q2X3jFdtGfeiMH` is READY at the baseline SHA `05eeb188ee1e08e1a845a9f03bb570bdc7a0125f`. Environment-metadata access returned 403 requiring Vercel team consent; it was not bypassed. No hosted change has been performed.

## Verified deployment (2026-11-05)

Explicitly authorized release deployed `aufmass-api` version 1 ACTIVE to `xhpwmebwvjpdhsjeyrug` (Produktionsboard), at `https://xhpwmebwvjpdhsjeyrug.supabase.co/functions/v1/aufmass-api`. Both additive migrations were applied and recorded. Hosted default service-role DELETE privilege was discovered by verification and removed in the second migration; the required service SELECT/INSERT/UPDATE grants remain.

Default exact allowed origins are `https://gnannt-aix-83xs.vercel.app`, `https://gnannt-aix-83xs-maeders-9026s-projects.vercel.app`, and `https://gnannt-aix-83xs-git-main-maeders-9026s-projects.vercel.app`. An explicit server environment setting can override this list. Hosted unauthenticated POST returned 401; an unapproved origin returned 403 with no CORS grant; approved-origin preflight returned 204. The target table has RLS and no anonymous/authenticated grants. Security advisors report only the intentional informational RLS-without-policy state, consistent with service-only access: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . No new credentials or test identities were created. Actual authenticated end-to-end save/photo round-trip remains to be verified with an existing authorized user session.
