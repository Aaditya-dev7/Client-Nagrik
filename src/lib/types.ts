export type Reporter = { name: string; phone: string | null; anonymous: boolean }
export type TimelineItem = { actor: string; action: string; at: string }
export type Comment = { id: string; report_id: string; author: string; message: string; at: string }
export type CommentLike = { id: string; comment_id: string; user_id: string; user_name: string; at: string }
export type Report = {
  report_id: string
  category: string
  description: string
  summary: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  status: 'Pending' | 'In Progress' | 'Resolved' | 'Rejected'
  submitted_at: string
  location_text: string
  lat: number
  lng: number
  reporter: Reporter
  media: string[]
  assigned_department?: string | null
  assigned_officer_id?: string | null
  assigned_officer_name?: string | null
  assigned_officer_phone?: string | null
  assigned_officer_email?: string | null
  deadline?: string | null
  timeline: TimelineItem[]
}
