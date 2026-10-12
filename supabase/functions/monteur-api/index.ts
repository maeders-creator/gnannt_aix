import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { createHandler } from './handler.mjs'

// The gateway's JWT check is disabled because the handler verifies a unique,
// revocable 256-bit personal access token before every operation.
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
const db = createClient(Deno.env.get('SUPABASE_URL')!, secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false }
})
Deno.serve(createHandler(db))
