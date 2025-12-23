import * as React from 'react'
import { motion } from 'framer-motion'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', variant = 'default', size = 'md', animate = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-primary/10 text-primary border-primary/20',
      success: 'bg-success/10 text-success border-success/20',
      warning: 'bg-warning/10 text-warning border-warning/20',
      destructive: 'bg-destructive/10 text-destructive border-destructive/20',
      info: 'bg-info/10 text-info border-info/20',
      secondary: 'bg-secondary text-secondary-foreground border-border',
    }

    const sizes = {
      sm: 'text-xs px-2 py-0.5',
      md: 'text-sm px-2.5 py-1',
      lg: 'text-base px-3 py-1.5',
    }

    const Component = animate ? motion.div : 'div'
    const motionProps = animate ? {
      initial: { scale: 0.8, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      transition: { duration: 0.2 }
    } : {}

    return (
      <Component
        ref={ref}
        className={[
          'inline-flex items-center gap-1 rounded-full border font-medium transition-colors',
          variants[variant],
          sizes[size],
          className,
        ].join(' ')}
        {...motionProps}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
Badge.displayName = 'Badge'
