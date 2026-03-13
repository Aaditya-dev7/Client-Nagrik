import { getSupabase, isSupabaseEnabled } from '@/lib/supabase'
import type { Report, TimelineItem, Comment, CommentLike, Notification } from '@/lib/types'

// Normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Calculate similarity between two strings (0-1)
function textSimilarity(a: string, b: string): number {
  const normA = normalizeText(a)
  const normB = normalizeText(b)
  if (!normA || !normB) return 0
  
  const wordsA = normA.split(' ').filter(w => w.length > 2) // Ignore short words
  const wordsB = normB.split(' ').filter(w => w.length > 2)
  
  if (wordsA.length === 0 || wordsB.length === 0) return 0
  
  // Check if one contains the other
  if (normA.includes(normB) || normB.includes(normA)) return 0.95
  
  // Word overlap check
  const setA = new Set(wordsA)
  const setB = new Set(wordsB)
  const intersection = [...setA].filter(w => setB.has(w)).length
  const union = Math.max(setA.size, setB.size)
  
  const similarity = union > 0 ? intersection / union : 0
  console.log('Text similarity:', { 
    wordsA: wordsA.slice(0, 5), 
    wordsB: wordsB.slice(0, 5), 
    intersection, 
    union, 
    similarity 
  })
  
  return similarity
}

// Check for duplicate reports
export async function checkDuplicateReport(
  description: string,
  category: string,
  locationText: string,
  lat?: number | null,
  lng?: number | null
): Promise<{ isDuplicate: boolean; existingReport?: Report; similarity?: number }> {
  const sb = getSupabase()
  
  // If Supabase is enabled, check database
  if (sb) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await sb
      .from('reports')
      .select('*')
      .eq('category', category)
      .gte('submitted_at', oneDayAgo)
      .order('submitted_at', { ascending: false })
      .limit(50)
    
    console.log('Duplicate check - found reports:', data?.length, 'error:', error)
    
    if (error || !data || data.length === 0) return { isDuplicate: false }
    
    for (const row of data) {
      const existingReport = mapDbToReport(row)
      const similarity = textSimilarity(description, existingReport.description)
      console.log('Comparing with:', existingReport.description?.slice(0, 50), 'similarity:', similarity)
      
      // Check if similar enough (50%+ similarity - lowered threshold)
      if (similarity >= 0.5) {
        console.log('Found potential duplicate!')
        // Also check location proximity if coordinates available
        if (lat && lng && existingReport.lat && existingReport.lng) {
          const distance = Math.sqrt(
            Math.pow(lat - existingReport.lat, 2) + 
            Math.pow(lng - existingReport.lng, 2)
          )
          // If within ~5km (0.05 degrees roughly)
          if (distance < 0.05) {
            console.log('Location match, distance:', distance)
            return { isDuplicate: true, existingReport, similarity }
          }
        } else {
          // No coordinates, check location text similarity
          if (locationText && existingReport.location_text) {
            const locSimilarity = textSimilarity(locationText, existingReport.location_text)
            if (locSimilarity >= 0.4) {
              console.log('Location text match:', locSimilarity)
              return { isDuplicate: true, existingReport, similarity }
            }
          }
          // Just description match is enough
          return { isDuplicate: true, existingReport, similarity }
        }
      }
    }
    
    return { isDuplicate: false }
  }
  
  // Check local storage
  try {
    const raw = localStorage.getItem('cc:reports')
    if (!raw) return { isDuplicate: false }
    const reports: Report[] = JSON.parse(raw)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    
    console.log('Checking local reports:', reports.length)
    
    for (const report of reports) {
      if (report.category !== category) continue
      const submittedTime = new Date(report.submitted_at).getTime()
      if (submittedTime < oneDayAgo) continue
      
      const similarity = textSimilarity(description, report.description)
      console.log('Local similarity:', similarity, 'with:', report.description?.slice(0, 50))
      if (similarity >= 0.5) {
        return { isDuplicate: true, existingReport: report, similarity }
      }
    }
  } catch {}
  
  return { isDuplicate: false }
}

