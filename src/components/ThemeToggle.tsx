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
      className="inline-flex items-center justify-center h-10 w-10 rounded-full border-2 border-border bg-gradient-to-br from-background to-muted shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-500 drop-shadow-sm" />
      ) : (
        <Moon className="h-5 w-5 text-slate-600 dark:text-slate-300 drop-shadow-sm" />
      )}
    </button>
  )
}
