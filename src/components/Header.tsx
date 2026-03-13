import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import ThemeToggle from '@/components/ThemeToggle'
import { useEffect, useState } from 'react'
import { Select } from '@/components/ui/select'
import { setLang as setLangGlobal, t } from '@/lib/i18n'
import { mapDbToNotification, supabaseListNotifications, subscribeNotifications } from '@/lib/api'
import type { Notification } from '@/lib/types'
import { Bell } from 'lucide-react'

export function Header() {
  const { user } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const [lang, setLang] = useState<'en' | 'hi' | 'mr'>('en')
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

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
        // Only fetch notifications for the current user, not all citizens
        const list = await supabaseListNotifications({ recipientUserId: user?.id, limit: 25 })
        if (mounted) setNotifications(list)
      } catch {}
    })()
    const unsub = subscribeNotifications((e) => {
      const row = e.row as any
      // Only add notifications meant for this specific user
      if (!row || row.recipient_user_id !== user?.id) return
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
  }, [user?.id])

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[role="menu"]') && !target.closest('button[aria-label="Notifications"]')) {
        setNotifOpen(false)
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
    ...(user ? [{ to: '/profile', label: t('nav.my_reports', 'My Reports') }] : []),
  ]

  return (
    <header className="fixed left-0 right-0 z-40 top-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
      <div className="max-w-6xl mx-auto px-3">
        <div className="rounded-full border border-border/60 bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 px-4 py-2 flex items-center justify-between transition-all duration-300">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-primary hover:opacity-90 transition-opacity">NagrikGPT</Link>
        <nav className="hidden sm:flex gap-1.5 text-sm">
          {tabs.map(t => {
            const active = loc.pathname === t.to
            return (
              <Link
                key={t.to}
                to={t.to}
                className={[
                  'px-3.5 py-2 rounded-full transition-all duration-200 font-medium',
                  active ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground/70 hover:bg-accent hover:text-foreground'
                ].join(' ')}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <Select
            value={lang}
            onChange={(e) => setLanguage(e.target.value)}
            className={[
              'h-9 rounded-full border border-border bg-background/60 text-sm',
              'px-3 pr-8 text-foreground/90 font-medium',
              'hover:bg-accent transition-colors',
              'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
              'appearance-none cursor-pointer',
              'bg-[linear-gradient(45deg,transparent_50%,hsl(var(--foreground))_50%),linear-gradient(135deg,hsl(var(--foreground))_50%,transparent_50%)]',
              'bg-[length:6px_6px,6px_6px] bg-[position:calc(100%-14px)_50%,calc(100%-10px)_50%] bg-no-repeat',
            ].join(' ')}
          options={[
            { value: 'en', label: 'EN' },
            { value: 'hi', label: 'हि' },
            { value: 'mr', label: 'मर' },
          ]}
        />
          <div className="relative">
            <button
              className="relative h-9 w-9 rounded-full border border-border bg-background/60 hover:bg-accent transition-all inline-flex items-center justify-center"
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
          {/* Profile button - simplified, no dropdown */}
          {user ? (
            <button
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-background/60 hover:bg-accent transition-all"
              onClick={() => nav('/profile')}
              type="button"
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-xs font-bold">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium text-foreground/90">{user.name}</span>
            </button>
          ) : (
            <Link to="/login" className="hidden sm:inline-flex px-4 py-2 rounded-full border border-border bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium transition-all">{t('auth.login')}</Link>
          )}
        </div>
        </div>
      </div>
    </header>
  )
}
