# Personal mobile access

The `#monteur=<token>` route opens the mobile app. Each employee receives a
cryptographically random 32-byte base64url token. Tokens are not stored in this
repository or in plaintext in the database. `monteur_access` contains only a
SHA-256 digest, name, ID and active flag. RLS is enabled; browser roles have no
privileges on this table. Disable an individual link by setting its `active`
flag to false. Rotate by replacing its hash and issuing a new personal link.

The Edge Function verifies the personal token on every request before using its
server-only Supabase key. JWT gateway verification is disabled deliberately:
this endpoint uses custom bearer-link authentication, not Supabase Auth JWTs.
Only the explicit list/create/comment/complete/undo actions are accepted.
Creator and comment names come from the validated account. Request IDs prevent
duplicate creation after a lost response. The backend-only comment function
appends atomically, including when a history is too long for URL filters.

Project creator fields and creation time are immutable on update. Inserts from
the existing shared office client are marked `Büro / Planer`; historical rows
retain an unknown creator. The mobile UI must never let an employee choose or
edit the author field.

## Existing access limitation

The pre-existing `projects` and `knowledge_docs` tables do not have RLS and the
office app uses shared local login. This release does not claim to replace
that access model. Personal tokens are protected and attribution cannot be
forged through those browser roles, but the underlying legacy project API
still permits direct data access. Replacing it requires migrating the office,
screen, document and offline-queue flows together before restricting grants.

## Install on a phone

The mobile manifest deliberately omits `start_url` so the browser uses the
installing document URL, including its personal fragment. Keep the fragment
while installing, which also supports a fresh standalone storage context on
iOS. It is not transmitted in an HTTP request or referrer. The app remembers
access on the user's device. The installer link is a credential and should be
shared only with its intended employee. Signing out removes local access; a
saved personal shortcut can still sign in until its token is revoked.

## Verification

Run `node --test tests/*.test.mjs` and `npm run build`. Check a personal link,
the three-step flow, creator attribution, comment append, completion/undo and
the home-screen instructions. Test duplicate creation with the same request ID,
unknown and disabled links, and public attempts to read access tokens or invoke
the backend-only comment RPC. Never put personal URLs in screenshots or test
fixtures committed to GitHub.
