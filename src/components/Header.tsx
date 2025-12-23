import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import ThemeToggle from '@/components/ThemeToggle'

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
        <div className="rounded-full border border-border bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70 px-4 py-2 flex items-center justify-between" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <Link to="/" className="text-lg font-extrabold tracking-tight text-primary">NagrikGPT</Link>
        <nav className="hidden sm:flex gap-2 text-sm">
          {tabs.map(t => {
            const active = loc.pathname === t.to
            return (
              <Link
                key={t.to}
                to={t.to}
                className={[
                  'px-3 py-1.5 rounded-full transition',
                  active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/80 hover:bg-primary-light hover:text-foreground'
                ].join(' ')}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <>
              <span className="text-sm text-foreground/90 hidden sm:inline">{user.name}</span>
              <button
                className="px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-primary-light text-sm"
                onClick={() => { logout(); nav('/login') }}
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-primary-light text-sm">Login</Link>
          )}
        </div>
        </div>
      </div>
    </header>
  )
}
