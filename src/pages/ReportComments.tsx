import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Comment, CommentLike, Report } from '@/lib/types'
import { getSupabase, isSupabaseEnabled } from '@/lib/supabase'
import { supabaseGetReportById, supabaseInsertComment, supabaseListComments, supabaseListReportMedia, supabaseListCommentLikes, supabaseToggleCommentLike, supabaseDeleteComment } from '@/lib/api'
import LoadingOverlay from '@/components/LoadingOverlay'
import { Button } from '@/components/ui/button'
import { ArrowLeft, SendHorizontal, MessageCircle, Heart, Trash2 } from 'lucide-react'
import { t, useLang } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'

function initials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] || 'U'
  const b = (parts.length > 1 ? parts[parts.length - 1][0] : '')
  return (a + b).toUpperCase()
}

export default function ReportCommentsPage() {
  const _lang = useLang()
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<Report | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [likes, setLikes] = useState<CommentLike[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [aiValidating, setAiValidating] = useState(false)
  const [aiOk, setAiOk] = useState(true)

  // Local bad word filter
  const BAD_WORDS = [
    'idiot', 'stupid', 'bloody', 'abuse',
    'harami', 'nalayak', 'chutiya', 'madarchod',
    'fuck', 'fucking', 'fucked', 'fucker', 'fuckers',
    'shit', 'shitty', 'bullshit', 'bull shit',
    'damn', 'dammit', 'goddamn',
    'ass', 'asshole', 'assholes',
    'bastard', 'bastards',
    'bitch', 'bitches', 'bitching',
    'crap', 'crappy',
    'dick', 'dicks', 'dickhead',
    'piss', 'pissed', 'pissing',
    'whore', 'whores',
    'slut', 'sluts',
    'cock', 'cocks',
    'pussy', 'pussies',
    'wanker', 'wankers',
    'suck', 'sucks', 'sucking',
    'mc', 'bc', 'mkc', 'maderchod', 'bhenchod', 'bhadwa', 'randi', 'randwa'
  ]

  const containsBadWords = (txt: string): boolean => {
    const lower = txt.toLowerCase()
    return BAD_WORDS.some(word => lower.includes(word))
  }

  async function validateCommentWithAi(inputText: string) {
    const msg = String(inputText || '').trim()
    if (!msg) {
      setAiOk(false)
      return { ok: false, error: 'Message required' } as const
    }
    
    // Local bad word check
    if (containsBadWords(msg)) {
      setAiOk(false)
      return { ok: false, error: 'Abusive language detected. Please use respectful language.' } as const
    }
    
    if (!isSupabaseEnabled()) {
      setAiOk(true)
      return { ok: true } as const
    }
    const sb = getSupabase()
    if (!sb) {
      setAiOk(true)
      return { ok: true } as const
    }
    setAiValidating(true)
    try {
      const res = await sb.functions.invoke('summarize', { body: { text: msg } })
      const data = (res as any)?.data as any
      const ok = Boolean(data?.ok)
      const status = typeof data?.status === 'string' ? data.status : null
      const err = typeof data?.error === 'string' ? data.error : null
      const accepted = ok && (!status || status === 'accepted')
      if (!accepted) {
        setAiOk(false)
        return { ok: false, error: err || 'Message contains disallowed content.' } as const
      }
      setAiOk(true)
      return { ok: true } as const
    } catch {
      // Local bad word check already done above
      setAiOk(true)
      return { ok: true } as const
    } finally {
      setAiValidating(false)
    }
  }

  useEffect(() => {
    let alive = true
    const id = window.setTimeout(() => {
      if (!alive) return
      validateCommentWithAi(text)
    }, 450)
    return () => { alive = false; window.clearTimeout(id) }
  }, [text])

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!id) return
      setLoading(true)
      try {
        if (isSupabaseEnabled()) {
          const r = await supabaseGetReportById(id)
          if (!mounted) return
          if (!r) {
            setReport(null)
            setComments([])
            return
          }

          const media = await supabaseListReportMedia([id])
          setReport({ ...r, media: media[id] || r.media || [], timeline: r.timeline || [] })
          const cmts = await supabaseListComments(id)
          setComments(cmts)
          const lks = await supabaseListCommentLikes(id)
          setLikes(lks)
          return
        }
        if (mounted) {
          setReport(null)
          setComments([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  async function handleDeleteComment(commentId: string) {
    if (!id) return
    if (!isSupabaseEnabled()) return
    const ok = await supabaseDeleteComment(commentId)
    if (ok) {
      const [cmts, lks] = await Promise.all([supabaseListComments(id), supabaseListCommentLikes(id)])
      setComments(cmts)
      setLikes(lks)
    }
  }

  const headerTitle = useMemo(() => {
    if (!report) return t('report_comments.title', 'Comments')
    return t('report_comments.title_for', 'Comments')
  }, [report])

  async function handleSend() {
    if (!id) return
    const msg = (text || '').trim()
    if (!msg) return
    if (!isSupabaseEnabled()) return
    const v = await validateCommentWithAi(msg)
    if (!v.ok) return
    setSending(true)
    try {
      const author = user?.name || 'Citizen'
      const ok = await supabaseInsertComment({ reportId: id, author, message: msg })
      if (ok) {
        setText('')
        const next = await supabaseListComments(id)
        setComments(next)
        const lks = await supabaseListCommentLikes(id)
        setLikes(lks)
        try {
          window.requestAnimationFrame(() => {
            const el = document.getElementById('comments_end')
            el?.scrollIntoView({ behavior: 'smooth', block: 'end' })
          })
        } catch {}
      }
    } finally {
      setSending(false)
    }
  }

  const likesByComment = useMemo(() => {
    const map = new Map<string, CommentLike[]>()
    for (const l of likes) {
      const arr = map.get(l.comment_id) || []
      arr.push(l)
      map.set(l.comment_id, arr)
    }
    return map
  }, [likes])

  async function handleToggleLike(commentId: string) {
    if (!id) return
    if (!isSupabaseEnabled()) return
    if (!user?.id) return
    const userName = user?.name || 'Citizen'
    const ok = await supabaseToggleCommentLike({ reportId: id, commentId, userId: user.id, userName })
    if (ok) {
      const lks = await supabaseListCommentLikes(id)
      setLikes(lks)
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)]">
        <LoadingOverlay show label={t('report_comments.loading', 'Loading comments…')} />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-4 sm:px-6 lg:px-8 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button variant="outline" className="inline-flex items-center gap-1" onClick={() => nav(-1)}>
            <ArrowLeft className="h-4 w-4" />
            {t('common.back', 'Back')}
          </Button>
          <div className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span>{headerTitle}</span>
          </div>
          <Button variant="outline" onClick={() => id && nav(`/reports/${id}`)}>
            {t('community.view', 'View')}
          </Button>
        </div>

        {report && (
          <div className="mb-4 rounded-3xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr]">
              <div className="h-36 sm:h-full w-full overflow-hidden bg-muted">
                <img
                  src={(report.media && report.media.length > 0) ? report.media[0] : 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80'}
                  alt={report.summary || report.category}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-4">
                <div className="text-xs font-mono text-orange-500">{report.report_id}</div>
                <div className="text-sm font-semibold text-foreground line-clamp-2">{report.summary}</div>
                <div className="mt-1 text-xs text-muted-foreground line-clamp-1">{report.location_text}</div>
              </div>
            </div>
          </div>
        )}

        {!isSupabaseEnabled() ? (
          <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {t('report_detail.comments_requires_supabase', 'Comments require Supabase to be enabled.')}
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
              {comments.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('report_detail.no_comments', 'No comments yet.')}</div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <button
                      type="button"
                      className="h-9 w-9 rounded-full bg-primary-light text-primary text-xs font-bold flex items-center justify-center shrink-0"
                      onClick={() => nav(`/u/${encodeURIComponent(c.author || 'Citizen')}`)}
                      title={t('profile.view_profile', 'View profile')}
                    >
                      {initials(c.author)}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-foreground/90 hover:underline"
                          onClick={() => nav(`/u/${encodeURIComponent(c.author || 'Citizen')}`)}
                        >
                          {c.author}
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="text-[11px] text-muted-foreground">{new Date(c.at).toLocaleString()}</div>
                          {user?.name && c.author === user.name && (
                            <button
                              type="button"
                              className="inline-flex items-center text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteComment(c.id)}
                              title={t('common.delete', 'Delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{c.message}</div>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleToggleLike(c.id)}
                        >
                          <Heart
                            className={[
                              'h-4 w-4',
                              (likesByComment.get(c.id) || []).some(l => l.user_id === user?.id) ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'
                            ].join(' ')}
                          />
                          <span>{(likesByComment.get(c.id) || []).length}</span>
                        </button>

                        {(likesByComment.get(c.id) || []).length > 0 && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {(likesByComment.get(c.id) || []).slice(0, 3).map(l => l.user_name).join(', ')}
                            {(likesByComment.get(c.id) || []).length > 3 ? ` +${(likesByComment.get(c.id) || []).length - 3}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div id="comments_end" />
            </div>

            <div className="border-t border-border p-3 bg-card">
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t('report_detail.write_comment', 'Write a comment…')}
                  className="flex-1 min-h-[44px] max-h-40 resize-y rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button
                  className="rounded-2xl"
                  onClick={handleSend}
                  disabled={sending || aiValidating || !text.trim() || !aiOk}
                >
                  <SendHorizontal className="h-4 w-4 mr-2" />
                  {sending ? t('common.sending', 'Sending…') : t('report_detail.post_comment', 'Post comment')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
