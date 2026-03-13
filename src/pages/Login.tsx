import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { Eye, EyeOff, Mail, Lock, User, Phone, Shield, Check, X, AlertTriangle } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'

// Password strength checker
function checkPasswordStrength(password: string): { score: number; checks: { label: string; passed: boolean }[] } {
  const checks = [
    { label: 'At least 8 characters', passed: password.length >= 8 },
    { label: 'Contains uppercase letter', passed: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter', passed: /[a-z]/.test(password) },
    { label: 'Contains number', passed: /[0-9]/.test(password) },
    { label: 'Contains special character', passed: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ]
  const score = checks.filter(c => c.passed).length
  return { score, checks }
}

// Phone validation for India
function validatePhone(phone: string): boolean {
  const cleanPhone = phone.replace(/\D/g, '')
  return cleanPhone.length === 10 && /^[6-9]/.test(cleanPhone)
}

// Email validation
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function Login() {
  const { login, register } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [keepMeSignedIn, setKeepMeSignedIn] = useState(true) // Default to true
  const [verificationMsg, setVerificationMsg] = useState('')

  const passwordStrength = checkPasswordStrength(password)

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) return

    let cancelled = false

    const run = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const errorCode = url.searchParams.get('error_code') || url.searchParams.get('error')

        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
        const hashParams = new URLSearchParams(hash)
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        if (errorCode) {
          if (!cancelled) setVerificationMsg('')
          return
        }

        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code)
          if (error) return
          if (cancelled) return
          setVerificationMsg('Verification completed. You can now sign in.')
          window.history.replaceState({}, '', url.origin + url.pathname)
          return
        }

        if (access_token && refresh_token && (type === 'recovery' || type === 'invite' || type === 'signup')) {
          const { error } = await sb.auth.setSession({ access_token, refresh_token })
          if (error) return
          if (cancelled) return
          setVerificationMsg('Verification completed. You can now sign in.')
          window.history.replaceState({}, '', url.origin + url.pathname)
          return
        }
      } catch {}
    }

    run()
    return () => { cancelled = true }
  }, [])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (mode === 'register') {
      if (!name.trim() || name.trim().length < 2) {
        errors.name = 'Name must be at least 2 characters'
      }
      if (!validatePhone(phone)) {
        errors.phone = 'Please enter a valid 10-digit Indian mobile number'
      }
    }

    if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (mode === 'register') {
      if (passwordStrength.score < 3) {
        errors.password = 'Password is too weak. Please follow the requirements below.'
      }
      if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      }
    }

    if (mode === 'login' && !password) {
      errors.password = 'Password is required'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setVerificationMsg('')
    
    if (!validateForm()) return

    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password, keepMeSignedIn)
        nav('/report')
        return
      } else {
        const res = await register(name, email, password, phone)
        if (res?.needsEmailConfirmation) {
          setMode('login')
          setVerificationMsg('Verification email sent. Please confirm your email, then sign in.')
          return
        }
      }
    } catch (e: any) {
      setErr(e.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getStrengthColor = (score: number): string => {
    if (score <= 1) return 'bg-red-500'
    if (score <= 2) return 'bg-orange-500'
    if (score <= 3) return 'bg-yellow-500'
    if (score <= 4) return 'bg-lime-500'
    return 'bg-green-500'
  }

  const getStrengthLabel = (score: number): string => {
    if (score <= 1) return 'Very Weak'
    if (score <= 2) return 'Weak'
    if (score <= 3) return 'Fair'
    if (score <= 4) return 'Strong'
    return 'Very Strong'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-primary to-orange-400 shadow-lg mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">NagrikGPT</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === 'login' ? 'Welcome back, Citizen' : 'Create your account'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => { setMode('login'); setFieldErrors({}); setErr(''); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('auth.login', 'Login')}
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setFieldErrors({}); setErr(''); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('auth.register', 'Register')}
            </button>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="p-6 space-y-4">
            {verificationMsg && (
              <Alert variant="success" className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                {verificationMsg}
              </Alert>
            )}
            {err && (
              <Alert variant="error" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {err}
              </Alert>
            )}

            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="name">{t('auth.name', 'Full Name')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className={`pl-10 ${fieldErrors.name ? 'border-destructive' : ''}`}
                  />
                </div>
                {fieldErrors.name && (
                  <p className="text-xs text-destructive">{fieldErrors.name}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email', 'Email Address')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`pl-10 ${fieldErrors.email ? 'border-destructive' : ''}`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="phone">{t('auth.phone', 'Mobile Number')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <span className="absolute left-10 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+91</span>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={`pl-16 ${fieldErrors.phone ? 'border-destructive' : ''}`}
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`pl-10 pr-10 ${fieldErrors.password ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-destructive">{fieldErrors.password}</p>
              )}

              {/* Password strength indicator */}
              {mode === 'register' && password && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getStrengthColor(passwordStrength.score)}`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {getStrengthLabel(passwordStrength.score)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {passwordStrength.checks.map((check, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs">
                        {check.passed ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className={check.passed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirm_password', 'Confirm Password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={`pl-10 pr-10 ${fieldErrors.confirmPassword ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            )}

            {/* Keep me signed in option - only for login mode */}
            {mode === 'login' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="keepMeSignedIn"
                  checked={keepMeSignedIn}
                  onChange={(e) => setKeepMeSignedIn(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="keepMeSignedIn" className="text-sm font-normal cursor-pointer">
                  {t('auth.keep_signed_in', 'Keep me signed in')}
                </Label>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-medium"
              loading={loading}
              disabled={loading}
            >
              {loading
                ? t('auth.processing', 'Processing...')
                : mode === 'login'
                  ? t('auth.login', 'Login')
                  : t('auth.register', 'Create Account')}
            </Button>

            {mode === 'login' && (
              <div className="text-center">
                <button type="button" className="text-sm text-primary hover:underline">
                  {t('auth.forgot_password', 'Forgot password?')}
                </button>
              </div>
            )}
          </form>

          {/* Security notice */}
          <div className="px-6 pb-6">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                {mode === 'register'
                  ? 'Your information is protected with industry-standard encryption. We never share your data with third parties.'
                  : 'Secure login with end-to-end encryption. Your credentials are never stored on our servers.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our{' '}
          <a href="#" className="text-primary hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-primary hover:underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}
