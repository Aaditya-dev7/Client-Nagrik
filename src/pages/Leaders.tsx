import { useEffect, useMemo, useState } from 'react'
import { isSupabaseEnabled, supabaseListReports, subscribeReports } from '@/lib/api'
import { loadReports } from '@/lib/storage'
import { Report } from '@/lib/types'
import LoadingOverlay from '@/components/LoadingOverlay'
import { Link } from 'react-router-dom'
import { t } from '@/lib/i18n'

function popularity(karma: number) {
  if (karma >= 200) return 'Legend'
  if (karma >= 100) return 'Pro'
  if (karma >= 50) return 'Active'
  return 'Newcomer'
}

export default function LeadersPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function refresh() {
      setLoading(true)
      try {
        if (isSupabaseEnabled()) {
          const supa = await supabaseListReports()
          if (mounted && supa) { setReports(supa); return }
        }
        if (mounted) setReports(loadReports())
      } finally {
        if (mounted) setLoading(false)
      }
    }
    refresh()
    let unsub = () => {}
    if (isSupabaseEnabled()) {
      unsub = subscribeReports(() => { refresh() })
    }
    return () => { mounted = false; unsub() }
  }, [])

  const leaders = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of reports) {
      const name = r.reporter?.name || 'Citizen'
      counts.set(name, (counts.get(name) || 0) + 1)
    }
    const arr = Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
      karma: count * 10,
    }))
    arr.sort((a, b) => b.karma - a.karma || b.count - a.count || a.name.localeCompare(b.name))
    return arr
  }, [reports])

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-background px-4 sm:px-6 lg:px-8 py-8">
      <LoadingOverlay show={loading} label={t('leaders.loading')} />
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t('leaders.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('leaders.subtitle')}</p>
        </header>

        <ul className="divide-y rounded-2xl border border-border bg-card overflow-hidden">
          {leaders.map((u, i) => (
            <li key={u.name} className="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-accent/60 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200 font-bold">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <Link to={`/u/${encodeURIComponent(u.name)}`} className="font-semibold text-foreground hover:text-orange-600 dark:hover:text-orange-300 truncate">
                    {u.name}
                  </Link>
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-500/10 dark:text-orange-200 dark:border-orange-500/30">
                    {popularity(u.karma)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {u.count} reports · {u.karma} karma
                </div>
              </div>
            </li>
          ))}
          {leaders.length === 0 && (
            <li className="px-6 py-8 text-sm text-muted-foreground">{t('leaders.empty')}</li>
          )}
        </ul>
      </div>
    </div>
  )
}
