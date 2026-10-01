import type { Fulfilment, OrderStatus, StaffRole } from './types'

/** Mirrors public.order_status_transitions (the database is the authority; this drives the UI). */
export const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, string[]>>> = {
  awaiting_payment: { paid: ['system'], cancelled: ['system', 'customer', 'attendant', 'manager', 'owner'] },
  paid: {
    accepted: ['attendant', 'manager', 'owner'],
    rejected: ['attendant', 'manager', 'owner'],
    cancelled: ['manager', 'owner'],
    refunded: ['system'],
  },
  accepted: {
    in_kitchen: ['kitchen', 'attendant', 'manager', 'owner'],
    ready: ['kitchen', 'attendant', 'manager', 'owner'],
    cancelled: ['manager', 'owner'],
    refunded: ['system'],
  },
  rejected: { refunded: ['system'] },
  in_kitchen: { ready: ['kitchen', 'attendant', 'manager', 'owner'], cancelled: ['manager', 'owner'], refunded: ['system'] },
  ready: {
    out_for_delivery: ['attendant', 'dispatcher', 'manager', 'owner'],
    ready_for_pickup: ['attendant', 'kitchen', 'manager', 'owner'],
    cancelled: ['manager', 'owner'],
    refunded: ['system'],
  },
  out_for_delivery: { delivered: ['attendant', 'dispatcher', 'manager', 'owner'], cancelled: ['manager', 'owner'], refunded: ['system'] },
  ready_for_pickup: { delivered: ['attendant', 'manager', 'owner'], cancelled: ['manager', 'owner'], refunded: ['system'] },
  delivered: { completed: ['system', 'attendant', 'manager', 'owner'], refunded: ['system'] },
  completed: { refunded: ['system'] },
  cancelled: { paid: ['system'], refunded: ['system'] },
  refunded: {},
}

export function canTransition(from: OrderStatus, to: OrderStatus, role: StaffRole | 'customer' | 'system', fulfilment?: Fulfilment) {
  const roles = TRANSITIONS[from]?.[to]
  if (!roles || !roles.includes(role)) return false
  if (to === 'out_for_delivery' && fulfilment && fulfilment !== 'delivery') return false
  if (to === 'ready_for_pickup' && fulfilment && fulfilment !== 'pickup') return false
  return true
}

export const STAFF_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'New — paid',
  accepted: 'Accepted',
  rejected: 'Rejected',
  in_kitchen: 'In kitchen',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  ready_for_pickup: 'Ready for pickup',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export function customerLabel(status: OrderStatus, fulfilment: Fulfilment): string {
  switch (status) {
    case 'awaiting_payment':
      return 'Waiting for payment'
    case 'paid':
      return 'Payment received — confirming your order'
    case 'accepted':
      return 'Order confirmed'
    case 'in_kitchen':
      return 'Being prepared'
    case 'ready':
      return fulfilment === 'delivery' ? 'Packed — waiting for the rider' : 'Ready — packing your order'
    case 'out_for_delivery':
      return 'On the way'
    case 'ready_for_pickup':
      return 'Ready for pickup'
    case 'delivered':
    case 'completed':
      return fulfilment === 'delivery' ? 'Delivered' : 'Collected'
    case 'rejected':
      return 'We could not take this order'
    case 'cancelled':
      return 'Cancelled'
    case 'refunded':
      return 'Refunded'
  }
}

/** Tailwind classes for status pills. */
export const STATUS_TONE: Record<OrderStatus, string> = {
  awaiting_payment: 'bg-stone-100 text-stone-700 ring-stone-300',
  paid: 'bg-red-50 text-red-800 ring-red-300',
  accepted: 'bg-amber-50 text-amber-900 ring-amber-300',
  in_kitchen: 'bg-orange-50 text-orange-900 ring-orange-300',
  ready: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
  out_for_delivery: 'bg-sky-50 text-sky-900 ring-sky-300',
  ready_for_pickup: 'bg-sky-50 text-sky-900 ring-sky-300',
  delivered: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  completed: 'bg-stone-100 text-stone-700 ring-stone-300',
  rejected: 'bg-stone-200 text-stone-800 ring-stone-400',
  cancelled: 'bg-stone-200 text-stone-800 ring-stone-400',
  refunded: 'bg-violet-50 text-violet-900 ring-violet-300',
}

export const ACTIVE_STATUSES: OrderStatus[] = [
  'paid',
  'accepted',
  'in_kitchen',
  'ready',
  'out_for_delivery',
  'ready_for_pickup',
]

export const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'refunded', 'rejected']

export function isTerminal(status: OrderStatus) {
  return TERMINAL_STATUSES.includes(status)
}

/** Customer-facing progress steps for the tracking timeline. */
export function progressSteps(fulfilment: Fulfilment): { status: OrderStatus; label: string; at: string }[] {
  const base: { status: OrderStatus; label: string; at: string }[] = [
    { status: 'paid', label: 'Payment received', at: 'paid_at' },
    { status: 'accepted', label: 'Confirmed by the restaurant', at: 'accepted_at' },
    { status: 'in_kitchen', label: 'In the kitchen', at: 'kitchen_started_at' },
    { status: 'ready', label: 'Ready', at: 'ready_at' },
  ]
  return fulfilment === 'delivery'
    ? [...base, { status: 'out_for_delivery', label: 'On the way', at: 'dispatched_at' }, { status: 'delivered', label: 'Delivered', at: 'delivered_at' }]
    : [...base, { status: 'ready_for_pickup', label: 'Ready for pickup', at: 'ready_for_pickup_at' }, { status: 'delivered', label: 'Collected', at: 'delivered_at' }]
}

export const REJECT_REASONS = [
  'An item is sold out',
  'Kitchen is too busy right now',
  'Address is outside our delivery area',
  'We are closing soon',
  'Duplicate order',
]
