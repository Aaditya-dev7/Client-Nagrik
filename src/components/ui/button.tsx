import * as React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', loading, children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2'
    const variants: Record<string, string> = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      outline: 'border border-input bg-background hover:bg-accent hover:text-foreground',
      ghost: 'hover:bg-accent hover:text-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    }
    return (
      <button ref={ref} className={[base, variants[variant], className].join(' ')} {...props}>
        {loading && (
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
