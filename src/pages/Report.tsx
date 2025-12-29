import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { geocodeAddress, isCoordinateInIndia } from '@/lib/geocoding'
import { Report } from '@/lib/types'
import { loadReports, saveReports } from '@/lib/storage'
import { isSupabaseEnabled, supabaseInsertReport, supabaseUploadReportPhoto } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select as UISelect } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'
import { AlertTriangle, Flag, MapPin, FileText, Image as ImageIcon, Clock as ClockIcon, Info } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { validateImageMatchesDescription } from '@/lib/ai'

function id() {
  return 'CR-' + Math.random().toString(36).slice(2, 8)
}

type FieldErrors = {
  category?: string
  priority?: string
  location?: string
  description?: string
}

export default function ReportPage() {
  const { user } = useAuth()
  const loc = useLocation()
  const [category, setCategory] = useState('Pothole')
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium')
  const [locationText, setLocationText] = useState('')
  const [description, setDescription] = useState('')
  const [incidentTime, setIncidentTime] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [pickedLat, setPickedLat] = useState<number | null>(null)
  const [pickedLng, setPickedLng] = useState<number | null>(null)

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(loc.search)
      const pLat = params.get('lat')
      const pLng = params.get('lng')
      const pLoc = params.get('location')
      if (pLat && pLng) {
        const lat = parseFloat(pLat)
        const lng = parseFloat(pLng)
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          setPickedLat(lat)
          setPickedLng(lng)
        }
      }
      if (pLoc) setLocationText(pLoc)
    } catch {}
  }, [loc.search])

  const categories = [
    'Pothole',
    'Road Damage',
    'Garbage Collection',
    'Illegal Dumping',
    'Street Light',
    'Water Leakage',
    'Drainage Block',
    'Tree Falling Risk',
    'Sewage Overflow',
    'Park Maintenance',
  ]
  const priorities: Array<'Low' | 'Medium' | 'High' | 'Urgent'> = ['Low', 'Medium', 'High', 'Urgent']

  const categoryId = 'report-category'
  const priorityId = 'report-priority'
  const locationId = 'report-location'
  const descriptionId = 'report-description'
  const photoId = 'report-photo'
  const incidentTimeId = 'report-incident-time'

  const validate = () => {
    const errors: FieldErrors = {}

    if (!category) errors.category = 'Please select a category.'
    if (!priority) errors.priority = 'Please select a priority.'
    if (!locationText.trim()) errors.location = 'Location is required.'
    if (!description.trim()) errors.description = 'Description is required.'

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccess('')
    setFormError('')

    const isValid = validate()
    if (!isValid) return

    setSubmitting(true)

    try {
      const reportId = id()
      let lat: number
      let lng: number
      if (pickedLat != null && pickedLng != null) {
        lat = pickedLat
        lng = pickedLng
        const inIndia = await isCoordinateInIndia(lat, lng)
        if (!inIndia) {
          setFieldErrors((prev) => ({ ...prev, location: 'Reports are accepted only within India.' }))
          setSubmitting(false)
          return
        }
      } else {
        const coords = await geocodeAddress(locationText)
        if (!coords) {
          setFieldErrors((prev) => ({ ...prev, location: 'Please enter a valid location in India.' }))
          setSubmitting(false)
          return
        }
        lat = coords.lat
        lng = coords.lng
        const inIndia = await isCoordinateInIndia(lat, lng)
        if (!inIndia) {
          setFieldErrors((prev) => ({ ...prev, location: 'Reports are accepted only within India.' }))
          setSubmitting(false)
          return
        }
      }

      if (photo) {
        const ai = await validateImageMatchesDescription(photo, description)
        if (!ai.ok) {
          setFormError(ai.reason || 'The attached photo does not appear to match the description.')
          setSubmitting(false)
          return
        }
      }

      // If a photo is attached, include a local preview URL and, if Supabase enabled, upload to storage for a public URL
      let media: string[] = []
      if (photo) {
        try { media.push(URL.createObjectURL(photo)) } catch {}
        if (isSupabaseEnabled()) {
          try {
            const publicUrl = await supabaseUploadReportPhoto(reportId, photo)
            if (publicUrl) media.unshift(publicUrl)
          } catch {}
        }
      }

      const newReport: Report = {
        report_id: reportId,
        category,
        description,
        summary:
          category +
          ' issue: ' +
          description.split(' ').slice(0, 12).join(' ') +
          (description.split(' ').length > 12 ? '...' : ''),
        priority,
        status: 'Pending',
        submitted_at: new Date().toISOString(),
        location_text: locationText,
        lat,
        lng,
        reporter: { name: user?.name || 'Citizen', phone: null, anonymous: false },
        media,
        assigned_department: null,
        assigned_officer_id: null,
        assigned_officer_name: null,
        deadline: null,
        timeline: [
          { actor: 'System', action: 'Report created', at: new Date().toISOString() },
        ],
      }

      const list = [newReport, ...loadReports()]
      saveReports(list)

      if (isSupabaseEnabled()) {
        const ok = await supabaseInsertReport(newReport)
        setSuccess(
          ok
            ? 'Report submitted and synced with government portal.'
            : 'Report submitted locally. Sync failed; will appear on government once connection is available.',
        )
      } else {
        setSuccess(
          'Report submitted locally. It will appear on the government side once Supabase sync is configured.',
        )
      }

      setLocationText('')
      setDescription('')
      setIncidentTime('')
      setPhoto(null)
      setPhotoPreview(null)
      setFieldErrors({})
      setPickedLat(null)
      setPickedLng(null)
    } catch (err) {
      console.error(err)
      setFormError('Something went wrong while submitting your report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setPhoto(f)
    if (f) {
      try {
        setPhotoPreview(URL.createObjectURL(f))
      } catch {
        setPhotoPreview(null)
      }
    } else {
      setPhotoPreview(null)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background/80 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert variant="info" className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <div>
            <div className="font-medium">Reports are shared with the relevant municipal department.</div>
            <div className="text-sm text-muted-foreground">
              Provide as much detail as possible to help your authorities respond faster.
            </div>
          </div>
        </Alert>

        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b bg-muted/60 px-6 py-4">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Report a civic issue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Help your local authorities respond faster by sharing clear details.
            </p>
          </div>

          <div className="px-6 py-6 sm:py-8">
            {formError && (
              <div className="mb-4">
                <Alert variant="error">{formError}</Alert>
              </div>
            )}
            {success && (
              <div className="mb-4">
                <Alert variant="success">{success}</Alert>
              </div>
            )}

            <form onSubmit={submit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={categoryId} className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    Category<span className="ml-0.5 text-destructive">*</span>
                  </Label>
                  <UISelect
                    id={categoryId}
                    className="mt-1"
                    value={category}
                    aria-invalid={!!fieldErrors.category}
                    aria-describedby={
                      'report-category-help' + (fieldErrors.category ? ' report-category-error' : '')
                    }
                    onChange={(e) => {
                      setCategory((e.target as HTMLSelectElement).value)
                      setFieldErrors((prev) => ({ ...prev, category: undefined }))
                    }}
                    options={categories.map((c) => ({ value: c, label: c }))}
                  />
                  <p
                    id="report-category-help"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    Choose the category that best matches the issue.
                  </p>
                  {fieldErrors.category && (
                    <p id="report-category-error" className="mt-1 text-xs text-destructive">
                      {fieldErrors.category}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor={priorityId} className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    Priority<span className="ml-0.5 text-destructive">*</span>
                  </Label>
                  <UISelect
                    id={priorityId}
                    className="mt-1"
                    value={priority}
                    aria-invalid={!!fieldErrors.priority}
                    aria-describedby={
                      'report-priority-help' + (fieldErrors.priority ? ' report-priority-error' : '')
                    }
                    onChange={(e) => {
                      setPriority((e.target as HTMLSelectElement).value as any)
                      setFieldErrors((prev) => ({ ...prev, priority: undefined }))
                    }}
                    options={priorities.map((p) => ({ value: p, label: p }))}
                  />
                  <p
                    id="report-priority-help"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    Mark as urgent if it risks safety or causes major disruption.
                  </p>
                  {fieldErrors.priority && (
                    <p id="report-priority-error" className="mt-1 text-xs text-destructive">
                      {fieldErrors.priority}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor={locationId} className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    Location<span className="ml-0.5 text-destructive">*</span>
                  </Label>
                  <Input
                    id={locationId}
                    className="mt-1"
                    value={locationText}
                    aria-invalid={!!fieldErrors.location}
                    aria-describedby={
                      'report-location-help' + (fieldErrors.location ? ' report-location-error' : '')
                    }
                    onChange={(e) => {
                      setLocationText(e.target.value)
                      setFieldErrors((prev) => ({ ...prev, location: undefined }))
                    }}
                    placeholder="e.g. Kothrud, Pune – near XYZ Chowk. Google Maps link if available."
                  />
                  <p
                    id="report-location-help"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    Include area, city, and a nearby landmark. You can also paste a Google Maps link.
                  </p>
                  {fieldErrors.location && (
                    <p id="report-location-error" className="mt-1 text-xs text-destructive">
                      {fieldErrors.location}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor={descriptionId} className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-700" aria-hidden="true" />
                  Description<span className="ml-0.5 text-destructive">*</span>
                </Label>
                <Textarea
                  id={descriptionId}
                  className="mt-1"
                  rows={5}
                  value={description}
                  aria-invalid={!!fieldErrors.description}
                  aria-describedby={
                    'report-description-help' +
                    (fieldErrors.description ? ' report-description-error' : '')
                  }
                  onChange={(e) => {
                    setDescription(e.target.value)
                    setFieldErrors((prev) => ({ ...prev, description: undefined }))
                  }}
                  placeholder={
                    '• What happened?\n• Since when?\n• How does it affect people or services?'
                  }
                />
                <p
                  id="report-description-help"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  Share clear, factual details. Avoid sharing personal information about others.
                </p>
                {fieldErrors.description && (
                  <p id="report-description-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.description}
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={photoId} className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-slate-700" aria-hidden="true" />
                    Attach photo <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id={photoId}
                    className="mt-1 cursor-pointer"
                    type="file"
                    accept="image/*"
                    onChange={onPhotoChange}
                  />
                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt="Attached issue preview"
                      className="mt-2 h-28 w-40 rounded border object-cover"
                    />
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    A clear photo often helps departments verify and resolve issues faster.
                  </p>
                </div>

                <div>
                  <Label htmlFor={incidentTimeId} className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-slate-700" aria-hidden="true" />
                    Approximate time of incident
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id={incidentTimeId}
                    className="mt-1"
                    type="datetime-local"
                    value={incidentTime}
                    onChange={(e) => setIncidentTime(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Helps authorities understand when the issue started or was noticed.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end border-t pt-4">
                <Button type="submit" loading={submitting} className="min-w-[150px]">
                  {submitting ? 'Submitting…' : 'Submit report'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
