import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect } from 'react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [open])

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className={[
                'relative w-full bg-card rounded-2xl shadow-2xl border border-border',
                'max-h-[90vh] overflow-y-auto',
                sizes[size],
              ].join(' ')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border p-6 flex items-start justify-between">
                <div>
                  {title && <h2 className="text-2xl font-semibold">{title}</h2>}
                  {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground transition-colors rounded-lg p-1 hover:bg-accent"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
