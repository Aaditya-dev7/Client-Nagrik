import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login, register } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    try {
      if (mode === 'login') await login(email, password)
      else await register(name, email, password)
      nav('/report')
    } catch (e:any) {
      setErr(e.message || 'Failed')
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-card border rounded animate-fade-in">
      <h1 className="text-xl font-semibold mb-4">{mode === 'login' ? 'Login' : 'Register'}</h1>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <div>
            <label className="text-sm">Name</label>
            <input className="w-full mt-1 border rounded px-3 py-2 bg-background" value={name} onChange={e=>setName(e.target.value)} required />
          </div>
        )}
        <div>
          <label className="text-sm">Email</label>
          <input className="w-full mt-1 border rounded px-3 py-2 bg-background" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm">Password</label>
          <input className="w-full mt-1 border rounded px-3 py-2 bg-background" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        {err && <p className="text-destructive text-sm">{err}</p>}
        <button className="w-full bg-primary text-primary-foreground rounded py-2">{mode === 'login' ? 'Login' : 'Register'}</button>
      </form>
      <div className="text-sm mt-3">
        {mode === 'login' ? (
          <button className="underline" onClick={()=>setMode('register')}>Need an account? Register</button>
        ) : (
          <button className="underline" onClick={()=>setMode('login')}>Have an account? Login</button>
        )}
      </div>
    </div>
  )
}
