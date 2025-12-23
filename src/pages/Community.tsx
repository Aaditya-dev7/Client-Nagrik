import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Report } from '@/lib/types'
import { getVotes, loadReports, upvote } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseEnabled, supabaseListReports, subscribeReports, supabaseListReportMedia } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingOverlay from '@/components/LoadingOverlay'
import { ArrowUp, MessageCircle, Eye } from 'lucide-react'

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

export default function CommunityPage() {
  const [list, setList] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageSize = 10
  const { user } = useAuth()
  const nav = useNavigate()

  useEffect(() => {
    let mounted = true
    async function loadChunk(reset = false) {
      if (!mounted) return
      setLoading(true)
      try {
        if (isSupabaseEnabled()) {
          const offset = reset ? 0 : list.length
          const supa = await supabaseListReports(pageSize, offset)
          if (mounted && supa) {
            const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
            const filtered = supa.filter(r => !(r.status === 'Resolved' && new Date(r.submitted_at).getTime() < cutoff))
            const ids = filtered.map(r => r.report_id)
            const mediaMap = await supabaseListReportMedia(ids)
            const chunk = filtered.map(r => ({ ...r, media: mediaMap[r.report_id] || r.media || [] }))
            if (reset) {
              setList(chunk)
            } else {
              setList(prev => {
                const seen = new Set(prev.map(x => x.report_id))
                const merged = [...prev]
                for (const r of chunk) { if (!seen.has(r.report_id)) merged.push(r) }
                return merged
              })
            }
            setHasMore(chunk.length === pageSize)
            return
          }
        }
        if (mounted) {
          const local = loadReports()
          setList(local)
          setHasMore(false)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadChunk(true)
    let unsub = () => {}
    if (isSupabaseEnabled()) {
      unsub = subscribeReports(() => { loadChunk(true) })
    }
    return () => {
      mounted = false
      unsub()
    }
  }, [])

  const sorted = useMemo(
    () => [...list].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()),
    [list],
  )

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-orange-50/40 px-4 sm:px-6 lg:px-8 py-8">
      <LoadingOverlay show={loading && list.length === 0} label="Loading feed…" />
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Community Feed
            </h1>
          </div>
          <Button
            className="rounded-full bg-orange-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600"
            onClick={() => nav('/report')}
          >
            Report Issue
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">No reports yet. Be the first to report an issue.</p>
          )}

          {sorted.map((r) => {
            const votes = getVotes(r.report_id)
            const primaryImage = r.media && r.media.length > 0 ? r.media[0] :
              'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'
            const locationTitle = (r.location_text || '').split(',')[0] || 'Unknown location'

            return (
              <article
                key={r.report_id}
                className="overflow-hidden rounded-3xl bg-white shadow-sm border border-orange-100 flex flex-col"
              >
                <div className="relative h-52 w-full overflow-hidden">
                  <img
                    src={primaryImage}
                    alt={r.summary || r.category}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
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
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getPriorityClass(r.priority)}`}
                    >
                      {r.priority.toLowerCase()}
                    </span>
                  </div>

                  <p className="text-sm text-slate-700 line-clamp-2">{r.summary}</p>

                  <div className="mt-2 flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600 hover:bg-orange-100"
                        onClick={() => {
                          if (user) {
                            upvote(r.report_id, user.id)
                            setList(prev => [...prev])
                          }
                        }}
                      >
                        <ArrowUp className="h-3 w-3" />
                        <span>{votes}</span>
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        type="button"
                      >
                        <MessageCircle className="h-3 w-3" />
                        <span>Comment</span>
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="inline-flex items-center gap-1 rounded-full border-orange-200 text-xs text-orange-600 hover:bg-orange-50"
                      onClick={() => nav(`/reports/${r.report_id}`)}
                    >
                      <Eye className="h-3 w-3" />
                      <span>View</span>
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
        {isSupabaseEnabled() && hasMore && (
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => {
                // Load next page
                // Note: we rely on current list length as offset inside loader
                // by invoking loader without reset
                (async () => {
                  setLoading(true)
                  try {
                    const supa = await supabaseListReports(pageSize, list.length)
                    if (supa) {
                      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
                      const filtered = supa.filter(r => !(r.status === 'Resolved' && new Date(r.submitted_at).getTime() < cutoff))
                      const ids = filtered.map(r => r.report_id)
                      const mediaMap = await supabaseListReportMedia(ids)
                      const chunk = filtered.map(r => ({ ...r, media: mediaMap[r.report_id] || r.media || [] }))
                      setList(prev => {
                        const seen = new Set(prev.map(x => x.report_id))
                        const merged = [...prev]
                        for (const r of chunk) { if (!seen.has(r.report_id)) merged.push(r) }
                        return merged
                      })
                      setHasMore(chunk.length === pageSize)
                    }
                  } finally {
                    setLoading(false)
                  }
                })()
              }}
            >
              {loading ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
