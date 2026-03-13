import React, { createContext, useContext, useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

type User = { id: string; name: string; email: string; phone?: string }

type AuthContextType = {
  user: User | null
  login: (email: string, password: string, keepMeSignedIn?: boolean) => Promise<void>
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>
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

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) return

    let cancelled = false
    ;(async () => {
      try {
        const { data } = await sb.auth.getSession()
        const u = data?.session?.user
        if (!cancelled) setUser(u ? mapSupabaseUser(u) : null)
      } catch {
        if (!cancelled) setUser(null)
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
  }, [])

  const login = async (email: string, password: string, keepMeSignedIn: boolean = true) => {
    // Store session preference BEFORE auth so the Supabase client uses the correct storage.
    if (!keepMeSignedIn) {
      try { sessionStorage.setItem('nagrikGPT_session_only', 'true') } catch {}
    } else {
      try { sessionStorage.removeItem('nagrikGPT_session_only') } catch {}
    }

    const sb = getSupabase()
    if (!sb) throw new Error('Supabase is not configured')

    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message || 'Login failed')
  }

  const register = async (name: string, email: string, password: string, phone?: string) => {
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase is not configured')
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://aaditya-dev7.github.io/Client-Nagrik/login',
        data: {
          full_name: name,
          phone: phone || null,
        }
      }
    })
    if (error) throw new Error(error.message || 'Registration failed')
  }

  const logout = async () => {
    const sb = getSupabase()
    if (!sb) {
      setUser(null)
      return
    }
    await sb.auth.signOut()
    setUser(null)
    // Clear session preference
    try {
      sessionStorage.removeItem('nagrikGPT_session_only')
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
