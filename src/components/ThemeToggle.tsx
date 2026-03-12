import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  const current = theme === 'system' ? systemTheme : theme
  const isDark = current === 'dark'

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      className="inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-border bg-background/40 text-foreground/80 hover:bg-primary-light transition-colors"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