// Map DB row to client Report
function mapDbToReport(row: any): Report {
  return {
    report_id: row.id,
    category: row.category,
    other_category: row.other_category ?? null,
    description: row.description,
    summary: row.summary ?? (row.category + ' issue: ' + (row.description || '').split(' ').slice(0, 12).join(' ') + (((row.description || '').split(' ').length > 12) ? '...' : '')),
    report_score: typeof row.report_score === 'number' ? row.report_score : (row.report_score != null ? Number(row.report_score) : undefined),
    priority: row.priority,
    status: row.status,
    submitted_at: row.submitted_at,
    location_text: row.location_text,
    lat: row.lat,
    lng: row.lng,
    reporter: { name: row.reporter_name || 'Citizen', phone: row.reporter_phone || null, anonymous: !!row.anonymous },
    media: [],
    assigned_department: row.assigned_department ?? null,
    assigned_officer_id: row.assigned_officer_id ?? null,
    assigned_officer_name: row.assigned_officer_name ?? null,
    assigned_officer_phone: row.assigned_officer_phone ?? null,
    assigned_officer_email: row.assigned_officer_email ?? null,
    deadline: row.deadline ?? null,
    overdue_at: row.overdue_at ?? null,
    timeline: [],
    resolution_documents: row.resolution_documents ?? undefined,
    resolution_note: row.resolution_note ?? null,
  }
}

export function mapDbToNotification(row: any): Notification {
  return {
    id: row.id,
    message: row.message,
    timestamp: row.timestamp,
    read: !!row.read,
    report_id: row.report_id,
    recipient_user_id: row.recipient_user_id ?? null,
    recipient_role: row.recipient_role ?? null,
    type: row.type ?? null,
  }
}

export async function supabaseListNotifications(params?: { recipientRole?: 'citizen' | 'officer' | 'admin'; recipientUserId?: string; limit?: number }): Promise<Notification[]> {
  const sb = getSupabase()
  if (!sb) return []
  let q: any = sb.from('notifications').select('*').order('timestamp', { ascending: false })
  if (params?.recipientRole) q = q.eq('recipient_role', params.recipientRole)
  if (params?.recipientUserId) q = q.eq('recipient_user_id', params.recipientUserId)
  if (params?.limit) q = q.limit(params.limit)
  const { data, error } = await q
  if (error) return []
  return (data || []).map(mapDbToNotification)
}

export function subscribeNotifications(onEvent: (e: { type: 'insert' | 'update' | 'delete'; row: any }) => void): () => void {
  const sb = getSupabase()
  if (!sb) return () => {}
  const chan = sb.channel('notifications_citizen')
  chan.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, payload => {
    if (payload.eventType === 'INSERT') onEvent({ type: 'insert', row: payload.new })
    if (payload.eventType === 'UPDATE') onEvent({ type: 'update', row: payload.new })
    if (payload.eventType === 'DELETE') onEvent({ type: 'delete', row: payload.old })
  })
  chan.subscribe()
  return () => { sb.removeChannel(chan) }
}

export async function supabaseListCommentLikes(reportId: string): Promise<CommentLike[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('comment_likes')
    .select('*')
    .eq('report_id', reportId)
    .order('at', { ascending: true })
  if (error) return []
  return (data || []).map((row: any) => ({
    id: row.id,
    comment_id: row.comment_id,
    user_id: row.user_id,
    user_name: row.user_name,
    at: row.at,
  }))
}

