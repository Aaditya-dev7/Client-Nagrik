import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { geocodeAddress, isCoordinateInIndia, reverseGeocode } from '@/lib/geocoding'
import { Report } from '@/lib/types'
import { loadReports, saveReports } from '@/lib/storage'
import { isSupabaseEnabled, supabaseInsertReport, supabaseUploadReportPhoto, checkDuplicateReport } from '@/lib/api'
import { getSupabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select as UISelect } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'
import { AlertTriangle, Flag, MapPin, FileText, Image as ImageIcon, Clock as ClockIcon, Info, Mic, Camera } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { validateImageMatchesDescription } from '@/lib/ai'
import { t, useLang } from '@/lib/i18n'

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
  const _lang = useLang()
  const { user } = useAuth()
  const loc = useLocation()
  const [category, setCategory] = useState('Pothole')
  const [otherCategory, setOtherCategory] = useState('')
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium')
  const [locationText, setLocationText] = useState('')
  const [description, setDescription] = useState('')
  const [incidentTime, setIncidentTime] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [pickedLat, setPickedLat] = useState<number | null>(null)
  const [pickedLng, setPickedLng] = useState<number | null>(null)

  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceLang, setVoiceLang] = useState<'en-IN' | 'hi-IN' | 'mr-IN'>(() => {
    const stored = localStorage.getItem('nagrikGPT_lang')
    if (stored === 'hi') return 'hi-IN'
    if (stored === 'mr') return 'mr-IN'
    return 'en-IN'
  })
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female')
  const [dictating, setDictating] = useState(false)
  const recognitionRef = React.useRef<any>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const lastPlayedKeywordRef = React.useRef<string | null>(null)

  // Sync voice language with top nav language selection
  React.useEffect(() => {
    const syncLang = () => {
      const stored = localStorage.getItem('nagrikGPT_lang')
      const newLang: 'en-IN' | 'hi-IN' | 'mr-IN' = stored === 'hi' ? 'hi-IN' : stored === 'mr' ? 'mr-IN' : 'en-IN'
      setVoiceLang(newLang)
    }
    window.addEventListener('storage', syncLang)
    window.addEventListener('nagrikGPT_lang_change', syncLang)
    return () => {
      window.removeEventListener('storage', syncLang)
      window.removeEventListener('nagrikGPT_lang_change', syncLang)
    }
  }, [])

  const [aiValidating, setAiValidating] = useState(false)
  const [aiOk, setAiOk] = useState(true)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiScore, setAiScore] = useState<number | null>(null)
  const [duplicateReport, setDuplicateReport] = useState<Report | null>(null)

  // Camera capture state
  const [showCamera, setShowCamera] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  // Local score calculation based on all form fields
  const localScore = React.useMemo(() => {
    let score = 0
    
    // Category (10 points)
    if (category && category !== 'Select category') score += 10
    
    // Priority (10 points)
    if (priority) score += 10
    
    // Location (20 points)
    if (locationText.trim().length >= 3) score += 10
    if (locationText.trim().length >= 10) score += 5
    if (pickedLat && pickedLng) score += 5
    
    // Description (40 points max)
    const words = description.trim().split(/\s+/).filter(Boolean)
    if (words.length >= 3) score += 5
    if (words.length >= 5) score += 5
    if (words.length >= 8) score += 5
    if (words.length >= 12) score += 5
    if (words.length >= 15) score += 5
    if (words.length >= 20) score += 5
    if (description.includes('.')) score += 5  // Proper sentences
    if (description.includes(',')) score += 3
    
    // Incident time (10 points)
    if (incidentTime) score += 10
    
    // Photo (10 points)
    if (photos.length > 0) score += 10
    
    return Math.min(score, 100)
  }, [category, priority, locationText, description, incidentTime, photos.length, pickedLat, pickedLng])

  // Combined score - prefer AI score if available, otherwise local
  const displayScore = aiScore !== null ? aiScore : localScore

  const validationImageUrl = React.useMemo(() => {
    // Prefer a Supabase public URL if the user attached a photo; otherwise use local preview
    return (photoPreviews[0] || '')
  }, [photoPreviews])

  // Local bad word filter (fallback if backend validation fails)
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

  const containsBadWords = (text: string): boolean => {
    const lower = text.toLowerCase()
    // Use word boundary matching to avoid false positives (e.g., 'class' matching 'ass')
    return BAD_WORDS.some(word => {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      return regex.test(lower)
    })
  }

  const validateTextWithAi = React.useCallback(async (inputText: string) => {
    const text = String(inputText || '').trim()
    if (!text) {
      setAiOk(false)
      setAiError(t('report.err.description_required', 'Description is required.'))
      setAiScore(null)
      return { ok: false, error: t('report.err.description_required', 'Description is required.') } as const
    }
    
    // Local bad word check (always run, even if backend fails)
    if (containsBadWords(text)) {
      setAiOk(false)
      setAiError(t('report.err.abusive', 'Abusive language detected. Please use respectful language.'))
      setAiScore(null)
      return { ok: false, error: t('report.err.abusive', 'Abusive language detected. Please use respectful language.') } as const
    }
    
    if (!isSupabaseEnabled()) {
      setAiOk(true)
      setAiError(null)
      setAiScore(null)
      return { ok: true } as const
    }
    const sb = getSupabase()
    if (!sb) {
      setAiOk(true)
      setAiError(null)
      setAiScore(null)
      return { ok: true } as const
    }
    setAiValidating(true)
    try {
      const res = await sb.functions.invoke('summarize', { body: { text, image_url: validationImageUrl } })
      console.log('Summarize response:', res)
      const data = (res as any)?.data as any
      console.log('Data:', data)
      
      // If backend returns data, process it
      if (data) {
        const ok = Boolean(data?.ok)
        const status = typeof data?.status === 'string' ? data.status : null
        const error = typeof data?.error === 'string' ? data.error : null
        const score = typeof data?.report_score === 'number' ? data.report_score : null
        console.log('Score from backend:', score)
        setAiScore(typeof score === 'number' ? score : null)
        
        // Only reject if explicitly flagged or error
        if (status === 'flagged' && error) {
          setAiOk(false)
          setAiError(error)
          return { ok: false, error } as const
        }
        
        // If ok is true or no explicit rejection, accept
        if (ok || !status || status === 'accepted') {
          setAiOk(true)
          setAiError(null)
          return { ok: true } as const
        }
        
        // Default: accept if no clear rejection
        setAiOk(true)
        setAiError(null)
        return { ok: true } as const
      }
      
      // If no data returned, accept (don't block submission)
      setAiOk(true)
      setAiError(null)
      setAiScore(null)
      return { ok: true } as const
    } catch (err) {
      // If backend fails, still allow submission (local bad word check already done)
      console.warn('Summarize function error:', err)
      setAiOk(true)
      setAiError(null)
      setAiScore(null)
      return { ok: true } as const
    } finally {
      setAiValidating(false)
    }
  }, [])

  React.useEffect(() => {
    let alive = true
    const id = window.setTimeout(() => {
      if (!alive) return
      // Only validate with AI if description has content
      if (description.trim().length >= 3) {
        validateTextWithAi(description)
      } else {
        setAiScore(null)
        setAiOk(false)
        setAiError(null)
      }
    }, 450)
    return () => { alive = false; window.clearTimeout(id) }
  }, [description, validateTextWithAi])

  const guideData = React.useMemo(() => ({
    category: {
      'en-IN': 'Select the type of issue, for example, road, water, or garbage.',
      'hi-IN': 'समस्या का प्रकार चुनें, जैसे सड़क, पानी, या कचरा।',
      'mr-IN': 'समस्येचा प्रकार निवडा, उदाहरणार्थ रस्ता, पाणी किंवा कचरा.'
    },
    priority: {
      'en-IN': 'Select the priority of the issue.',
      'hi-IN': 'समस्या की प्राथमिकता चुनें।',
      'mr-IN': 'समस्येची प्राथमिकता निवडा.'
    },
    location: {
      'en-IN': 'Enter the location or address of the issue.',
      'hi-IN': 'समस्या का पता या स्थान यहाँ लिखें।',
      'mr-IN': 'समस्येचा पत्ता किंवा स्थान येथे लिहा.'
    },
    incident_time: {
      'en-IN': 'Enter when the incident happened, if known.',
      'hi-IN': 'घटना का समय लिखें (यदि ज्ञात हो)।',
      'mr-IN': 'घटनेची वेळ लिहा (माहित असल्यास).' 
    },
    description: {
      'en-IN': 'Describe your issue in detail here.',
      'hi-IN': 'अपनी समस्या का विवरण यहाँ लिखें।',
      'mr-IN': 'इथे तुमचा इश्यू सांगा.'
    },
    photo: {
      'en-IN': 'Upload a photo of the issue if available.',
      'hi-IN': 'समस्या की फोटो अपलोड करें।',
      'mr-IN': 'समस्येचा फोटो अपलोड करा.'
    }
  }), [])

  // Map voiceLang to folder name
  const voiceLangToFolder: Record<string, string> = {
    'en-IN': 'english',
    'hi-IN': 'hindi',
    'mr-IN': 'marathi'
  }

  // Stop any playing audio
  const stopAudio = React.useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    lastPlayedKeywordRef.current = null
  }, [])

  // Play MP3 audio guide for a given keyword (category, description, image, location, priority, time, lang_confirm, other)
  const playVoiceGuide = React.useCallback((keyword: string, force: boolean = false) => {
    try {
      if (!voiceEnabled) return
      if (typeof window === 'undefined') return
      
      // Stop any currently playing audio
      stopAudio()
      
      const folder = voiceLangToFolder[voiceLang] || 'english'
      const gender = voiceGender || 'female'
      // Build path: /Client-Nagrik/voice/{language}/{keyword} ({gender}).mp3
      // Note: filename has space before parenthesis, e.g. "category (female).mp3"
      // vite base is /Client-Nagrik/ so public assets need that prefix
      const audioPath = `/Client-Nagrik/voice/${folder}/${keyword} (${gender}).mp3`
      const encodedPath = encodeURI(audioPath)
      
      console.log('Playing voice guide:', encodedPath)
      
      const audio = new Audio(encodedPath)
      audioRef.current = audio
      lastPlayedKeywordRef.current = keyword
      
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e, audio.error)
      })
      
      audio.play().catch((err) => {
        console.warn('Voice guide audio play failed:', err)
      })
    } catch (err) {
      console.warn('Voice guide error:', err)
    }
  }, [voiceEnabled, voiceLang, voiceGender, stopAudio])

  // Handle voice toggle - pause audio when disabled
  const handleVoiceToggle = React.useCallback(() => {
    const newEnabled = !voiceEnabled
    setVoiceEnabled(newEnabled)
    if (!newEnabled) {
      stopAudio()
    }
  }, [voiceEnabled, stopAudio])

  // Handle language change - play lang_confirm audio
  const handleVoiceLangChange = React.useCallback((newLang: 'en-IN' | 'hi-IN' | 'mr-IN') => {
    stopAudio()
    setVoiceLang(newLang)
    // Play lang_confirm after state updates
    setTimeout(() => {
      if (voiceEnabled) {
        const folder = voiceLangToFolder[newLang] || 'english'
        const gender = voiceGender || 'female'
        const audioPath = `/Client-Nagrik/voice/${folder}/lang_confirm (${gender}).mp3`
        const audio = new Audio(encodeURI(audioPath))
        audioRef.current = audio
        audio.play().catch(() => {})
      }
    }, 50)
  }, [voiceEnabled, voiceGender, stopAudio])

  // Handle gender change - play lang_confirm audio
  const handleVoiceGenderChange = React.useCallback((newGender: 'male' | 'female') => {
    stopAudio()
    setVoiceGender(newGender)
    // Play lang_confirm after state updates
    setTimeout(() => {
      if (voiceEnabled) {
        const folder = voiceLangToFolder[voiceLang] || 'english'
        const audioPath = `/Client-Nagrik/voice/${folder}/lang_confirm (${newGender}).mp3`
        const audio = new Audio(encodeURI(audioPath))
        audioRef.current = audio
        audio.play().catch(() => {})
      }
    }, 50)
  }, [voiceEnabled, voiceLang, stopAudio])

  const ensureRecognition = React.useCallback(() => {
    if (typeof window === 'undefined') return null
    const W: any = window as any
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!SR) return null
    if (!recognitionRef.current) {
      const r = new SR()
      r.continuous = false
      r.interimResults = false
      r.maxAlternatives = 1
      recognitionRef.current = r
    }
    recognitionRef.current.lang = voiceLang
    return recognitionRef.current
  }, [voiceLang])

  const startDictation = React.useCallback(() => {
    const rec = ensureRecognition()
    if (!rec) return
    try {
      setDictating(true)
      rec.onresult = (event: any) => {
        try {
          const transcript = event?.results?.[0]?.[0]?.transcript || ''
          if (transcript) setDescription((prev) => (prev ? (prev + ' ' + transcript) : transcript))
        } catch {}
      }
      rec.onerror = () => { setDictating(false) }
      rec.onend = () => { setDictating(false) }
      rec.start()
    } catch {
      setDictating(false)
    }
  }, [ensureRecognition])

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
    'Other',
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

    if (!category) errors.category = t('report.err.category', 'Please select a category.')
    if (category === 'Other' && !otherCategory.trim()) errors.category = t('report.err.category', 'Please select a category.')
    if (!priority) errors.priority = t('report.err.priority', 'Please select a priority.')
    
    // Location validation - must be specific
    if (!locationText.trim()) {
      errors.location = t('report.err.location_required', 'Location is required.')
    } else if (locationText.trim().length < 5) {
      errors.location = t('report.err.location_too_short', 'Please enter a more specific location (at least 5 characters).')
    } else if (!pickedLat && !pickedLng) {
      // Check for generic/vague locations
      const vagueLocations = ['india', 'mumbai', 'delhi', 'pune', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'near me', 'here', 'there', 'my area', 'my location']
      const isVague = vagueLocations.some(loc => locationText.toLowerCase().trim() === loc)
      if (isVague) {
        errors.location = t('report.err.location_vague', 'Please enter a specific address or use the map to pin exact location.')
      }
    }
    
    if (!description.trim()) errors.description = t('report.err.description_required', 'Description is required.')

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccess('')
    setFormError('')

    const isValid = validate()
    if (!isValid) return

    const v = await validateTextWithAi(description)
    if (!v.ok) {
      setFormError(v.error || t('report.err.invalid_text', 'Invalid complaint text.'))
      return
    }

    // Check for duplicate reports
    console.log('Checking for duplicates...', { description: description.slice(0, 50), category, locationText })
    const duplicateCheck = await checkDuplicateReport(description, category, locationText, pickedLat, pickedLng)
    console.log('Duplicate check result:', duplicateCheck)
    if (duplicateCheck.isDuplicate && duplicateCheck.existingReport) {
      setDuplicateReport(duplicateCheck.existingReport)
      setSubmitting(false)
      return
    }
    
    setDuplicateReport(null)

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
          setFieldErrors((prev) => ({ ...prev, location: t('report.err.only_india', 'Reports are accepted only within India.') }))
          setSubmitting(false)
          return
        }
      } else {
        const coords = await geocodeAddress(locationText)
        if (!coords) {
          setFieldErrors((prev) => ({ ...prev, location: t('report.err.valid_location_india', 'Please enter a valid location in India.') }))
          setSubmitting(false)
          return
        }
        lat = coords.lat
        lng = coords.lng
        const inIndia = await isCoordinateInIndia(lat, lng)
        if (!inIndia) {
          setFieldErrors((prev) => ({ ...prev, location: t('report.err.only_india', 'Reports are accepted only within India.') }))
          setSubmitting(false)
          return
        }
      }

      // Validate first photo if attached
      if (photos.length > 0) {
        const ai = await validateImageMatchesDescription(photos[0], description)
        if (!ai.ok) {
          setFormError(t('report.err.photo_mismatch', 'The attached photo does not appear to match the description.'))
          setSubmitting(false)
          return
        }
      }

      // If photos are attached, include local preview URLs and, if Supabase enabled, upload to storage for public URLs
      let media: string[] = []
      for (const photo of photos) {
        try { media.push(URL.createObjectURL(photo)) } catch {}
      }
      if (isSupabaseEnabled() && photos.length > 0) {
        for (const photo of photos) {
          try {
            const publicUrl = await supabaseUploadReportPhoto(reportId, photo)
            if (publicUrl) media.unshift(publicUrl)
          } catch {}
        }
      }

      const newReport: Report = {
        report_id: reportId,
        category,
        other_category: category === 'Other' ? otherCategory.trim() : null,
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
            ? t('report.success.synced', 'Report submitted and synced with government portal.')
            : t('report.success.local_sync_failed', 'Report submitted locally. Sync failed; will appear on government once connection is available.'),
        )
      } else {
        setSuccess(
          t('report.success.local_only', 'Report submitted locally. It will appear on the government side once Supabase sync is configured.'),
        )
      }

      setLocationText('')
      setDescription('')
      setIncidentTime('')
      setPhotos([])
      setPhotoPreviews([])
      setFieldErrors({})
      setPickedLat(null)
      setPickedLng(null)
    } catch (err) {
      console.error(err)
      setFormError(t('report.err.generic', 'Something went wrong while submitting your report. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFiles = Array.from(files)
    setPhotos(prev => [...prev, ...newFiles])
    const newPreviews = newFiles.map(f => {
      try {
        return URL.createObjectURL(f)
      } catch {
        return null
      }
    }).filter(Boolean) as string[]
    setPhotoPreviews(prev => [...prev, ...newPreviews])
    // Reset input so same files can be selected again
    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => {
      const url = prev[index]
      if (url) URL.revokeObjectURL(url)
      return prev.filter((_, i) => i !== index)
    })
  }

  // Camera capture functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      setCameraStream(stream)
      setShowCamera(true)
      // Attach stream to video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }, 100)
    } catch (error) {
      console.error('Camera access error:', error)
      alert(t('report.camera_error', 'Could not access camera. Please check permissions or use file upload instead.'))
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) return
      
      // Create file from blob
      const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
      
      // Add to photos array
      setPhotos(prev => [...prev, file])
      
      // Create preview
      const previewUrl = URL.createObjectURL(blob)
      setPhotoPreviews(prev => [...prev, previewUrl])
      
      // Close camera
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setShowCamera(false)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background/80 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert variant="info" className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <div>
            <div className="font-medium">{t('report.info.title', 'Reports are shared with the relevant municipal department.')}</div>
            <div className="text-sm text-muted-foreground">
              {t('report.info.subtitle', 'Provide as much detail as possible to help your authorities respond faster.')}
            </div>
          </div>
        </Alert>

        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b bg-muted/60 px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('report.title', 'Report a civic issue')}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('report.subtitle', 'Help your local authorities respond faster by sharing clear details.')}
                </p>
              </div>

              <div className="shrink-0">
                <div
                  className={[
                    'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                    aiValidating
                      ? 'border-border bg-background text-muted-foreground'
                      : displayScore >= 70
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : displayScore >= 50
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                  ].join(' ')}
                  title={t('report.score_title', 'Report Quality Score')}
                >
                  {aiValidating
                    ? t('report.score_checking', 'Checking…')
                    : `${t('report.score', 'Score')}: ${displayScore}`}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:py-8">
            {formError && !duplicateReport && (
              <div className="mb-4">
                <Alert variant="error">{formError}</Alert>
              </div>
            )}
            {duplicateReport && (
              <div className="mb-4">
                <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                        {t('report.duplicate_title', 'Duplicate Report Detected')}
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                        {t('report.duplicate_desc', 'A similar report already exists in the community. Please check the existing report or add more details to make your report unique.')}
                      </p>
                      <div className="bg-white/50 dark:bg-black/20 rounded-md p-3 mb-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          {t('report.existing_report', 'Existing Report')}:
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {duplicateReport.description?.slice(0, 150)}
                          {duplicateReport.description && duplicateReport.description.length > 150 ? '...' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {t('report.submitted_at', 'Submitted')}: {new Date(duplicateReport.submitted_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            nav(`/reports/${duplicateReport.report_id}`)
                          }}
                          className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-900"
                        >
                          {t('report.view_existing', 'View Existing Report')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            nav('/community')
                          }}
                          className="text-foreground/70"
                        >
                          {t('report.go_community', 'Go to Community')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDuplicateReport(null)}
                          className="text-muted-foreground"
                        >
                          {t('report.dismiss', 'Dismiss')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {success && (
              <div className="mb-4">
                <Alert variant="success">{success}</Alert>
              </div>
            )}

            <div className="mb-4 flex items-center justify-end gap-1.5 sm:gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-border bg-background px-2 sm:px-3 py-1 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
                onClick={handleVoiceToggle}
                aria-pressed={voiceEnabled}
              >
                {voiceEnabled ? '🔊 On' : '🔇 Off'}
              </button>
              <select
                className="h-7 sm:h-8 min-w-[70px] sm:min-w-[90px] rounded-full border border-border bg-background px-2 sm:px-3 text-[10px] sm:text-xs text-foreground"
                value={voiceLang}
                onChange={(e) => handleVoiceLangChange(e.target.value as any)}
                disabled={!voiceEnabled}
                aria-label={t('voice.language', 'Voice language')}
              >
                <option value="en-IN">English</option>
                <option value="hi-IN">Hindi</option>
                <option value="mr-IN">Marathi</option>
              </select>
              <select
                className="h-7 sm:h-8 min-w-[60px] sm:min-w-[70px] rounded-full border border-border bg-background px-2 sm:px-3 text-[10px] sm:text-xs text-foreground"
                value={voiceGender}
                onChange={(e) => handleVoiceGenderChange(e.target.value as 'male' | 'female')}
                disabled={!voiceEnabled}
                aria-label={t('voice.gender', 'Voice gender')}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>

            <form onSubmit={submit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={categoryId} className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    {t('report.category', 'Category')}<span className="ml-0.5 text-destructive">*</span>
                  </Label>
                  <UISelect
                    id={categoryId}
                    className="mt-1 w-full"
                    value={category}
                    aria-invalid={!!fieldErrors.category}
                    aria-describedby={
                      'report-category-help' + (fieldErrors.category ? ' report-category-error' : '')
                    }
                    onChange={(e) => {
                      const v = (e.target as HTMLSelectElement).value
                      setCategory(v)
                      if (v !== 'Other') setOtherCategory('')
                      setFieldErrors((prev) => ({ ...prev, category: undefined }))
                    }}
                    onFocus={() => playVoiceGuide('category')}
                    options={categories.map((c) => ({ value: c, label: c }))}
                  />
                  <p
                    id="report-category-help"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    {t('report.category_help', 'Choose the category that best matches the issue.')}
                  </p>
                  {fieldErrors.category && (
                    <p id="report-category-error" className="mt-1 text-xs text-destructive">
                      {fieldErrors.category}
                    </p>
                  )}
                </div>

                {category === 'Other' && (
                  <div>
                    <Label htmlFor="report-other-category">{t('report.other_issue', 'Other issue type')}<span className="ml-0.5 text-destructive">*</span></Label>
                    <Input
                      id="report-other-category"
                      className="mt-1"
                      value={otherCategory}
                      onChange={(e) => setOtherCategory(e.target.value)}
                      onFocus={() => playVoiceGuide('other')}
                      placeholder={t('report.other_issue_ph', 'e.g., Noise pollution, Stray dogs, Encroachment')}
                      maxLength={80}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor={priorityId} className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    {t('report.priority', 'Priority')}<span className="ml-0.5 text-destructive">*</span>
                  </Label>
                  <UISelect
                    id={priorityId}
                    className="mt-1 w-full"
                    value={priority}
                    aria-invalid={!!fieldErrors.priority}
                    aria-describedby={
                      'report-priority-help' + (fieldErrors.priority ? ' report-priority-error' : '')
                    }
                    onChange={(e) => {
                      setPriority((e.target as HTMLSelectElement).value as any)
                      setFieldErrors((prev) => ({ ...prev, priority: undefined }))
                    }}
                    onFocus={() => playVoiceGuide('priority')}
                    options={priorities.map((p) => ({ value: p, label: p }))}
                  />
                  <p
                    id="report-priority-help"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    {t('report.priority_help', 'Mark as urgent if it risks safety or causes major disruption.')}
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
                    {t('report.location', 'Location')}<span className="ml-0.5 text-destructive">*</span>
                  </Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id={locationId}
                      className="flex-1"
                      value={locationText}
                      aria-invalid={!!fieldErrors.location}
                      aria-describedby={
                        'report-location-help' + (fieldErrors.location ? ' report-location-error' : '')
                      }
                      onChange={(e) => {
                        setLocationText(e.target.value)
                        setFieldErrors((prev) => ({ ...prev, location: undefined }))
                      }}
                      onFocus={() => playVoiceGuide('location')}
                      placeholder={t('report.location_placeholder', 'e.g. Kothrud, Pune – near XYZ Chowk. Google Maps link if available.')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 px-3"
                      onClick={async () => {
                        if (!navigator.geolocation) {
                          alert(t('report.geolocation_not_supported', 'Geolocation is not supported by your browser'))
                          return
                        }
                        navigator.geolocation.getCurrentPosition(
                          async (pos) => {
                            const { latitude, longitude } = pos.coords
                            setPickedLat(latitude)
                            setPickedLng(longitude)
                            // Try to get address via reverse geocoding
                            try {
                              const address = await reverseGeocode(latitude, longitude)
                              if (address) {
                                setLocationText(address)
                              } else {
                                setLocationText(prev => prev || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
                              }
                            } catch {
                              setLocationText(prev => prev || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
                            }
                            setFieldErrors((prev) => ({ ...prev, location: undefined }))
                          },
                          (err) => {
                            console.error('Geolocation error:', err)
                            alert(t('report.geolocation_error', 'Could not get your location. Please enter manually.'))
                          },
                          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                        )
                      }}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>
                  <p
                    id="report-location-help"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    {t('report.location_help', 'Include area, city, and a nearby landmark. You can also paste a Google Maps link.')}
                  </p>
                  {fieldErrors.location && (
                    <p id="report-location-error" className="mt-1 text-xs text-destructive">
                      {fieldErrors.location}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <div className="relative">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Describe the issue, impact, and exact spot."
                    onFocus={() => playVoiceGuide('description')}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2 inline-flex items-center justify-center rounded-md border border-border bg-background/80 p-1.5 text-muted-foreground hover:text-foreground"
                    onClick={startDictation}
                    title={dictating ? t('voice.listening', 'Listening…') : t('voice.dictate', 'Dictate')}
                  >
                    <Mic className={['h-4 w-4', dictating ? 'text-primary' : ''].join(' ')} />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor={photoId} className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-slate-700" aria-hidden="true" />
                    {t('report.photo', 'Attach photos')} <span className="text-xs text-muted-foreground">({t('report.optional', 'optional')})</span>
                  </Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id={photoId}
                      className="flex-1 cursor-pointer"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={onPhotoChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 px-3"
                      onClick={startCamera}
                      title={t('report.capture_photo', 'Capture photo from camera')}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                  {photoPreviews.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {photoPreviews.map((preview, idx) => (
                        <div key={idx} className="relative">
                          <img
                            src={preview}
                            alt={`Attached issue preview ${idx + 1}`}
                            className="h-20 w-20 rounded border object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center hover:bg-destructive/80"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('report.photo_help', 'Clear photos help departments verify and resolve issues faster. You can add multiple photos.')}
                  </p>
                </div>

                <div>
                  <Label htmlFor={incidentTimeId} className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-slate-700" aria-hidden="true" />
                    {t('report.incident_time', 'Approximate time of incident')}
                    <span className="text-xs text-muted-foreground">({t('report.optional', 'optional')})</span>
                  </Label>
                  <Input
                    id={incidentTimeId}
                    className="mt-1"
                    type="datetime-local"
                    value={incidentTime}
                    onChange={(e) => setIncidentTime(e.target.value)}
                    onFocus={() => playVoiceGuide('time')}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('report.incident_time_help', 'Helps authorities understand when the issue started or was noticed.')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end border-t pt-4">
                <Button type="submit" loading={submitting} disabled={submitting || (isSupabaseEnabled() && !aiOk && description.trim().length >= 3)} className="min-w-[150px]">
                  {submitting ? t('report.submitting') : (aiValidating ? t('report.validating', 'Checking…') : t('report.submit'))}
                </Button>
                {aiError && (
                  <div className="ml-3 text-xs text-destructive">{aiError}</div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Camera Capture Modal */}
        {showCamera && (
          <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
            <div className="bg-card rounded-lg p-4 max-w-2xl w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t('report.camera_title', 'Capture Photo')}</h3>
                <Button variant="ghost" size="sm" onClick={stopCamera}>×</Button>
              </div>
              
              <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto max-h-[60vh] object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={stopCamera}>
                  {t('report.camera_cancel', 'Cancel')}
                </Button>
                <Button onClick={capturePhoto} className="gap-2">
                  <Camera className="h-4 w-4" />
                  {t('report.camera_capture', 'Capture')}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center mt-3">
                {t('report.camera_tip', 'Position the issue clearly in the frame before capturing')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
