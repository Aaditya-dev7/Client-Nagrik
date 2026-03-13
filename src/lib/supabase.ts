import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let lastStorage: 'local' | 'session' | null = null

export function isSupabaseEnabled(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
}

// Reset client to allow storage preference change to take effect
export function resetSupabaseClient(): void {
  client = null
  lastStorage = null
}

export function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  // ✅ Build-time safe guard
  if (!url || !key) {
    return null
  }

  if (!client) {
    const sessionOnly = (() => {
      try { return sessionStorage.getItem('nagrikGPT_session_only') === 'true' } catch { return false }
    })()
    const desired: 'local' | 'session' = sessionOnly ? 'session' : 'local'
    lastStorage = desired
    client = createClient(url, key, {
      auth: {
        // Prevent conflicts when citizen + admin/officer apps are open in the same browser
        storageKey: 'gov_nagrik_citizen_auth',
        storage: sessionOnly ? sessionStorage : localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }

  // If the user toggles "Keep me signed in", recreate the client with the right storage.
  // (Supabase auth persistence is decided at client creation time.)
  try {
    const sessionOnly = sessionStorage.getItem('nagrikGPT_session_only') === 'true'
    const desired: 'local' | 'session' = sessionOnly ? 'session' : 'local'
    if (client && lastStorage && desired !== lastStorage) {
      client = createClient(url!, key!, {
        auth: {
          storageKey: 'gov_nagrik_citizen_auth',
          storage: sessionOnly ? sessionStorage : localStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
      lastStorage = desired
    }
  } catch {}

  return client
}
