import React, { createContext, useContext, useState } from 'react'

type User = { id: string; name: string; email: string }

type AuthContextType = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function uid() { return Math.random().toString(36).slice(2, 10) }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Hydrate auth state synchronously so route guards don't briefly see user as null on page refresh.
    try {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem('cc:user')
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })

  const login = async (email: string, _password: string) => {
    const raw = localStorage.getItem('cc:users')
    const users = raw ? (JSON.parse(raw) as User[]) : []
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (!found) throw new Error('Account not found. Please register.')
    setUser(found)
    localStorage.setItem('cc:user', JSON.stringify(found))
  }

  const register = async (name: string, email: string, _password: string) => {
    const raw = localStorage.getItem('cc:users')
    const users = raw ? (JSON.parse(raw) as User[]) : []
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) throw new Error('Email already exists')
    const newUser: User = { id: uid(), name, email }
    users.push(newUser)
    localStorage.setItem('cc:users', JSON.stringify(users))
    setUser(newUser)
    localStorage.setItem('cc:user', JSON.stringify(newUser))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('cc:user')
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
