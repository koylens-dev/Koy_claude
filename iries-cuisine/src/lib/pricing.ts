// Server-side pricing. The browser never tells us a price: it sends item, portion
// and option IDs, and we price them from the database. Pure functions, unit tested.

import type { DeliveryZone, Fulfilment, MenuItem, OrderModifierSnapshot } from './types'

export type CartLineInput = {
  itemId: string
  portionId: string
  optionIds: string[]
  quantity: number
  notes?: string | null
}

export type PricedLine = {
  menu_item_id: string
  portion_id: string
  item_name: string
  portion_name: string
  modifiers: OrderModifierSnapshot[]
  unit_price_pesewas: number
  quantity: number
  line_total_pesewas: number
  notes: string | null
}

export type LineIssueCode =
  | 'item_not_found'
  | 'item_unavailable'
  | 'portion_invalid'
  | 'option_invalid'
  | 'option_unavailable'
  | 'modifier_min'
  | 'modifier_max'
  | 'quantity_invalid'

export type LineIssue = { index: number; itemId: string; code: LineIssueCode; message: string }

export const MAX_QUANTITY = 50
export const MAX_LINES = 40

export function priceLines(
  menu: Map<string, MenuItem>,
  lines: CartLineInput[],
): { lines: PricedLine[]; issues: LineIssue[]; subtotal: number } {
  const priced: PricedLine[] = []
  const issues: LineIssue[] = []

  lines.forEach((line, index) => {
    const issue = (code: LineIssueCode, message: string) => issues.push({ index, itemId: line.itemId, code, message })
    const item = menu.get(line.itemId)
    if (!item || !item.is_active) return issue('item_not_found', 'This dish is no longer on the menu.')
    if (!item.is_available) return issue('item_unavailable', `${item.name} is sold out right now.`)
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      return issue('quantity_invalid', `Quantity for ${item.name} must be between 1 and ${MAX_QUANTITY}.`)
    }

    const portion = item.portions.find((p) => p.id === line.portionId && p.is_active)
    if (!portion) return issue('portion_invalid', `Please choose a size for ${item.name} again.`)

    const chosen = new Set(line.optionIds)
    const modifiers: OrderModifierSnapshot[] = []
    let modifiersTotal = 0
    let failed = false

    // every chosen option must belong to a group attached to this item
    const allOptionIds = new Set(item.modifier_groups.flatMap((g) => g.options.map((o) => o.id)))
    for (const id of chosen) {
      if (!allOptionIds.has(id)) {
        issue('option_invalid', `An extra on ${item.name} is no longer offered.`)
        failed = true
        break
      }
    }
    if (failed) return

    for (const group of [...item.modifier_groups].sort((a, b) => a.sort_order - b.sort_order)) {
      const picked = group.options.filter((o) => chosen.has(o.id)).sort((a, b) => a.sort_order - b.sort_order)
      if (picked.length < group.min_select) {
        issue('modifier_min', `Please choose ${group.name.toLowerCase()} for ${item.name}.`)
        failed = true
        break
      }
      if (picked.length > group.max_select) {
        issue('modifier_max', `Choose at most ${group.max_select} for ${group.name} on ${item.name}.`)
        failed = true
        break
      }
      for (const option of picked) {
        if (!option.is_available) {
          issue('option_unavailable', `${option.name} is sold out.`)
          failed = true
          break
        }
        modifiers.push({
          group_id: group.id,
          group: group.name,
          option_id: option.id,
          option: option.name,
          price_pesewas: option.price_pesewas,
        })
        modifiersTotal += option.price_pesewas
      }
      if (failed) break
    }
    if (failed) return

    const unit = portion.price_pesewas + modifiersTotal
    const notes = line.notes?.trim().slice(0, 200) || null
    priced.push({
      menu_item_id: item.id,
      portion_id: portion.id,
      item_name: item.name,
      portion_name: portion.name,
      modifiers,
      unit_price_pesewas: unit,
      quantity: line.quantity,
      line_total_pesewas: unit * line.quantity,
      notes,
    })
  })

  const subtotal = priced.reduce((sum, l) => sum + l.line_total_pesewas, 0)
  return { lines: priced, issues, subtotal }
}

export type OrderIssueCode =
  | 'empty'
  | 'too_many_lines'
  | 'zone_required'
  | 'zone_inactive'
  | 'below_minimum'
  | 'delivery_disabled'
  | 'pickup_disabled'

export type OrderIssue = { code: OrderIssueCode; message: string }

export function computeTotals(opts: {
  subtotal: number
  lineCount: number
  fulfilment: Fulfilment
  zone: DeliveryZone | null
  deliveryEnabled: boolean
  pickupEnabled: boolean
  discount?: number
}): { deliveryFee: number; discount: number; total: number; issues: OrderIssue[] } {
  const issues: OrderIssue[] = []
  let deliveryFee = 0

  if (opts.lineCount === 0) issues.push({ code: 'empty', message: 'Your cart is empty.' })
  if (opts.lineCount > MAX_LINES) {
    issues.push({ code: 'too_many_lines', message: 'That is a big order! Please use our catering form instead.' })
  }

  if (opts.fulfilment === 'delivery') {
    if (!opts.deliveryEnabled) issues.push({ code: 'delivery_disabled', message: 'Delivery is paused right now — pickup is available.' })
    if (!opts.zone) {
      issues.push({ code: 'zone_required', message: 'Choose your delivery area.' })
    } else if (!opts.zone.is_active) {
      issues.push({ code: 'zone_inactive', message: `We are not delivering to ${opts.zone.name} right now.` })
    } else {
      deliveryFee = opts.zone.fee_pesewas
      if (opts.subtotal < opts.zone.min_order_pesewas) {
        issues.push({
          code: 'below_minimum',
          message: `Minimum order for ${opts.zone.name} is GH₵${(opts.zone.min_order_pesewas / 100).toFixed(2)} (food only).`,
        })
      }
    }
  } else if (!opts.pickupEnabled) {
    issues.push({ code: 'pickup_disabled', message: 'Pickup is paused right now — delivery is available.' })
  }

  const discount = Math.max(0, Math.min(opts.discount ?? 0, opts.subtotal))
  return { deliveryFee, discount, total: opts.subtotal + deliveryFee - discount, issues }
}
