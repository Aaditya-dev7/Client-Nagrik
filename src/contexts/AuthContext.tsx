import React, { createContext, useContext, useEffect, useState } from 'react'
import { getSupabase, resetSupabaseClient } from '@/lib/supabase'
import { getCitizenSiteUrl } from '@/lib/api'

type User = { id: string; name: string; email: string; phone?: string }

type AuthContextType = {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string, keepMeSignedIn?: boolean) => Promise<void>
  register: (name: string, email: string, password: string, phone?: string) => Promise<{ needsEmailConfirmation: boolean }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function mapSupabaseUser(u: any): User {
  const md = (u?.user_metadata || {}) as any
  return {
    id: String(u?.id || ''),
    email: String(u?.email || ''),
    name: String(md?.full_name || md?.name || (u?.email ? String(u.email).split('@')[0] : 'Citizen')),
    phone: typeof md?.phone === 'string' ? md.phone : undefined,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [clientSeed, setClientSeed] = useState(0)

  const reinitClient = () => {
    resetSupabaseClient()
    setClientSeed((s) => s + 1)
  }

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      if (!cancelled) setIsLoading(true)
      try {
        const { data } = await sb.auth.getSession()
        const u = data?.session?.user
        if (!cancelled) setUser(u ? mapSupabaseUser(u) : null)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null
      setUser(u ? mapSupabaseUser(u) : null)
    })

    return () => {
      cancelled = true
      try { sub?.subscription?.unsubscribe() } catch {}
    }
  }, [clientSeed])

  // Enable push notifications only when logged in
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const mod = await import('@/lib/notifications')
        if (cancelled) return

        if (user) {
          await mod.subscribeToPushNotifications()
        } else {
          await mod.unsubscribeFromPushNotifications()
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [user?.id])

  const login = async (email: string, password: string, keepMeSignedIn: boolean = true) => {
    // Store session preference BEFORE auth so the Supabase client uses the correct storage.
    // Then reset the client so subsequent getSupabase() re-creates the client using the new storage.
    if (!keepMeSignedIn) {
      try { sessionStorage.setItem('nagrikGPT_session_only', 'true') } catch {}
    } else {
      try { sessionStorage.removeItem('nagrikGPT_session_only') } catch {}
    }

    reinitClient()

    const sb = getSupabase()
    if (!sb) throw new Error('Supabase is not configured')

    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message || 'Login failed')

    // Set user immediately to prevent UI from briefly redirecting to /login.
    const au = data?.user
    if (au) setUser(mapSupabaseUser(au))
  }

  const register = async (name: string, email: string, password: string, phone?: string) => {
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase is not configured')
    
    // Get citizen site URL from database config
    const citizenUrl = await getCitizenSiteUrl()
    
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone: phone || null,
        },
        // Use citizen site URL from database config for redirect
        emailRedirectTo: `${citizenUrl}/login`,
      }
    })
    
    if (error) {
      // Handle rate limit errors gracefully
      const msg = error.message.toLowerCase()
      if (msg.includes('rate') || msg.includes('email') && msg.includes('exceed')) {
        throw new Error('Too many requests. Please wait a few minutes and try again.')
      }
      throw new Error(error.message || 'Registration failed')
    }

    // With email confirmation enabled, Supabase typically returns user but no session.
    // Do NOT log in yet; user must confirm email and then sign in.
    const needsEmailConfirmation = !data?.session
    return { needsEmailConfirmation }
  }

  const logout = async () => {
    const sb = getSupabase()
    const storageKey = 'gov_nagrik_citizen_auth'

    const clearStorageKeys = (st: Storage | null) => {
      if (!st) return
      try {
        const keys: string[] = []
        for (let i = 0; i < st.length; i++) {
          const k = st.key(i)
          if (k) keys.push(k)
        }
        for (const k of keys) {
          if (k === storageKey || k.includes(storageKey)) {
            try { st.removeItem(k) } catch {}
          }
        }
      } catch {}
    }

    // Immediately clear local state so the UI can navigate away without waiting on network.
    setUser(null)

    // Disable push notifications on logout
    try {
      const mod = await import('@/lib/notifications')
      await mod.unsubscribeFromPushNotifications()
    } catch {}

    // Attempt Supabase signOut, but never block the UI indefinitely.
    try {
      await Promise.race([
        sb?.auth.signOut() as any,
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ])
    } catch {}

    // Clear session preference
    try { sessionStorage.removeItem('nagrikGPT_session_only') } catch {}

    // Clear any persisted Supabase auth tokens to avoid phantom sessions.
    clearStorageKeys(localStorage)
    clearStorageKeys(sessionStorage)

    // Reset the singleton client so the next page does not reuse stale auth state.
    // Also forces our auth listener to re-subscribe against the new client instance.
    reinitClient()
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
