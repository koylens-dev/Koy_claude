'use client'

import { useRouter } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'
import type { MenuItem } from '@/lib/types'
import { ItemOptionsForm, useItemOptions } from '@/components/menu/ItemOptions'
import { Button } from '@/components/ui/Button'
import { formatCedis } from '@/lib/money'
import { useCart } from '@/components/customer/CartProvider'
import { useToast } from '@/components/ui/Toast'

export function ItemPageForm({ item }: { item: MenuItem }) {
  const state = useItemOptions(item)
  const cart = useCart()
  const toast = useToast()
  const router = useRouter()

  return (
    <div className="space-y-6">
      <ItemOptionsForm item={item} state={state} />
      <Button
        size="lg"
        block
        disabled={!item.is_available || state.missing.length > 0 || !state.selection}
        onClick={() => {
          const sel = state.selection!
          cart.add({
            itemId: item.id,
            slug: item.slug,
            name: item.name,
            imagePath: item.image_path,
            portionId: sel.portionId,
            portionName: sel.portionName,
            portionPrice: sel.portionPrice,
            options: sel.options,
            quantity: sel.quantity,
            notes: sel.notes,
          })
          toast(`Added ${sel.quantity} × ${item.name}`, 'success')
          router.push('/')
        }}
      >
        <ShoppingBag className="size-5" aria-hidden />
        {item.is_available ? `Add to order · ${formatCedis(state.unit * state.quantity)}` : 'Sold out'}
      </Button>
    </div>
  )
}
