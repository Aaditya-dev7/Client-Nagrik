import * as React from 'react'

export function Alert({ className = '', variant = 'info', children }: { className?: string; variant?: 'success' | 'error' | 'info' | 'warning'; children: React.ReactNode }) {
  const variants: Record<string, string> = {
    success: 'bg-success-light text-success border-success/30',
    error: 'bg-destructive-light text-destructive border-destructive/30',
    info: 'bg-info-light text-info border-info/30',
    warning: 'bg-warning-light text-warning border-warning/30',
  }
  return (
    <div role="status" className={[
      'w-full rounded-md border px-3 py-2 text-sm',
      variants[variant],
      className,
    ].join(' ')}>
      {children}
    </div>
  )
}
