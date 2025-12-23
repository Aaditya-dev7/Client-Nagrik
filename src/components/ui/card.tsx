import * as React from 'react'
import { motion } from 'framer-motion'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated'
  hover?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', hover = true, children, ...props }, ref) => {
    const variants = {
      default: 'bg-card border border-border',
      glass: 'bg-card/80 backdrop-blur-xl border border-white/10',
      elevated: 'bg-card shadow-lg border-0',
    }

    const Component = hover ? motion.div : 'div'
    const motionProps = hover ? {
      whileHover: { scale: 1.02, y: -4 },
      transition: { duration: 0.2 }
    } : {}

    return (
      <Component
        ref={ref}
        className={[
          'rounded-xl p-6 transition-all duration-200',
          variants[variant],
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
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={['mb-4', className].join(' ')} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => (
    <h3 ref={ref} className={['text-xl font-semibold', className].join(' ')} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', ...props }, ref) => (
    <p ref={ref} className={['text-sm text-muted-foreground', className].join(' ')} {...props} />
  )
)
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={className} {...props} />
  )
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={['mt-4 flex items-center gap-2', className].join(' ')} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'
