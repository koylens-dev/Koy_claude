import Image from 'next/image'
import { menuImageUrl } from '@/lib/public-env'
import { cn } from '@/lib/cn'

const PALETTE = ['#1b4e22', '#315d04', '#1d7442', '#0c1c14', '#2c5a35']

/** Dish photo, or a warm branded placeholder until the owner uploads one. */
export function ItemArt({
  name,
  imagePath,
  className,
  sizes = '(max-width: 640px) 40vw, 240px',
  priority,
}: {
  name: string
  imagePath: string | null
  className?: string
  sizes?: string
  priority?: boolean
}) {
  const url = menuImageUrl(imagePath)
  if (url) {
    return (
      <div className={cn('relative overflow-hidden bg-brand-soft', className)}>
        <Image src={url} alt={name} fill sizes={sizes} quality={60} className="object-cover" priority={priority} />
      </div>
    )
  }
  const color = PALETTE[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length]
  const initials = name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <div
      className={cn('relative grid place-items-center overflow-hidden', className)}
      style={{ background: `radial-gradient(circle at 30% 25%, ${color}aa, ${color})` }}
      aria-hidden
    >
      <span className="font-display text-3xl font-semibold text-gold drop-shadow">{initials}</span>
    </div>
  )
}
