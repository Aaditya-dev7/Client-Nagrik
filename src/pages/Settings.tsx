import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import ThemeToggle from '@/components/ThemeToggle'
import { t, useLang } from '@/lib/i18n'

export default function SettingsPage() {
  const _lang = useLang()
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('settings.title', 'Settings')}</h1>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <h2 className="text-sm font-medium text-foreground/80">{t('settings.appearance', 'Appearance')}</h2>
        <p className="text-xs text-muted-foreground mt-1">{t('settings.appearance_sub', 'Choose how NagrikGPT looks on your device.')}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTheme('light')}
            className={`px-4 py-2 rounded-full border text-sm transition ${theme === 'light' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-border hover:bg-primary-light'}`}
          >
            {t('settings.light', 'Light')}
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`px-4 py-2 rounded-full border text-sm transition ${theme === 'dark' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-border hover:bg-primary-light'}`}
          >
            {t('settings.dark', 'Dark')}
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`px-4 py-2 rounded-full border text-sm transition ${theme === 'system' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-border hover:bg-primary-light'}`}
          >
            {t('settings.system', 'System')}
          </button>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          {t('settings.current_theme', 'Current theme:')}{' '}
          <span className="font-medium">{theme === 'system' ? `System (${systemTheme})` : theme}</span>
        </div>
      </section>
    </div>
  )
}
