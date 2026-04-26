# GNANNT_AIx

Vercel-ready React + TypeScript app for GNANNT_AIx.

## Setup

1. Upload/import this project to Vercel.
2. Set environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Already prefilled fallback values exist in the code, but Vercel env vars are recommended.

## Supabase

Required table: `public.projects`

Existing columns expected:
- id
- created_at
- projekt
- kunde
- ort
- gewerk
- lead
- mitarbeiter
- status
- termin
- prioritaet
- notiz
- attachment_name
- attachment_url
- push_enabled

Required Storage bucket:
- `gnannt-aix-files`

For public read + frontend upload, add storage policies if upload fails.

## URLs

Planning app:
- https://gnannt-planung.alb-stolz.de

Screen:
- https://gnannt-planung.alb-stolz.de/#screen
