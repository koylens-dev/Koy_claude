'use client'

import { ShoppingBag } from 'lucide-react'
import type { MenuItem } from '@/lib/types'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { formatCedis } from '@/lib/money'
import { ItemArt } from './ItemArt'
import { ItemOptionsForm, useItemOptions, type ItemSelection } from './ItemOptions'

export function ItemDialog({
  item,
  onClose,
  onAdd,
  actionLabel = 'Add to order',
}: {
  item: MenuItem
  onClose: () => void
  onAdd: (item: MenuItem, selection: ItemSelection) => void
  actionLabel?: string
}) {
  const state = useItemOptions(item)
  const soldOut = !item.is_available

  return (
    <Dialog
      open
      onClose={onClose}
      title={item.name}
      footer={
        <Button
          size="lg"
          block
          disabled={soldOut || state.missing.length > 0 || !state.selection}
          onClick={() => state.selection && onAdd(item, state.selection)}
        >
          <ShoppingBag className="size-5" aria-hidden />
          {soldOut ? 'Sold out' : `${actionLabel} · ${formatCedis(state.unit * state.quantity)}`}
        </Button>
      }
    >
      <div className="space-y-5">
        <ItemArt name={item.name} imagePath={item.image_path} className="aspect-[16/10] w-full rounded-2xl" sizes="(max-width: 640px) 100vw, 512px" />
        {item.description && <p className="text-[15px] leading-relaxed text-muted">{item.description}</p>}
        <ItemOptionsForm item={item} state={state} />
      </div>
    </Dialog>
  )
}
