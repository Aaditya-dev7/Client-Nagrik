import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Report } from '@/lib/types'
import { isSupabaseEnabled, supabaseListReports, supabaseListTimelines, supabaseListReportMedia, subscribeReports } from '@/lib/api'
import { loadReports } from '@/lib/storage'
import { Building2, BadgeCheck, Clock, User, MapPin, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LoadingOverlay from '@/components/LoadingOverlay'

export default function ProfilePublicPage() {
  const { name } = useParams<{ name: string }>()
  const userName = decodeURIComponent(name || 'Citizen')
  const [list, setList] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    let mounted = true
    async function refresh() {
      setLoading(true)
      try {
        if (isSupabaseEnabled()) {
          const supa = await supabaseListReports()
          if (mounted && supa) {
            const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
            const filtered = supa.filter(r => !(r.status === 'Resolved' && new Date(r.submitted_at).getTime() < cutoff))
            const mine = filtered.filter(r => (r.reporter?.name || 'Citizen') === userName)
            const ids = mine.map((r) => r.report_id)
            const [tmap, mmap] = await Promise.all([supabaseListTimelines(ids), supabaseListReportMedia(ids)])
            const withData = mine.map((r) => ({ ...r, media: mmap[r.report_id] || r.media || [], timeline: tmap[r.report_id] || [] }))
            setList(withData)
            return
          }
        }
        if (mounted) setList(loadReports().filter(r => (r.reporter?.name || 'Citizen') === userName))
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
  }, [userName])

  const count = list.length
  const karma = count * 10
  const tier = karma >= 200 ? 'Legend' : karma >= 100 ? 'Pro' : karma >= 50 ? 'Active' : 'Newcomer'

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-slate-50/60 px-4 sm:px-6 lg:px-8 py-8">
      <LoadingOverlay show={loading && list.length === 0} label={`Loading ${userName}'s reports…`} />
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{userName}</h1>
            <p className="text-sm text-slate-600 mt-1">{count} reports · {karma} karma · {tier}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => nav(-1)}>Back</Button>
            <Link to="/leaders" className="text-sm text-orange-600 hover:underline">View leaderboard</Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">No reports found.</p>
          )}
          {list.map((r) => (
            <article key={r.report_id} className="overflow-hidden rounded-3xl bg-white shadow-sm border border-slate-200 flex flex-col">
              <div className="relative h-48 w-full overflow-hidden">
                <img src={(r.media && r.media[0]) || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'} alt={r.summary || r.category} className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col px-6 py-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 text-left">
                    <h2 className="text-lg font-semibold text-slate-900 line-clamp-2">{r.summary}</h2>
                    <p className="text-xs text-slate-500 line-clamp-1">{r.location_text}</p>
                  </div>
                </div>
                <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                    <div>
                      <div className="font-medium">Department</div>
                      <div className="text-slate-500">{r.assigned_department || 'Not assigned yet'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                    <div>
                      <div className="font-medium">Officer</div>
                      <div className="text-slate-500">{r.assigned_officer_name || 'Unassigned'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                    <div>
                      <div className="font-medium">Reported at</div>
                      <div className="text-slate-500">{new Date(r.submitted_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                    <div>
                      <div className="font-medium">Reporter</div>
                      <div className="text-slate-500">{r.reporter.name}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end pt-2">
                  <Button type="button" variant="outline" className="inline-flex items-center gap-1 rounded-full border-orange-200 text-xs text-orange-600 hover:bg-orange-50" onClick={() => nav(`/reports/${r.report_id}`)}>
                    <Eye className="h-3 w-3" />
                    <span>View details</span>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
