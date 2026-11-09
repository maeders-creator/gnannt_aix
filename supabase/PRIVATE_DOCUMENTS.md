# Private portal documents

Uploaded document bytes are served by the same planner session and active installer token checks as the portal. No reusable signed download URL is returned. Storage remains in the existing `uploads` bucket; the public-looking database URLs are stable identifiers only, and cannot be fetched once the bucket is private.

## Production activation (requires approval)

1. Back up both deployed Edge Functions, storage bucket/policy metadata, Hub records and project attachment references. Download every existing object and record its SHA-256 and byte length. Backups contain data and must not be committed to the public repository.
2. Deploy backend download handlers and authenticated project upload support while retaining all current function files/secrets and auth checks.
3. Deploy the frontend. Test current planner and installer logins, downloads and project uploads. No new accounts or credentials are needed.
4. In one database migration, mark uploads non-public and remove its anonymous upload/cleanup policies. No existing objects are removed or renamed.
5. Verify exact old public object URLs, anonymous authenticated-object URLs, and anonymous insert requests are denied, including cached URLs. Verify authorized downloads match every backed-up hash. Verify revoked/expired sessions are denied.
6. Upload the three requested PDFs through the authenticated planner flow, category Montage Akademie; verify no duplicate records and exact original bytes.

## Storage activation SQL

```sql
begin;
update storage.buckets set public = false where id = 'uploads';
drop policy if exists gnannt_insert_uploads on storage.objects;
drop policy if exists gnannt_test_cleanup_read on storage.objects;
drop policy if exists gnannt_test_cleanup_delete on storage.objects;
commit;
```

This intentionally denies raw anonymous and generic Supabase-authenticated storage operations. Existing planner and installer identities use server-side checks. The project currently has no Supabase Auth users.

## Recovery

Keep the bucket private. If the frontend has a defect, fix forward or restore a compatible private-download frontend/backend. Restoring public access would re-expose documents and requires a new explicit approval. Files remain recoverable in place and in the verified offline backup. Database rows and original functions are backed up. Do not permanently delete anything as part of this change.

External publisher/video originals remain under their owners' access controls; moving the portal catalog behind login cannot revoke those external URLs.
