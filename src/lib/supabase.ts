import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function isSupabaseEnabled(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
}

export function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  // ✅ Build-time safe guard
  if (!url || !key) {
    return null
  }

  if (!client) {
    client = createClient(url, key, {
      auth: {
        // Prevent conflicts when citizen + admin/officer apps are open in the same browser
        storageKey: 'gov_nagrik_citizen_auth',
      },
    })
  }

  return client
}
