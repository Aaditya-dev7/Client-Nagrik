import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import ThemeToggle from '@/components/ThemeToggle'
import { useEffect, useState, useRef } from 'react'
import { Select } from '@/components/ui/select'
import { setLang as setLangGlobal, t } from '@/lib/i18n'
import { mapDbToNotification, supabaseListNotifications, subscribeNotifications } from '@/lib/api'
import type { Notification } from '@/lib/types'
import { Bell, User, FileText, LogOut, ChevronDown } from 'lucide-react'

export function Header() {
  const { user, logout } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const [lang, setLang] = useState<'en' | 'hi' | 'mr'>('en')
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nagrikGPT_lang')
      if (saved === 'hi' || saved === 'mr' || saved === 'en') setLang(saved)
    } catch {}
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const list = await supabaseListNotifications({ recipientRole: 'citizen', limit: 25 })
        if (mounted) setNotifications(list)
      } catch {}
    })()
    const unsub = subscribeNotifications((e) => {
      const row = e.row as any
      if (!row || row.recipient_role !== 'citizen') return
      const mapped = mapDbToNotification(row)
      setNotifications((prev) => {
        if (e.type === 'insert') return [mapped, ...prev.filter(n => n.id !== mapped.id)]
        if (e.type === 'update') return prev.map(n => n.id === mapped.id ? mapped : n)
        if (e.type === 'delete') return prev.filter(n => n.id !== mapped.id)
        return prev
      })
    })
    return () => {
      mounted = false
      try { unsub() } catch {}
    }
  }, [])

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      const sb = (await import('@/lib/supabase')).getSupabase()
      if (sb) await sb.from('notifications').update({ read: true }).eq('id', id)
    } catch {}
  }

  const setLanguage = (next: string) => {
    const v = (next === 'hi' || next === 'mr' || next === 'en') ? next : 'en'
    setLang(v)
    setLangGlobal(v)
  }

  const tabs = [
    { to: '/', label: t('nav.home') },
    { to: '/community', label: t('nav.community') },
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
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language selector - visible on mobile too */}
          <Select
            value={lang}
            onChange={(e) => setLanguage(e.target.value)}
            className={[
              'h-8 sm:h-9 rounded-full border border-border bg-background/40 text-xs sm:text-sm',
            'px-2 sm:px-3 pr-6 sm:pr-8 text-foreground/90',
            'hover:bg-primary-light transition-colors',
            'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'appearance-none cursor-pointer',
            'bg-[linear-gradient(45deg,transparent_50%,hsl(var(--foreground))_50%),linear-gradient(135deg,hsl(var(--foreground))_50%,transparent_50%)]',
            'bg-[length:5px_5px,5px_5px] sm:bg-[length:6px_6px,6px_6px] bg-[position:calc(100%-10px)_50%,calc(100%-8px)_50%] sm:bg-[position:calc(100%-14px)_50%,calc(100%-10px)_50%] bg-no-repeat',
          ].join(' ')}
        options={[
          { value: 'en', label: 'EN' },
          { value: 'hi', label: 'हि' },
          { value: 'mr', label: 'मर' },
        ]}
      />
          <div className="relative">
            <button
              className="relative h-9 w-9 rounded-full border border-border bg-background/40 hover:bg-primary-light transition-colors inline-flex items-center justify-center"
              onClick={() => setNotifOpen(v => !v)}
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={notifOpen}
              type="button"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-destructive text-destructive-foreground text-[11px] font-semibold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-lg shadow-lg" role="menu">
                <div className="p-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold">{t('common.notifications', 'Notifications')}</h3>
                  <button
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"
                    onClick={() => setNotifOpen(false)}
                    type="button"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-muted-foreground text-sm">
                      {t('common.no_notifications', 'No notifications')}
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={[
                          'w-full text-left p-3 transition-colors border-b last:border-0',
                          !n.read ? 'bg-primary-light' : 'bg-transparent',
                          'hover:bg-accent'
                        ].join(' ')}
                        onClick={() => {
                          markRead(n.id)
                          setNotifOpen(false)
                          nav(`/reports/${n.report_id}`)
                        }}
                      >
                        <div className="text-sm mb-1">{n.message}</div>
                        <div className="text-xs text-muted-foreground">{new Date(n.timestamp).toLocaleString()}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <ThemeToggle />
          {/* Profile dropdown for desktop - contains My Reports and Logout */}
          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background/40 hover:bg-primary-light text-sm transition-colors"
                onClick={() => setProfileOpen(v => !v)}
                type="button"
              >
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-xs font-bold">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="text-foreground/90">{user.name}</span>
                <ChevronDown className={['h-3 w-3 transition-transform', profileOpen ? 'rotate-180' : ''].join(' ')} />
              </button>
              
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-popover border rounded-lg shadow-lg z-50" role="menu">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent transition-colors rounded-t-lg"
                    onClick={() => { setProfileOpen(false); nav('/profile') }}
                  >
                    <FileText className="h-4 w-4" />
                    {t('nav.my_reports', 'My Reports')}
                  </button>
                  <div className="border-t" />
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors rounded-b-lg"
                    onClick={() => { setProfileOpen(false); logout(); nav('/login') }}
                  >
                    <LogOut className="h-4 w-4" />
                    {t('auth.logout', 'Logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="hidden sm:inline-flex px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-primary-light text-sm">{t('auth.login')}</Link>
          )}
        </div>
        </div>
      </div>
    </header>
  )
}
