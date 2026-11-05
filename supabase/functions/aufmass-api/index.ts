import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { createHandler } from './handler.mjs'
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
const db = createClient(Deno.env.get('SUPABASE_URL')!, secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
// Exact verified production aliases only; an explicit environment setting overrides them.
const productionOrigins = 'https://gnannt-aix-83xs.vercel.app,https://gnannt-aix-83xs-maeders-9026s-projects.vercel.app,https://gnannt-aix-83xs-git-main-maeders-9026s-projects.vercel.app'
const allowedOrigins = (Deno.env.get('AUFMASS_ALLOWED_ORIGINS') ?? productionOrigins).split(',').map(s => s.trim()).filter(Boolean)
Deno.serve(createHandler(db, { allowedOrigins }))
