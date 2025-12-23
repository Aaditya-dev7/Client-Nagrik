import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Report } from '@/lib/types'
import { loadReports } from '@/lib/storage'
import { isSupabaseEnabled, supabaseListReports, supabaseListTimelines, subscribeReports, supabaseListReportMedia } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingOverlay from '@/components/LoadingOverlay'
import { MapPin, Flag, Clock, User, Eye, Building2, BadgeCheck } from 'lucide-react'

function getPriorityClass(priority: Report['priority']) {
  switch (priority) {
    case 'Low':
      return 'bg-emerald-50 text-emerald-600'
    case 'Medium':
      return 'bg-amber-50 text-amber-700'
    case 'High':
      return 'bg-red-50 text-red-600'
    case 'Urgent':
      return 'bg-red-600 text-white'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

const statusClasses: Record<Report['status'], string> = {
  Pending: 'bg-amber-50 text-amber-700',
  'In Progress': 'bg-sky-50 text-sky-700',
  Resolved: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-rose-50 text-rose-700',
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [list, setList] = useState<Report[]>([])
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)

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
            const ids = filtered.map((r) => r.report_id)
            const [tmap, mmap] = await Promise.all([supabaseListTimelines(ids), supabaseListReportMedia(ids)])
            const withData = filtered.map((r) => ({ ...r, media: mmap[r.report_id] || r.media || [], timeline: tmap[r.report_id] || [] }))
            setList(withData)
            return
          }
        }
        if (mounted) setList(loadReports())
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

  const my = useMemo(
    () => list.filter((r) => r.reporter.name === (user?.name || 'Citizen')),
    [list, user],
  )

  const myCount = my.length
  const myKarma = myCount * 10
  const myTier = myKarma >= 200 ? 'Legend' : myKarma >= 100 ? 'Pro' : myKarma >= 50 ? 'Active' : 'Newcomer'

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-slate-50/60 px-4 sm:px-6 lg:px-8 py-8">
      <LoadingOverlay show={loading && list.length === 0} label="Loading your reports…" />
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-white border border-orange-100 shadow-sm px-6 py-5">
            <div className="text-xs text-slate-500">User</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 truncate">{user?.name || 'Citizen'}</div>
          </div>
          <div className="rounded-2xl bg-white border border-orange-100 shadow-sm px-6 py-5">
            <div className="text-xs text-slate-500">Reports submitted</div>
            <div className="mt-1 text-2xl font-extrabold text-orange-600">{myCount}</div>
          </div>
          <div className="rounded-2xl bg-white border border-orange-100 shadow-sm px-6 py-5">
            <div className="text-xs text-slate-500">Karma · Popularity</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl font-extrabold text-orange-600">{myKarma}</div>
              <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">{myTier}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {my.length === 0 && (
            <p className="text-sm text-muted-foreground">
              You have not submitted any reports yet.
            </p>
          )}

          {my.map((r) => {
            const primaryImage = r.media && r.media.length > 0 ? r.media[0] :
              'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'
            const locationTitle = (r.location_text || '').split(',')[0] || 'Unknown location'
            const lastTimeline =
              r.timeline && r.timeline.length > 0
                ? r.timeline[r.timeline.length - 1]
                : null

            return (
              <article
                key={r.report_id}
                className="overflow-hidden rounded-3xl bg-white shadow-sm border border-slate-200 flex flex-col"
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={primaryImage}
                    alt={r.summary || r.category}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col px-6 py-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 text-left">
                      <h2 className="text-lg font-semibold text-slate-900 capitalize">
                        {locationTitle.toLowerCase()}
                      </h2>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {r.location_text}
                      </p>
                      <p className="text-xs text-slate-500">Type: {r.category}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getPriorityClass(
                          r.priority,
                        )}`}
                      >
                        {r.priority.toLowerCase()}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${statusClasses[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 line-clamp-2">{r.summary}</p>

                  <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                      <div>
                        <div className="font-medium">Department</div>
                        <div className="text-slate-500">
                          {r.assigned_department || 'Not assigned yet'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <BadgeCheck className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                      <div>
                        <div className="font-medium">Officer</div>
                        <div className="text-slate-500">
                          {r.assigned_officer_name || 'Unassigned'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                      <div>
                        <div className="font-medium">Reported at</div>
                        <div className="text-slate-500">
                          {new Date(r.submitted_at).toLocaleString()}
                        </div>
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

                  <div className="space-y-1 border-t border-slate-100 pt-3 mt-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-900">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Progress timeline</span>
                    </div>
                    {lastTimeline ? (
                      <p className="text-[11px] text-slate-600">
                        Last update on {new Date(lastTimeline.at).toLocaleString()} —{' '}
                        <span className="font-semibold">{lastTimeline.actor}</span>: {lastTimeline.action}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500">No timeline updates yet.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="inline-flex items-center gap-1 rounded-full border-orange-200 text-xs text-orange-600 hover:bg-orange-50"
                      onClick={() => nav(`/reports/${r.report_id}`)}
                    >
                      <Eye className="h-3 w-3" />
                      <span>View details</span>
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
