export type Reporter = { name: string; phone: string | null; anonymous: boolean }
export type TimelineItem = { actor: string; action: string; at: string }
export type Comment = { id: string; report_id: string; author: string; message: string; at: string }
export type CommentLike = { id: string; comment_id: string; user_id: string; user_name: string; at: string }
export type ResolutionDocument = {
  id: string
  name: string
  url: string
  type: 'pdf' | 'image' | 'document'
  uploaded_at: string
  uploaded_by: string
}
export type Notification = {
  id: string
  message: string
  timestamp: string
  read: boolean
  report_id: string
  recipient_user_id?: string | null
  recipient_role?: 'citizen' | 'officer' | 'admin' | null
  type?: string
}
export type Report = {
  report_id: string
  category: string
  other_category?: string | null
  description: string
  summary: string
  report_score?: number
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  status: 'Pending' | 'In Progress' | 'Resolved' | 'Rejected'
  submitted_at: string
  deadline?: string | null
  overdue_at?: string | null
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
  timeline: TimelineItem[]
  resolution_documents?: ResolutionDocument[]
  resolution_note?: string | null
}
