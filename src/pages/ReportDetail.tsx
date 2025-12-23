import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Report } from '@/lib/types'
import { loadReports } from '@/lib/storage'
import { isSupabaseEnabled, supabaseGetReportById, supabaseListTimelines, subscribeReports, supabaseListReportMedia } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingOverlay from '@/components/LoadingOverlay'
import { ArrowLeft, MapPin, Flag, Clock, User, AlertTriangle, Building2, Phone, Mail } from 'lucide-react'

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function refresh() {
      if (!id) return
      setLoading(true)
      try {
        if (isSupabaseEnabled()) {
          const found = await supabaseGetReportById(id)
          if (mounted) {
            if (found) {
              const tmap = await supabaseListTimelines([id])
              const mmap = await supabaseListReportMedia([id])
              setReport({ ...found, media: mmap[id] || found.media || [], timeline: tmap[id] || [] })
            } else {
              setReport(null)
            }
            return
          }
        }

        if (mounted) {
          const local = loadReports().find((r) => r.report_id === id) || null
          setReport(local)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (id) {
      refresh()
      let unsub = () => {}
      let poll: any = null
      if (isSupabaseEnabled()) {
        unsub = subscribeReports(() => { refresh() })
      }
      // Poll every 10s as a fallback to ensure UI stays up to date
      poll = setInterval(() => { refresh() }, 10000)
      return () => {
        mounted = false
        unsub()
        if (poll) clearInterval(poll)
      }
    }
  }, [id])

  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)]">
        <LoadingOverlay show label="Loading report…" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="max-w-3xl mx-auto py-10 space-y-4">
        <Button variant="outline" className="inline-flex items-center gap-1" onClick={() => nav(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <p className="text-sm text-muted-foreground">Report not found. It may have been removed.</p>
      </div>
    )
  }

  const statusClasses: Record<Report['status'], string> = {
    Pending: 'bg-amber-50 text-amber-700',
    'In Progress': 'bg-sky-50 text-sky-700',
    Resolved: 'bg-emerald-50 text-emerald-700',
    Rejected: 'bg-rose-50 text-rose-700',
  }

  const progress = (() => {
    switch (report.status) {
      case 'Pending':
        return 25
      case 'In Progress':
        return 65
      case 'Resolved':
        return 100
      case 'Rejected':
        return 100
      default:
        return 0
    }
  })()

  const primaryImage = report.media && report.media.length > 0 ? report.media[0] :
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="outline" className="inline-flex items-center gap-1" onClick={() => nav(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back to Community
        </Button>

        <article className="overflow-hidden rounded-3xl bg-white shadow-sm border border-slate-200">
          <div className="h-64 w-full overflow-hidden">
            <img src={primaryImage} alt={report.summary || report.category} className="h-full w-full object-cover" />
          </div>

          <div className="px-6 py-6 space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="text-xs font-mono text-orange-500">{report.report_id}</div>
                <h1 className="text-xl font-semibold text-slate-900">{report.summary}</h1>
                <p className="text-xs text-slate-500">
                  Submitted on {new Date(report.submitted_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[report.status]}`}>
                  {report.status}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Priority: {report.priority}
                </span>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2 text-sm text-slate-800">
                <MapPin className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <div className="font-medium">Location</div>
                  <div className="text-xs text-slate-600">{report.location_text}</div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-800">
                <Flag className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <div className="font-medium">Category</div>
                  <div className="text-xs text-slate-600">{report.category}</div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-800">
                <Clock className="mt-0.5 h-4 w-4 text-slate-700" />
                <div>
                  <div className="font-medium">Reported at</div>
                  <div className="text-xs text-slate-600">{new Date(report.submitted_at).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-800">
                <User className="mt-0.5 h-4 w-4 text-slate-700" />
                <div>
                  <div className="font-medium">Reported by</div>
                  <div className="text-xs text-slate-600">{report.reporter.name}</div>
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-100 pt-4 mt-2">
              <div className="text-sm font-medium text-slate-900">Assignment</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2 text-sm text-slate-800">
                  <Building2 className="mt-0.5 h-4 w-4 text-indigo-600" />
                  <div>
                    <div className="font-medium">Department</div>
                    <div className="text-xs text-slate-600">{report.assigned_department || 'Not assigned'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-800">
                  <User className="mt-0.5 h-4 w-4 text-slate-700" />
                  <div>
                    <div className="font-medium">Officer</div>
                    <div className="text-xs text-slate-600">{report.assigned_officer_name || 'Unassigned'}</div>
                    {(report.assigned_officer_phone || report.assigned_officer_email) ? (
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        {report.assigned_officer_phone && (
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{report.assigned_officer_phone}</span>
                        )}
                        {report.assigned_officer_email && (
                          <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{report.assigned_officer_email}</span>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-slate-500">Officer contact not available</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Issue details
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-line">{report.description}</p>
            </section>

            <section className="space-y-2 border-t border-slate-100 pt-4 mt-2">
              <div className="text-sm font-medium text-slate-900">Progress</div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all duration-500',
                    report.status === 'Resolved' ? 'bg-emerald-500' : report.status === 'Rejected' ? 'bg-rose-500' : 'bg-sky-500',
                  ].join(' ')}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-sm font-medium text-slate-900">Progress timeline</div>
              {report.timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">No timeline updates yet.</p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-700">
                  {report.timeline.map((t, i) => (
                    <li key={i}>
                      <span className="font-medium">{new Date(t.at).toLocaleString()}</span>
                      <span className="mx-1">—</span>
                      <span className="font-semibold">{t.actor}</span>
                      <span className="mx-1">·</span>
                      <span>{t.action}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </article>
      </div>
    </div>
  )
}
