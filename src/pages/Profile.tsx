import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Report } from '@/lib/types'
import { loadReports } from '@/lib/storage'
import { isSupabaseEnabled, supabaseListReports, supabaseListTimelines, subscribeReports, supabaseListReportMedia } from '@/lib/api'
import { getSupabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import LoadingOverlay from '@/components/LoadingOverlay'
import { MapPin, Flag, Clock, User, Eye, Building2, BadgeCheck, LogOut, FileText, Award, Users, Star, Trophy, CheckCircle, XCircle } from 'lucide-react'
import { t, useLang } from '@/lib/i18n'

interface UserBadge {
  id: string
  name: string
  description: string
  icon: string
  points: number
  earned_at: string
}

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

const statusClasses: Record<Report['status'], string> = {
  Pending: 'bg-amber-50 text-amber-700',
  'In Progress': 'bg-sky-50 text-sky-700',
  Resolved: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-rose-50 text-rose-700',
}

export default function ProfilePage() {
  const _lang = useLang()
  const { user, logout } = useAuth()
  const { addToast } = useToast()
  const [list, setList] = useState<Report[]>([])
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [badges, setBadges] = useState<UserBadge[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [showNSSDialog, setShowNSSDialog] = useState(false)
  const [nssStatus, setNssStatus] = useState<string | null>(null)
  const [nssForm, setNssForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    college: '',
    nss_unit: '',
    department_preference: '',
  })

  const handleLogout = async () => {
    await logout()
    nav('/login')
  }

  useEffect(() => {
    let mounted = true
    async function refresh() {
      setLoading(true)
      try {
        if (isSupabaseEnabled()) {
          const supa = await supabaseListReports()
          if (mounted && supa) {
            const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
            const filtered = supa.filter(r => !(r.status === 'Resolved' && new Date(r.submitted_at).getTime() < cutoff))
            const ids = filtered.map((r) => r.report_id)
            const [tmap, mmap] = await Promise.all([supabaseListTimelines(ids), supabaseListReportMedia(ids)])
            const withData = filtered.map((r) => ({ ...r, media: mmap[r.report_id] || r.media || [], timeline: tmap[r.report_id] || [] }))
            setList(withData)
            return
          }
        }
        if (mounted) setList(loadReports())
      } finally {
        if (mounted) setLoading(false)
      }
    }
    refresh()
    let unsub = () => {}
    if (isSupabaseEnabled()) {
      unsub = subscribeReports(() => {
        refresh()
      })
    }
    return () => {
      mounted = false
      unsub()
    }
  }, [])

  // Fetch badges and NSS status
  useEffect(() => {
    if (!user?.id) return
    const sb = getSupabase()
    if (!sb) return

    // Fetch user badges
    sb.from('user_badges')
      .select('earned_at, badges(id, name, description, icon, points)')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) {
          console.log('Badges fetch error (table may not exist):', error.message)
          return
        }
        if (data) {
          const mapped = data.map((ub: any) => ({
            id: ub.badges?.id || '',
            name: ub.badges?.name || 'Badge',
            description: ub.badges?.description || '',
            icon: ub.badges?.icon || 'award',
            points: ub.badges?.points || 0,
            earned_at: ub.earned_at,
          }))
          setBadges(mapped)
          setTotalPoints(mapped.reduce((sum: number, b: UserBadge) => sum + b.points, 0))
        }
      })
      .catch((err) => {
        console.log('Badges fetch failed:', err)
      })

    // Fetch NSS status
    sb.from('nss_registrations')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.log('NSS fetch error (table may not exist):', error.message)
          return
        }
        if (data) {
          setNssStatus(data.status)
        }
      })
      .catch((err) => {
        console.log('NSS fetch failed:', err)
      })
  }, [user?.id])

  const handleNSSSubmit = async () => {
    const sb = getSupabase()
    if (!sb || !user) return

    const { error } = await sb.from('nss_registrations').insert({
      user_id: user.id,
      full_name: nssForm.full_name || user.name,
      email: nssForm.email || user.email,
      phone: nssForm.phone,
      college: nssForm.college,
      nss_unit: nssForm.nss_unit,
      department_preference: nssForm.department_preference,
      status: 'pending',
    })

    if (error) {
      addToast(error.message, 'error')
    } else {
      addToast('NSS registration submitted for approval', 'success')
      setNssStatus('pending')
      setShowNSSDialog(false)
    }
  }

  const getBadgeIcon = (icon: string) => {
    switch (icon) {
      case 'trophy': return <Trophy className="w-5 h-5" />
      case 'star': return <Star className="w-5 h-5" />
      case 'award': return <Award className="w-5 h-5" />
      case 'file-plus': return <FileText className="w-5 h-5" />
      case 'users': return <Users className="w-5 h-5" />
      default: return <Award className="w-5 h-5" />
    }
  }

  const my = useMemo(
    () => list.filter((r) => r.reporter.name === (user?.name || 'Citizen')),
    [list, user],
  )

  const myCount = my.length
  const myKarma = myCount * 10
  const myTier = myKarma >= 200 ? 'Legend' : myKarma >= 100 ? 'Pro' : myKarma >= 50 ? 'Active' : 'Newcomer'

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-background px-4 sm:px-6 lg:px-8 py-6">
      <LoadingOverlay show={loading && list.length === 0} label={t('profile.loading', 'Loading your reports…')} />
      <div className="mx-auto max-w-6xl">
        {/* Top Bar with User Info and Logout */}
        <div className="flex items-center justify-between mb-6 p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-lg font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div>
              <p className="font-semibold text-foreground">{user?.name || 'Citizen'}</p>
              <p className="text-xs text-muted-foreground">{user?.email || 'citizen@example.com'}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 text-sm px-3 py-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t('auth.logout', 'Logout')}</span>
          </Button>
        </div>

        {/* Profile Header - Circular Photo, Name, Stats */}
        <div className="flex flex-col items-center mb-8">
          {/* Circular Profile Photo */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {user?.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          {/* Username */}
          <h1 className="mt-3 text-xl font-bold text-foreground">{user?.name || 'Citizen'}</h1>
          <span className="text-sm text-muted-foreground">{myTier} Contributor</span>
        </div>

        {/* Stats Cards - Horizontal */}
        <div className="grid grid-cols-3 gap-3 mb-6 max-w-md mx-auto">
          <div className="rounded-2xl bg-card border border-border shadow-sm px-4 py-4 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-light mb-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="text-2xl font-extrabold text-foreground">{myCount}</div>
            <div className="text-xs text-muted-foreground">{t('profile.reports_submitted', 'Reports')}</div>
          </div>
          <div className="rounded-2xl bg-card border border-border shadow-sm px-4 py-4 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 mb-2">
              <Award className="h-5 w-5 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-foreground">{totalPoints || myKarma}</div>
            <div className="text-xs text-muted-foreground">{t('profile.karma_popularity', 'Points')}</div>
          </div>
          <div className="rounded-2xl bg-card border border-border shadow-sm px-4 py-4 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 mb-2">
              <Star className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-2xl font-extrabold text-foreground">{badges.length}</div>
            <div className="text-xs text-muted-foreground">Badges</div>
          </div>
        </div>

        {/* Badges Section */}
        {badges.length > 0 && (
          <div className="max-w-md mx-auto mb-6">
            <div className="rounded-2xl bg-card border border-border shadow-sm p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Award className="h-4 w-4 text-primary" />
                Badges & Achievements
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {badges.map((badge) => (
                  <div key={badge.id} className="flex flex-col items-center p-2 rounded-xl bg-muted/30 text-center">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mb-1">
                      {getBadgeIcon(badge.icon)}
                    </div>
                    <div className="text-xs font-medium truncate w-full">{badge.name}</div>
                    <div className="text-[10px] text-muted-foreground">{badge.points} pts</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NSS Volunteer Section */}
        <div className="max-w-md mx-auto mb-6">
          <div className="rounded-2xl bg-card border border-border shadow-sm p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <Users className="h-4 w-4 text-primary" />
              NSS Volunteer
            </h2>
            {nssStatus === 'approved' ? (
              <div className="flex items-center gap-2 text-emerald-600 text-sm">
                <CheckCircle className="w-5 h-5" />
                <span>You are a registered NSS Volunteer</span>
              </div>
            ) : nssStatus === 'pending' ? (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <Clock className="w-5 h-5" />
                <span>Your NSS registration is pending approval</span>
              </div>
            ) : nssStatus === 'rejected' ? (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="w-5 h-5" />
                <span>Your NSS registration was rejected</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Register as an NSS (National Service Scheme) volunteer to contribute to community service and earn special badges.
                </p>
                <Button onClick={() => setShowNSSDialog(true)}>
                  Register as NSS Volunteer
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* My Reports Section */}
        <div className="max-w-md mx-auto mb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            {t('profile.my_reports', 'My Reports')} ({myCount})
          </h2>
        </div>

        {/* Reports List */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {my.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('profile.empty', 'You have not submitted any reports yet.')}
            </p>
          )}

          {my.map((r) => {
            const primaryImage = r.media && r.media.length > 0 ? r.media[0] :
              'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'
            const locationTitle = (r.location_text || '').split(',')[0] || t('misc.unknown_location', 'Unknown location')
            const lastTimeline =
              r.timeline && r.timeline.length > 0
                ? r.timeline[r.timeline.length - 1]
                : null

            return (
              <article
                key={r.report_id}
                className="overflow-hidden rounded-3xl bg-card shadow-sm border border-border flex flex-col"
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={primaryImage}
                    alt={r.summary || r.category}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col px-6 py-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 text-left">
                      <h2 className="text-lg font-semibold text-foreground capitalize">
                        {locationTitle.toLowerCase()}
                      </h2>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {r.location_text}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('community.type', 'Type:')} {r.category}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getPriorityClass(
                          r.priority,
                        )}`}
                      >
                        {r.priority.toLowerCase()}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${statusClasses[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-foreground line-clamp-2">{r.summary}</p>

                  <div className="grid gap-2 text-xs text-foreground/80 sm:grid-cols-2">
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                      <div>
                        <div className="font-medium">{t('profile.department', 'Department')}</div>
                        <div className="text-muted-foreground">
                          {r.assigned_department || t('profile.not_assigned_yet', 'Not assigned yet')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <BadgeCheck className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                      <div>
                        <div className="font-medium">{t('profile.officer', 'Officer')}</div>
                        <div className="text-muted-foreground">
                          {r.assigned_officer_name || t('profile.unassigned', 'Unassigned')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                      <div>
                        <div className="font-medium">{t('profile.reported_at', 'Reported at')}</div>
                        <div className="text-muted-foreground">
                          {new Date(r.submitted_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <User className="mt-0.5 h-3.5 w-3.5 text-slate-600" />
                      <div>
                        <div className="font-medium">{t('profile.reporter', 'Reporter')}</div>
                        <div className="text-muted-foreground">{r.reporter.name}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-border pt-3 mt-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{t('profile.progress_timeline', 'Progress timeline')}</span>
                    </div>
                    {lastTimeline ? (
                      <p className="text-[11px] text-muted-foreground">
                        {t('profile.last_update_on', 'Last update on')} {new Date(lastTimeline.at).toLocaleString()} —{' '}
                        <span className="font-semibold">{lastTimeline.actor}</span>: {lastTimeline.action}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">{t('profile.no_timeline', 'No timeline updates yet.')}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="inline-flex items-center gap-1 rounded-full border-border text-xs text-primary hover:bg-primary-light"
                      onClick={() => nav(`/reports/${r.report_id}`)}
                    >
                      <Eye className="h-3 w-3" />
                      <span>{t('profile.view_details', 'View details')}</span>
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
          </div>
      </div>
      
      {/* Logout Button - Mobile only since desktop has it in header */}
      <div className="max-w-md mx-auto mt-6 sm:hidden">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t('auth.logout', 'Logout')}
        </button>
      </div>

      {/* NSS Registration Modal */}
      <Modal 
        open={showNSSDialog} 
        onClose={() => setShowNSSDialog(false)} 
        title="NSS Volunteer Registration"
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input 
              value={nssForm.full_name || user?.name || ''} 
              onChange={(e) => setNssForm({ ...nssForm, full_name: e.target.value })} 
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input 
              type="email"
              value={nssForm.email || user?.email || ''} 
              onChange={(e) => setNssForm({ ...nssForm, email: e.target.value })} 
              placeholder="Your email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone</label>
            <Input 
              value={nssForm.phone} 
              onChange={(e) => setNssForm({ ...nssForm, phone: e.target.value })} 
              placeholder="Your phone number"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">College/Institution</label>
            <Input 
              value={nssForm.college} 
              onChange={(e) => setNssForm({ ...nssForm, college: e.target.value })} 
              placeholder="Your college name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">NSS Unit</label>
            <Input 
              value={nssForm.nss_unit} 
              onChange={(e) => setNssForm({ ...nssForm, nss_unit: e.target.value })} 
              placeholder="NSS unit number"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Department Preference</label>
            <select
              value={nssForm.department_preference}
              onChange={(e) => setNssForm({ ...nssForm, department_preference: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select department</option>
              <option value="Roads">Roads</option>
              <option value="Sanitation">Sanitation</option>
              <option value="Water Supply">Water Supply</option>
              <option value="Street Lighting">Street Lighting</option>
              <option value="Drainage">Drainage</option>
              <option value="Parks">Parks</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="outline" onClick={() => setShowNSSDialog(false)}>Cancel</Button>
            <Button onClick={handleNSSSubmit}>Submit Registration</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
