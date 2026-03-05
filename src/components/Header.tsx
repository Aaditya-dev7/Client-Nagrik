import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import ThemeToggle from '@/components/ThemeToggle'
import { useEffect, useState } from 'react'
import { Select } from '@/components/ui/select'
import { setLang as setLangGlobal, t } from '@/lib/i18n'

export function Header() {
  const { user, logout } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const [lang, setLang] = useState<'en' | 'hi' | 'mr'>('en')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nagrikGPT_lang')
      if (saved === 'hi' || saved === 'mr' || saved === 'en') setLang(saved)
    } catch {}
  }, [])

  const setLanguage = (next: string) => {
    const v = (next === 'hi' || next === 'mr' || next === 'en') ? next : 'en'
    setLang(v)
    setLangGlobal(v)
  }

  const tabs = [
    { to: '/', label: t('nav.home') },
    { to: '/community', label: t('nav.community') },
    { to: '/profile', label: t('nav.my_reports') },
    { to: '/leaders', label: t('nav.leaders') },
  ]

  return (
    <header className="fixed left-0 right-0 z-40" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
      <div className="max-w-6xl mx-auto px-3">
        <div className="rounded-full border border-border bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70 px-4 py-2 flex items-center justify-between transition-colors duration-300">
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
          <div className="hidden sm:block">
            <Select
              value={lang}
              onChange={(e) => setLanguage(e.target.value)}
              className={[
                'h-9 rounded-full border border-border bg-background/40 text-sm',
                'px-3 pr-8 text-foreground/90',
                'hover:bg-primary-light transition-colors',
                'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'appearance-none cursor-pointer',
                'bg-[linear-gradient(45deg,transparent_50%,hsl(var(--foreground))_50%),linear-gradient(135deg,hsl(var(--foreground))_50%,transparent_50%)]',
                'bg-[length:6px_6px,6px_6px] bg-[position:calc(100%-14px)_50%,calc(100%-10px)_50%] bg-no-repeat',
              ].join(' ')}
              options={[
                { value: 'en', label: t('lang.english') },
                { value: 'hi', label: t('lang.hindi') },
                { value: 'mr', label: t('lang.marathi') },
              ]}
            />
          </div>
          <ThemeToggle />
          {user ? (
            <>
              <span className="text-sm text-foreground/90 hidden sm:inline">{user.name}</span>
              <button
                className="px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-primary-light text-sm"
                onClick={() => { logout(); nav('/login') }}
              >
                {t('auth.logout')}
              </button>
            </>
          ) : (
            <Link to="/login" className="px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-primary-light text-sm">{t('auth.login')}</Link>
          )}
        </div>
        </div>
      </div>
    </header>
  )
}
