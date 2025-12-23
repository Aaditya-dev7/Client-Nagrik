import { Report } from '@/lib/types'

export function loadReports(): Report[] {
  try {
    const raw = localStorage.getItem('cc:reports')
    if (!raw) return []
    const list = JSON.parse(raw) as Report[]
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const filtered = list.filter(r => !(r.status === 'Resolved' && new Date(r.submitted_at).getTime() < cutoff))
    if (filtered.length !== list.length) {
      try { localStorage.setItem('cc:reports', JSON.stringify(filtered)) } catch {}
    }
    return filtered
  } catch {}
  return []
}
export function saveReports(list: Report[]) {
  try { localStorage.setItem('cc:reports', JSON.stringify(list)) } catch {}
}

export function upvote(reportId: string, userId: string) {
  try {
    const key = 'cc:votes:' + reportId
    const raw = localStorage.getItem(key)
    const set = new Set<string>(raw ? JSON.parse(raw) : [])
    if (set.has(userId)) set.delete(userId); else set.add(userId)
    localStorage.setItem(key, JSON.stringify(Array.from(set)))
  } catch {}
}
export function getVotes(reportId: string): number {
  try { const raw = localStorage.getItem('cc:votes:' + reportId); return raw ? (JSON.parse(raw) as string[]).length : 0 } catch { return 0 }
}
