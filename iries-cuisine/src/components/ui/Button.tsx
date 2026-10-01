import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'dark'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong active:bg-brand-strong shadow-sm',
  secondary: 'bg-surface text-ink ring-1 ring-inset ring-line hover:bg-brand-soft/50',
  ghost: 'bg-transparent text-ink hover:bg-black/5',
  danger: 'bg-danger text-white hover:brightness-95',
  success: 'bg-success text-white hover:brightness-95',
  dark: 'bg-ink text-white hover:bg-black',
}

// Minimum 44px tall: comfortable tap targets on phones and kitchen tablets.
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
  xl: 'min-h-16 px-6 text-lg',
}

/** Same look as <Button>, for links (avoid putting a <button> inside an <a>). */
export function buttonClasses(opts: { variant?: Variant; size?: Size; block?: boolean; className?: string } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
    variants[opts.variant ?? 'primary'],
    sizes[opts.size ?? 'md'],
    opts.block && 'w-full',
    opts.className,
  )
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
