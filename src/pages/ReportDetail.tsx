import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Report } from '@/lib/types'
import { loadReports, saveReports } from '@/lib/storage'
import { isSupabaseEnabled } from '@/lib/supabase'
import { supabaseGetReportById, supabaseListTimelines, subscribeReports, supabaseListReportMedia } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingOverlay from '@/components/LoadingOverlay'
import { ArrowLeft, MapPin, Flag, Clock, User, AlertTriangle, Building2, Phone, Mail, FileText, X, ExternalLink } from 'lucide-react'
import { t, useLang } from '@/lib/i18n'

export default function ReportDetailPage() {
  const _lang = useLang()
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [showProof, setShowProof] = useState(false)

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#comments') return
    const id = window.setTimeout(() => {
      try {
        document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch {}
    }, 250)
    return () => window.clearTimeout(id)
  }, [loading, report])

  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)]">
        <LoadingOverlay show label={t('report_detail.loading', 'Loading report…')} />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="max-w-3xl mx-auto py-10 space-y-4">
        <Button variant="outline" className="inline-flex items-center gap-1" onClick={() => nav(-1)}>
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('report_detail.not_found', 'Report not found. It may have been removed.')}</p>
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

  const latestTimeline = report.timeline.length > 0 ? report.timeline[report.timeline.length - 1] : null
  const latestNoteText = (() => {
    if (!latestTimeline) return null
    const a = latestTimeline.action || ''
    const m = a.match(/Added progress note\s*-\s*"([\s\S]*)"/)
    if (m && m[1]) return m[1]
    return a
  })()

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="outline" className="inline-flex items-center gap-1" onClick={() => nav(-1)}>
          <ArrowLeft className="h-4 w-4" />
          {t('report_detail.back_to_community', 'Back to Community')}
        </Button>

        <article className="overflow-hidden rounded-3xl bg-card shadow-sm border border-border">
          <div className="h-64 w-full overflow-hidden">
            <img src={primaryImage} alt={report.summary || report.category} className="h-full w-full object-cover" />
          </div>

          <div className="px-6 py-6 space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="text-xs font-mono text-orange-500">{report.report_id}</div>
                <h1 className="text-xl font-semibold text-foreground">{report.summary}</h1>
                <p className="text-xs text-muted-foreground">
                  {t('report_detail.submitted_on', 'Submitted on')} {new Date(report.submitted_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[report.status]}`}>
                  {report.status}
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/80">
                  {t('report_detail.priority', 'Priority')}: {report.priority}
                </span>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2 text-sm text-foreground">
                <MapPin className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <div className="font-medium">{t('report_detail.location', 'Location')}</div>
                  <div className="text-xs text-muted-foreground">{report.location_text}</div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-foreground">
                <Flag className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <div className="font-medium">{t('report_detail.category', 'Category')}</div>
                  <div className="text-xs text-muted-foreground">{report.category}</div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-foreground">
                <Clock className="mt-0.5 h-4 w-4 text-slate-700" />
                <div>
                  <div className="font-medium">{t('profile.reported_at', 'Reported at')}</div>
                  <div className="text-xs text-muted-foreground">{new Date(report.submitted_at).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-foreground">
                <User className="mt-0.5 h-4 w-4 text-slate-700" />
                <div>
                  <div className="font-medium">{t('report_detail.reported_by', 'Reported by')}</div>
                  <div className="text-xs text-muted-foreground">{report.reporter.anonymous ? t('report_detail.anonymous', 'Anonymous') : 'Citizen'}</div>
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t border-border pt-4 mt-2">
              <div className="text-sm font-medium text-foreground">{t('report_detail.assignment', 'Assignment')}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2 text-sm text-foreground">
                  <Building2 className="mt-0.5 h-4 w-4 text-indigo-600" />
                  <div>
                    <div className="font-medium">{t('profile.department', 'Department')}</div>
                    <div className="text-xs text-muted-foreground">{report.assigned_department || t('report_detail.not_assigned', 'Not assigned')}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm text-foreground">
                  <User className="mt-0.5 h-4 w-4 text-slate-700" />
                  <div>
                    <div className="font-medium">{t('profile.officer', 'Officer')}</div>
                    <div className="text-xs text-muted-foreground">{report.assigned_officer_name || t('profile.unassigned', 'Unassigned')}</div>
                    {(report.assigned_officer_phone || report.assigned_officer_email) ? (
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {report.assigned_officer_phone && (
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{report.assigned_officer_phone}</span>
                        )}
                        {report.assigned_officer_email && (
                          <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{report.assigned_officer_email}</span>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-muted-foreground">{t('report_detail.officer_contact_na', 'Officer contact not available')}</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t('report_detail.issue_details', 'Issue details')}
              </div>
              {typeof report.report_score === 'number' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-muted-foreground">Report Quality Score:</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${
                    report.report_score >= 90 ? 'bg-emerald-100 text-emerald-700' : 
                    report.report_score >= 70 ? 'bg-amber-100 text-amber-700' : 
                    'bg-red-100 text-red-700'
                  }`}>
                    {Math.round(report.report_score)}%
                  </span>
                </div>
              )}
              <p className="text-sm text-foreground whitespace-pre-line">{report.description}</p>
            </section>

            <section className="space-y-2 border-t border-border pt-4 mt-2">
              <div className="text-sm font-medium text-foreground">{t('report_detail.progress', 'Progress')}</div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all duration-500',
                    report.status === 'Resolved' ? 'bg-emerald-500' : report.status === 'Rejected' ? 'bg-rose-500' : 'bg-sky-500',
                  ].join(' ')}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-sm font-medium text-foreground">{t('profile.progress_timeline', 'Progress timeline')}</div>
              {report.timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('profile.no_timeline', 'No timeline updates yet.')}</p>
              ) : (
                <ul className="space-y-1 text-xs text-foreground/80">
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

            {latestTimeline && (
              <section className="mt-2">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="text-sm font-medium text-foreground mb-1">{t('report_detail.latest_update', 'Latest update')}</div>
                  <div className="text-xs text-muted-foreground">
                    <div className="mb-1">{new Date(latestTimeline.at).toLocaleString()} · {latestTimeline.actor}</div>
                    <div className="whitespace-pre-wrap">{latestNoteText}</div>
                  </div>
                </div>
              </section>
            )}

            {/* Show Proof Button for Resolved Reports */}
            {report.status === 'Resolved' && report.resolution_documents && report.resolution_documents.length > 0 && (
              <section className="mt-4">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowProof(true)}
                >
                  <FileText className="h-4 w-4" />
                  Show Proof ({report.resolution_documents.length} document{report.resolution_documents.length > 1 ? 's' : ''})
                </Button>
              </section>
            )}

          </div>
        </article>

        {/* Proof Documents Modal */}
        {showProof && report.resolution_documents && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-semibold">Resolution Documents</h3>
                <button
                  onClick={() => setShowProof(false)}
                  className="rounded-full p-1 hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {report.resolution_note && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Resolution Note:</div>
                    <div className="text-sm text-foreground">{report.resolution_note}</div>
                  </div>
                )}
                
                <div className="space-y-3">
                  {report.resolution_documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          doc.type === 'pdf' ? 'bg-red-100 text-red-600' :
                          doc.type === 'image' ? 'bg-blue-100 text-blue-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Uploaded by {doc.uploaded_by} • {new Date(doc.uploaded_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowProof(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
