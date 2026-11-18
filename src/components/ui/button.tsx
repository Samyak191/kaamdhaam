import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './utils'

const buttonVariants = cva('kd-button', {
  variants: { variant: { primary: 'kd-button-primary', outline: 'kd-button-outline', ghost: 'kd-button-ghost' }, size: { default: 'kd-button-default', sm: 'kd-button-sm', lg: 'kd-button-lg' } },
  defaultVariants: { variant: 'primary', size: 'default' },
})

export function Button({ className, variant, size, asChild = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
