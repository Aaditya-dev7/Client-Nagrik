import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import ThemeToggle from '@/components/ThemeToggle'

export default function SettingsPage() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <h2 className="text-sm font-medium text-foreground/80">Appearance</h2>
        <p className="text-xs text-muted-foreground mt-1">Choose how NagrikGPT looks on your device.</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTheme('light')}
            className={`px-4 py-2 rounded-full border text-sm transition ${theme === 'light' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-border hover:bg-primary-light'}`}
          >
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`px-4 py-2 rounded-full border text-sm transition ${theme === 'dark' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-border hover:bg-primary-light'}`}
          >
            Dark
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`px-4 py-2 rounded-full border text-sm transition ${theme === 'system' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-foreground border-border hover:bg-primary-light'}`}
          >
            System
          </button>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Current theme: <span className="font-medium">{theme === 'system' ? `System (${systemTheme})` : theme}</span>
        </div>
      </section>
    </div>
  )
}
