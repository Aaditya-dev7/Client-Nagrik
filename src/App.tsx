import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { Header } from '@/components/Header'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import Login from '@/pages/Login'
import HomePage from '@/pages/Home'
import ReportPage from '@/pages/Report'
import ReportDetailPage from '@/pages/ReportDetail'
import CommunityPage from '@/pages/Community'
import MapPage from '@/pages/Map'
import ProfilePage from '@/pages/Profile'
import SettingsPage from '@/pages/Settings'
import { ToastProvider, useToast } from '@/components/ui/toast'
import LeadersPage from '@/pages/Leaders'
import ProfilePublicPage from '@/pages/ProfilePublic'
import BottomNav from '@/components/BottomNav'
import FabReport from '@/components/FabReport'
import { useEffect } from 'react'
import { isSupabaseEnabled, subscribeReports } from '@/lib/api'
import { loadReports } from '@/lib/storage'

function Protected({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  const loc = useLocation()
  if (!user && loc.pathname !== '/login') return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ToastProvider>
          <Protected>
            <div className="min-h-screen bg-background text-foreground">
              <Header />
              <RealtimeNotifications />
              <main className="max-w-6xl mx-auto p-4 pt-20 sm:pt-24 pb-24 sm:pb-6">
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<HomePage />} />
                  <Route path="/report" element={<ReportPage />} />
                  <Route path="/reports/:id" element={<ReportDetailPage />} />
                  <Route path="/community" element={<CommunityPage />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/leaders" element={<LeadersPage />} />
                  <Route path="/u/:name" element={<ProfilePublicPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <FabReport />
              <BottomNav />
            </div>
          </Protected>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

function RealtimeNotifications() {
  const { addToast } = useToast()
  useEffect(() => {
    if (!isSupabaseEnabled()) return
    const myIds = new Set(loadReports().map(r => r.report_id))
    const unsub = subscribeReports((e) => {
      if (e.type === 'update' && myIds.has(e.new.id)) {
        const changes: string[] = []
        try {
          if (e.old?.status !== e.new.status) changes.push(`status → ${e.new.status}`)
          if (e.old?.assigned_department !== e.new.assigned_department) changes.push(`department → ${e.new.assigned_department || 'Unassigned'}`)
          if (e.old?.assigned_officer_name !== e.new.assigned_officer_name) changes.push(`officer → ${e.new.assigned_officer_name || 'Unassigned'}`)
        } catch {}
        if (changes.length) addToast(`Report ${e.new.id} updated: ${changes.join(', ')}`, 'info')
      }
      if (e.type === 'timeline' && myIds.has(e.new.report_id)) {
        addToast(`Report ${e.new.report_id}: ${e.new.action}`, 'success')
      }
      if (e.type === 'insert' && myIds.has(e.new.id)) {
        addToast(`Report ${e.new.id} received by authorities.`, 'success')
      }
    })
    return () => { try { unsub() } catch {} }
  }, [addToast])
  return null
}
