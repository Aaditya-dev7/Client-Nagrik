import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Report } from '@/lib/types'
import { getVotes, loadReports, upvote } from '@/lib/storage'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseEnabled, supabaseListReports, subscribeReports, supabaseListReportMedia } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingOverlay from '@/components/LoadingOverlay'
import { ArrowUp, MessageCircle, Eye, Filter, X } from 'lucide-react'
import { t } from '@/lib/i18n'

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

function getStatusClass(status: Report['status']) {
  switch (status) {
    case 'Pending':
      return 'bg-yellow-50 text-yellow-700'
    case 'In Progress':
      return 'bg-blue-50 text-blue-700'
    case 'Resolved':
      return 'bg-green-50 text-green-700'
    case 'Rejected':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

const CATEGORIES = ['All', 'Pothole', 'Road Damage', 'Garbage Collection', 'Illegal Dumping', 'Street Light', 'Water Leakage', 'Drainage Block', 'Tree Falling Risk', 'Sewage Overflow', 'Park Maintenance', 'Other']
const PRIORITIES = ['All', 'Low', 'Medium', 'High', 'Urgent']
const STATUSES = ['All', 'Pending', 'In Progress', 'Resolved', 'Rejected']

export default function CommunityPage() {
  const [list, setList] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageSize = 10
  const { user } = useAuth()
  const nav = useNavigate()
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

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
    () => [...list]
      .filter(r => {
        if (categoryFilter !== 'All' && r.category !== categoryFilter) return false
        if (priorityFilter !== 'All' && r.priority !== priorityFilter) return false
        if (statusFilter !== 'All' && r.status !== statusFilter) return false
        return true
      })
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()),
    [list, categoryFilter, priorityFilter, statusFilter],
  )

  const clearFilters = () => {
    setCategoryFilter('All')
    setPriorityFilter('All')
    setStatusFilter('All')
  }

  const hasActiveFilters = categoryFilter !== 'All' || priorityFilter !== 'All' || statusFilter !== 'All'

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-4 sm:px-6 lg:px-8 py-8">
      <LoadingOverlay show={loading && list.length === 0} label={t('community.loading')} />
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t('community.title')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                  {[categoryFilter, priorityFilter, statusFilter].filter(f => f !== 'All').length}
                </span>
              )}
            </Button>
            <Button
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover"
              onClick={() => nav('/report')}
            >
              {t('community.cta_report')}
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-6 p-4 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Filter Reports</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Category Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              {/* Priority Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PRIORITIES.map(pri => (
                    <option key={pri} value={pri}>{pri}</option>
                  ))}
                </select>
              </div>
              {/* Status Filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {STATUSES.map(sta => (
                    <option key={sta} value={sta}>{sta}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('community.empty')}</p>
          )}

          {sorted.map((r) => {
            const votes = getVotes(r.report_id)
            const primaryImage = r.media && r.media.length > 0 ? r.media[0] :
              'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'
            const locationTitle = (r.location_text || '').split(',')[0] || 'Unknown location'

            return (
              <article
                key={r.report_id}
                className="overflow-hidden rounded-3xl bg-card shadow-sm border border-border flex flex-col"
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-semibold text-foreground capitalize">
                          {locationTitle.toLowerCase()}
                        </h2>
                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusClass(r.status)}`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {r.location_text}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('community.type')} {r.category}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getPriorityClass(r.priority)}`}
                    >
                      {r.priority.toLowerCase()}
                    </span>
                  </div>

                  <p className="text-sm text-foreground line-clamp-2">{r.summary}</p>
                  
                  {/* Show resolution info for resolved reports */}
                  {r.status === 'Resolved' && r.timeline && (
                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Resolved</span>
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary hover:brightness-110"
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
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground/80 hover:bg-primary-light"
                        type="button"
                        onClick={() => nav(`/reports/${r.report_id}/comments`)}
                      >
                        <MessageCircle className="h-3 w-3" />
                        <span>{t('community.comment')}</span>
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="inline-flex items-center gap-1 rounded-full border-border text-xs text-primary hover:bg-primary-light"
                      onClick={() => nav(`/reports/${r.report_id}`)}
                    >
                      <Eye className="h-3 w-3" />
                      <span>{t('community.view')}</span>
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
              {loading ? t('community.loading_more') : t('community.load_more')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
