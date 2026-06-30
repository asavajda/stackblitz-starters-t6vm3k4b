import { createClient } from '@supabase/supabase-js'

// Client con service role key, da usare solo lato server (API routes).
// Non importare mai questo file in un componente client.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