export async function supabaseToggleCommentLike(input: { reportId: string; commentId: string; userId: string; userName: string }): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false

  const { data: uData, error: uErr } = await sb.auth.getUser()
  const authUser = uData?.user
  if (uErr || !authUser) return false
  const effectiveUserId = authUser.id
  const effectiveUserName = (authUser.user_metadata as any)?.full_name || input.userName

  const { data, error } = await sb.from('comment_likes')
    .select('id')
    .eq('comment_id', input.commentId)
    .eq('user_id', effectiveUserId)
    .limit(1)
  if (error) return false
  if (data && data.length > 0) {
    const id = data[0].id
    const del = await sb.from('comment_likes').delete().eq('id', id)
    return !del.error
  }
  const row: any = {
    id: `cl-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    report_id: input.reportId,
    comment_id: input.commentId,
    user_id: effectiveUserId,
    user_name: effectiveUserName,
    at: new Date().toISOString(),
    created_by: effectiveUserId,
  }
  const ins = await sb.from('comment_likes').insert(row)
  return !ins.error
}

export async function supabaseListComments(reportId: string): Promise<Comment[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('report_comments').select('*').eq('report_id', reportId).order('at', { ascending: true })
  if (error) return []
  return (data || []).map((row: any) => ({
    id: row.id,
    report_id: row.report_id,
    author: row.author,
    message: row.message,
    at: row.at,
  }))
}

export async function supabaseInsertComment(input: { reportId: string; author: string; message: string; authorProfile?: string | null }): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false

  const { data: uData, error: uErr } = await sb.auth.getUser()
  const authUser = uData?.user
  if (uErr || !authUser) return false

  const row: any = {
    id: `c-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    report_id: input.reportId,
    author: input.author,
    message: input.message,
    at: new Date().toISOString(),
    created_by: authUser.id,
  }
  const { error } = await sb.from('report_comments').insert(row)
  return !error
}

export async function supabaseDeleteComment(commentId: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const { error } = await sb.from('report_comments').delete().eq('id', commentId)
  return !error
}

export async function supabaseDeleteReport(id: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  try {
    await sb.from('report_timeline').delete().eq('report_id', id)
    try {
      const { data: files } = await sb.storage.from('reports').list(id)
      if (files && files.length) {
        await sb.storage.from('reports').remove(files.map((f: any) => `${id}/${f.name}`))
      }
    } catch {}
    await sb.from('reports').delete().eq('id', id)
    return true
  } catch {
    return false
  }
}

export async function supabaseListReports(limit?: number, offset?: number): Promise<Report[] | null> {
  const sb = getSupabase()
  if (!sb) return null
  let query = sb.from('reports').select('*').order('submitted_at', { ascending: false }) as any
  if (limit && Number.isFinite(limit)) {
    const off = Number.isFinite(offset as any) ? (offset as number) : 0
    // Use range for efficient pagination
    query = query.range(off, off + limit - 1)
  }
  const { data, error } = await query
  if (error) return null
  return (data || []).map(mapDbToReport)
}

export async function supabaseInsertReport(r: Report): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false

  const { data: uData, error: uErr } = await sb.auth.getUser()
  const authUser = uData?.user
  if (uErr || !authUser) return false

  const row = {
    id: r.report_id,
    category: r.category,
    other_category: r.other_category ?? null,
    description: r.description,
    summary: r.summary,
    report_score: typeof r.report_score === 'number' ? r.report_score : null,
    priority: r.priority,
    status: r.status,
    submitted_at: r.submitted_at,
    location_text: r.location_text,
    lat: r.lat,
    lng: r.lng,
    reporter_name: r.reporter.name,
    reporter_phone: r.reporter.phone,
    anonymous: r.reporter.anonymous,
    assigned_department: r.assigned_department,
    assigned_officer_id: r.assigned_officer_id,
    assigned_officer_name: r.assigned_officer_name,
    deadline: r.deadline,
    created_by: authUser.id,
  }
  const { error } = await sb.from('reports').insert(row)
  if (error) return false
  await sb.from('report_timeline').insert({ report_id: r.report_id, actor: 'System', action: 'Report created', at: r.submitted_at })
  return true
}

export async function supabaseListTimelines(reportIds: string[]): Promise<Record<string, TimelineItem[]>> {
  const sb = getSupabase()
  const map: Record<string, TimelineItem[]> = {}
  if (!sb || reportIds.length === 0) return map
  const { data, error } = await sb.from('report_timeline').select('*').in('report_id', reportIds).order('at', { ascending: true })
  if (error) return map
  for (const row of data || []) {
    const t: TimelineItem = { actor: row.actor, action: row.action, at: row.at }
    if (!map[row.report_id]) map[row.report_id] = []
    map[row.report_id].push(t)
  }
  return map
}

