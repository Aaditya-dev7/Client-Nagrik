import React from 'react'

type Props = {
  show: boolean
  label?: string
}

export default function LoadingOverlay({ show, label = 'Loading…' }: Props) {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm pointer-events-none">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <div className="text-sm font-medium text-primary drop-shadow-sm">{label}</div>
      </div>
    </div>
  )
}
