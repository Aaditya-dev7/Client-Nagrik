import * as React from 'react'
import { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (message: string, variant: ToastVariant, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, variant: ToastVariant, duration = 5000) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, variant, duration }])
    
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const variants = {
    success: { bg: 'bg-success/10', border: 'border-success/30', text: 'text-success', Icon: CheckCircle },
    error: { bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive', Icon: AlertCircle },
    info: { bg: 'bg-info/10', border: 'border-info/30', text: 'text-info', Icon: Info },
    warning: { bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-warning', Icon: AlertTriangle },
  }

  const style = variants[toast.variant]
  const Icon = style.Icon

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={[
        'flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-lg',
        style.bg,
        style.border,
      ].join(' ')}
    >
      <Icon className={['w-5 h-5 flex-shrink-0', style.text].join(' ')} />
      <p className="text-sm flex-1 text-foreground">{toast.message}</p>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
