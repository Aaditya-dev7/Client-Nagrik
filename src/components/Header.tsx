import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function Header() {
  const { user, logout } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()

  const tabs = [
    { to: '/', label: 'Home' },
    { to: '/community', label: 'Community' },
    { to: '/profile', label: 'My Reports' },
    { to: '/leaders', label: 'Leaders' },
  ]

  return (
    <header className="fixed top-2 left-0 right-0 z-40">
      <div className="max-w-6xl mx-auto px-3">
        <div className="rounded-full border border-orange-100 bg-white/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/70 px-4 py-2 flex items-center justify-between" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <Link to="/" className="text-lg font-extrabold tracking-tight text-orange-600">NagrikGPT</Link>
        <nav className="hidden sm:flex gap-2 text-sm">
          {tabs.map(t => {
            const active = loc.pathname === t.to
            return (
              <Link
                key={t.to}
                to={t.to}
                className={[
                  'px-3 py-1.5 rounded-full transition',
                  active ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-700 hover:bg-orange-50 hover:text-orange-600'
                ].join(' ')}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-slate-700 hidden sm:inline">{user.name}</span>
              <button
                className="px-3 py-1.5 rounded-full border border-orange-200 text-orange-600 hover:bg-orange-50 text-sm"
                onClick={() => { logout(); nav('/login') }}
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="px-3 py-1.5 rounded-full border border-orange-200 text-orange-600 hover:bg-orange-50 text-sm">Login</Link>
          )}
        </div>
        </div>
      </div>
    </header>
  )
}
