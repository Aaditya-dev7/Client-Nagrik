import { getSupabase, isSupabaseEnabled } from '@/lib/supabase'
import type { Report, TimelineItem } from '@/lib/types'

// Map DB row to client Report
function mapDbToReport(row: any): Report {
  return {
    report_id: row.id,
    category: row.category,
    description: row.description,
    summary: row.summary ?? (row.category + ' issue: ' + (row.description || '').split(' ').slice(0, 12).join(' ') + (((row.description || '').split(' ').length > 12) ? '...' : '')),
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
    timeline: [],
  }

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
  const row = {
    id: r.report_id,
    category: r.category,
    description: r.description,
    summary: r.summary,
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
