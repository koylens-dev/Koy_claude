import { describe, expect, it } from 'vitest'
import { computeTotals, priceLines } from '../pricing'
import type { DeliveryZone, MenuItem } from '../types'

const spice = {
  id: 'g-spice', name: 'Spice level', kind: 'spice' as const, min_select: 1, max_select: 1, sort_order: 0,
  options: [
    { id: 'o-mild', group_id: 'g-spice', name: 'Mild', price_pesewas: 0, is_available: true, is_default: false, sort_order: 1 },
    { id: 'o-hot', group_id: 'g-spice', name: 'Hot', price_pesewas: 0, is_available: true, is_default: true, sort_order: 2 },
  ],
}
const protein = {
  id: 'g-protein', name: 'Extra protein', kind: 'addon' as const, min_select: 0, max_select: 2, sort_order: 1,
  options: [
    { id: 'o-chicken', group_id: 'g-protein', name: 'Grilled chicken', price_pesewas: 3000, is_available: true, is_default: false, sort_order: 1 },
    { id: 'o-egg', group_id: 'g-protein', name: 'Boiled egg', price_pesewas: 500, is_available: true, is_default: false, sort_order: 2 },
    { id: 'o-fish', group_id: 'g-protein', name: 'Fried fish', price_pesewas: 2500, is_available: false, is_default: false, sort_order: 3 },
  ],
}
const jollof: MenuItem = {
  id: 'i-jollof', category_id: 'c', name: 'Jollof', slug: 'jollof', description: null, image_path: null,
  is_available: true, is_active: true, is_featured: false, dietary_tags: [], sort_order: 0,
  portions: [
    { id: 'p-reg', menu_item_id: 'i-jollof', name: 'Regular', price_pesewas: 8500, is_default: true, is_active: true, sort_order: 0 },
    { id: 'p-large', menu_item_id: 'i-jollof', name: 'Large', price_pesewas: 11000, is_default: false, is_active: true, sort_order: 1 },
    { id: 'p-old', menu_item_id: 'i-jollof', name: 'Old size', price_pesewas: 5000, is_default: false, is_active: false, sort_order: 2 },
  ],
  modifier_groups: [spice, protein],
}
const soldOut: MenuItem = { ...jollof, id: 'i-soldout', name: 'Tilapia', is_available: false, portions: [{ ...jollof.portions[0], id: 'p-t', menu_item_id: 'i-soldout' }] }
const menu = new Map([jollof, soldOut].map((i) => [i.id, i]))

describe('priceLines', () => {
  it('prices from the database, never from the client', () => {
    const r = priceLines(menu, [{ itemId: 'i-jollof', portionId: 'p-large', optionIds: ['o-hot', 'o-chicken', 'o-egg'], quantity: 2 }])
    expect(r.issues).toEqual([])
    expect(r.lines[0].unit_price_pesewas).toBe(11000 + 3000 + 500)
    expect(r.lines[0].line_total_pesewas).toBe(29000)
    expect(r.subtotal).toBe(29000)
    expect(r.lines[0].modifiers.map((m) => m.option)).toEqual(['Hot', 'Grilled chicken', 'Boiled egg'])
  })

  it('enforces required groups and maximums', () => {
    expect(priceLines(menu, [{ itemId: 'i-jollof', portionId: 'p-reg', optionIds: [], quantity: 1 }]).issues[0].code).toBe('modifier_min')
    expect(priceLines(menu, [{ itemId: 'i-jollof', portionId: 'p-reg', optionIds: ['o-mild', 'o-hot'], quantity: 1 }]).issues[0].code).toBe('modifier_max')
  })

  it('rejects sold-out items, sold-out options, foreign options and retired portions', () => {
    expect(priceLines(menu, [{ itemId: 'i-soldout', portionId: 'p-t', optionIds: ['o-hot'], quantity: 1 }]).issues[0].code).toBe('item_unavailable')
    expect(priceLines(menu, [{ itemId: 'i-jollof', portionId: 'p-reg', optionIds: ['o-hot', 'o-fish'], quantity: 1 }]).issues[0].code).toBe('option_unavailable')
    expect(priceLines(menu, [{ itemId: 'i-jollof', portionId: 'p-reg', optionIds: ['o-hot', 'o-made-up'], quantity: 1 }]).issues[0].code).toBe('option_invalid')
    expect(priceLines(menu, [{ itemId: 'i-jollof', portionId: 'p-old', optionIds: ['o-hot'], quantity: 1 }]).issues[0].code).toBe('portion_invalid')
    expect(priceLines(menu, [{ itemId: 'nope', portionId: 'p-reg', optionIds: [], quantity: 1 }]).issues[0].code).toBe('item_not_found')
  })

  it('validates quantity', () => {
    expect(priceLines(menu, [{ itemId: 'i-jollof', portionId: 'p-reg', optionIds: ['o-hot'], quantity: 0 }]).issues[0].code).toBe('quantity_invalid')
    expect(priceLines(menu, [{ itemId: 'i-jollof', portionId: 'p-reg', optionIds: ['o-hot'], quantity: 1.5 }]).issues[0].code).toBe('quantity_invalid')
  })

  it('keeps good lines when one line has a problem (with its index)', () => {
    const r = priceLines(menu, [
      { itemId: 'i-soldout', portionId: 'p-t', optionIds: ['o-hot'], quantity: 1 },
      { itemId: 'i-jollof', portionId: 'p-reg', optionIds: ['o-hot'], quantity: 1 },
    ])
    expect(r.issues[0].index).toBe(0)
    expect(r.lines).toHaveLength(1)
    expect(r.subtotal).toBe(8500)
  })
})

describe('computeTotals', () => {
  const zone: DeliveryZone = { id: 'z', name: 'Adenta', areas: null, fee_pesewas: 1500, min_order_pesewas: 5000, eta_minutes: 30, is_active: true, sort_order: 1 }
  const base = { lineCount: 1, deliveryEnabled: true, pickupEnabled: true }

  it('adds the zone fee for delivery', () => {
    const t = computeTotals({ ...base, subtotal: 8500, fulfilment: 'delivery', zone })
    expect(t).toMatchObject({ deliveryFee: 1500, total: 10000, issues: [] })
  })
  it('enforces the zone minimum on food only', () => {
    expect(computeTotals({ ...base, subtotal: 4999, fulfilment: 'delivery', zone }).issues[0].code).toBe('below_minimum')
  })
  it('requires an active zone', () => {
    expect(computeTotals({ ...base, subtotal: 8500, fulfilment: 'delivery', zone: null }).issues[0].code).toBe('zone_required')
    expect(computeTotals({ ...base, subtotal: 8500, fulfilment: 'delivery', zone: { ...zone, is_active: false } }).issues[0].code).toBe('zone_inactive')
  })
  it('pickup has no fee and respects the pickup switch', () => {
    expect(computeTotals({ ...base, subtotal: 2000, fulfilment: 'pickup', zone: null })).toMatchObject({ deliveryFee: 0, total: 2000, issues: [] })
    expect(computeTotals({ ...base, pickupEnabled: false, subtotal: 2000, fulfilment: 'pickup', zone: null }).issues[0].code).toBe('pickup_disabled')
  })
  it('never discounts below zero', () => {
    expect(computeTotals({ ...base, subtotal: 2000, fulfilment: 'pickup', zone: null, discount: 5000 }).total).toBe(0)
  })
})