export async function supabaseGetReportById(id: string): Promise<Report | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('reports').select('*').eq('id', id).limit(1)
  if (error || !data || data.length === 0) return null
  return mapDbToReport(data[0])
}

export async function supabaseGetReportCounts(): Promise<{ total: number; resolved: number; inProgress: number } | null> {
  const sb = getSupabase()
  if (!sb) return null
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [allRes, resolvedOldRes, resolvedRecentRes, inProgRes] = await Promise.all([
    sb.from('reports').select('*', { count: 'exact', head: true }),
    sb.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'Resolved').lt('submitted_at', cutoff),
    sb.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'Resolved').gte('submitted_at', cutoff),
    sb.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'In Progress'),
  ])
  if (allRes.error || resolvedOldRes.error || resolvedRecentRes.error || inProgRes.error) return null
  const totalAll = allRes.count || 0
  const oldResolved = resolvedOldRes.count || 0
  const total = Math.max(0, totalAll - oldResolved)
  const resolved = resolvedRecentRes.count || 0
  const inProgress = inProgRes.count || 0
  return { total, resolved, inProgress }
}

export type SupaEvent =
  | { type: 'insert'; new: any }
  | { type: 'update'; new: any; old: any }
  | { type: 'delete'; old: any }
  | { type: 'timeline'; new: any }

export function subscribeReports(onEvent: (e: SupaEvent) => void): () => void {
  const sb = getSupabase()
  if (!sb) return () => {}
  const chan = sb.channel('reports_and_timeline_citizen')
  chan.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, payload => {
    onEvent({ type: 'insert', new: payload.new })
  })
  chan.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports' }, payload => {
    onEvent({ type: 'update', new: payload.new, old: payload.old })
  })
  chan.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reports' }, payload => {
    onEvent({ type: 'delete', old: payload.old })
  })
  chan.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'report_timeline' }, payload => {
    onEvent({ type: 'timeline', new: payload.new })
  })
  chan.subscribe()
  return () => { sb.removeChannel(chan) }
}

export { isSupabaseEnabled }

// Fetch citizen site configuration from database
export async function getCitizenConfig(key: string): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb
    .from('citizen_config')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error || !data) return null
  return data.value
}

// Get the citizen site URL for redirects
export async function getCitizenSiteUrl(): Promise<string> {
  // First try to get from database config
  const configUrl = await getCitizenConfig('CITIZEN_SITE_URL')
  if (configUrl) return configUrl
  
  // Fallback to current window location
  return window.location.origin
}

// Upload a photo to Supabase Storage under bucket 'reports' and return a public URL
export async function supabaseUploadReportPhoto(reportId: string, file: File): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null
  const path = `${reportId}/${Date.now()}-${file.name}`
  const { error: upErr } = await sb.storage.from('reports').upload(path, file, { cacheControl: '3600', upsert: true })
  if (upErr) return null
  const { data } = sb.storage.from('reports').getPublicUrl(path)
  const url = data?.publicUrl || null
  return url
}

// List media URLs for a set of report IDs from Supabase Storage bucket 'reports'
export async function supabaseListReportMedia(reportIds: string[]): Promise<Record<string, string[]>> {
  const sb = getSupabase()
  const map: Record<string, string[]> = {}
  if (!sb || reportIds.length === 0) return map
  try {
    const listResults = await Promise.all(reportIds.map(id => sb.storage.from('reports').list(id)))
    for (let i = 0; i < reportIds.length; i++) {
      const id = reportIds[i]
      const files = listResults[i]?.data || []
      if (files.length > 0) {
        // Use the first file as cover to minimize requests
        const f = files[0]
        const { data } = sb.storage.from('reports').getPublicUrl(`${id}/${f.name}`)
        if (data?.publicUrl) map[id] = [data.publicUrl]
      }
    }
  } catch {}
  return map
}
