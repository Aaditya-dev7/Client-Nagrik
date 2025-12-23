import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadReports } from '@/lib/storage'
import { isSupabaseEnabled, subscribeReports, supabaseGetReportCounts } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingOverlay from '@/components/LoadingOverlay'

export default function HomePage() {
  const nav = useNavigate()
  const [counts, setCounts] = useState({ total: 0, resolved: 0, inProgress: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function refresh() {
      setLoading(true)
      try {
        if (isSupabaseEnabled()) {
          const c = await supabaseGetReportCounts()
          if (mounted && c) { setCounts(c); return }
        }
        if (mounted) {
          const local = loadReports()
          const total = local.length
          const resolved = local.filter(r => r.status === 'Resolved').length
          const inProgress = local.filter(r => r.status === 'In Progress').length
          setCounts({ total, resolved, inProgress })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    refresh()
    let unsub = () => {}
    if (isSupabaseEnabled()) {
      unsub = subscribeReports(() => {
        refresh()
      })
    }
    return () => {
      mounted = false
      unsub()
    }
  }, [])

  const { total, resolved, inProgress } = counts

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-background flex items-center px-4 sm:px-6 lg:px-8">
      <LoadingOverlay show={loading} label="Loading overview…" />
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center space-y-10 py-10 sm:py-16">
        <section className="space-y-5">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
            <span className="block text-foreground">Empower Your Voice,</span>
            <span className="mt-1 inline-block bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
              Transform Your City
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground">
            Report civic issues instantly. Track progress in real-time. Build a better community together.
          </p>
        </section>

        <section className="flex flex-wrap justify-center gap-4">
          <Button
            className="rounded-full px-6 py-2 text-sm sm:text-base bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm"
            onClick={() => nav('/report')}
          >
            Report an Issue
          </Button>
          <Button
            variant="outline"
            className="rounded-full px-6 py-2 text-sm sm:text-base border border-border text-primary hover:bg-primary-light"
            onClick={() => nav('/community')}
          >
            View Community Feed
          </Button>
        </section>

        <section className="mt-4 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-card/80 border border-border shadow-sm px-8 py-6">
            <div className="text-4xl font-bold text-primary">{total}</div>
            <div className="mt-2 text-sm font-medium text-muted-foreground">Issues Reported</div>
          </div>
          <div className="rounded-2xl bg-card/80 border border-border shadow-sm px-8 py-6">
            <div className="text-4xl font-bold text-primary">{resolved}</div>
            <div className="mt-2 text-sm font-medium text-muted-foreground">Issues Resolved</div>
          </div>
          <div className="rounded-2xl bg-card/80 border border-border shadow-sm px-8 py-6">
            <div className="text-4xl font-bold text-primary">{inProgress}</div>
            <div className="mt-2 text-sm font-medium text-muted-foreground">In Progress</div>
          </div>
        </section>
      </div>
    </div>
  )
}
