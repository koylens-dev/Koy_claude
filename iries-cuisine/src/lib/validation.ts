import { z } from 'zod'

// Input validation for everything that crosses the network. Shared by API routes.

export const cartLineSchema = z.object({
  itemId: z.uuid(),
  portionId: z.uuid(),
  optionIds: z.array(z.uuid()).max(20).default([]),
  quantity: z.number().int().min(1).max(50),
  notes: z.string().trim().max(200).nullish(),
})

export const addressSchema = z
  .object({
    gps: z.string().trim().max(20).nullish(),
    landmark: z.string().trim().max(200).nullish(),
    directions: z.string().trim().max(300).nullish(),
    // Ghana's bounding box — rejects junk coordinates
    lat: z.number().min(4.5).max(11.5).nullish(),
    lng: z.number().min(-3.5).max(1.5).nullish(),
  })
  .default({})

const orderCoreSchema = z.object({
  fulfilment: z.enum(['delivery', 'pickup']),
  zoneId: z.uuid().nullish(),
  address: addressSchema,
  scheduledFor: z.iso.datetime({ offset: true }).nullish(),
  notes: z.string().trim().max(500).nullish(),
  lines: z.array(cartLineSchema).min(1).max(40),
})

export const checkoutSchema = orderCoreSchema.extend({
  mode: z.enum(['quote', 'place']).default('quote'),
  customer: z.object({
    name: z.string().trim().min(2, 'Please enter your name').max(120),
    email: z.union([z.email(), z.literal('')]).nullish(),
    marketingConsent: z.boolean().default(false),
  }),
})
export type CheckoutInput = z.infer<typeof checkoutSchema>

export const staffOrderSchema = orderCoreSchema.extend({
  mode: z.enum(['quote', 'place']).default('quote'),
  channel: z.enum(['phone', 'whatsapp', 'walk_in']),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(9).max(20),
    email: z.union([z.email(), z.literal('')]).nullish(),
  }),
  sendPaymentSms: z.boolean().default(true),
  demo: z.boolean().default(false), // practice order: no SMS, no real payment
})
export type StaffOrderInput = z.infer<typeof staffOrderSchema>

export const statusChangeSchema = z.object({
  to: z.enum([
    'accepted',
    'rejected',
    'in_kitchen',
    'ready',
    'out_for_delivery',
    'ready_for_pickup',
    'delivered',
    'completed',
    'cancelled',
  ]),
  note: z.string().trim().max(300).nullish(),
  prepMinutes: z.number().int().min(1).max(600).nullish(),
  riderName: z.string().trim().max(80).nullish(),
  riderPhone: z.string().trim().max(20).nullish(),
})

export const refundSchema = z.object({
  amountPesewas: z.number().int().positive().nullish(),
  paymentId: z.uuid().nullish(), // defaults to the payment that paid the order
  reason: z.string().trim().min(3).max(300),
})

export const cateringSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(9).max(20),
  email: z.union([z.email(), z.literal('')]).nullish(),
  eventDate: z.iso.date().nullish(),
  eventType: z.string().trim().max(80).nullish(),
  headcount: z.number().int().min(1).max(100000).nullish(),
  budget: z.string().trim().max(80).nullish(),
  location: z.string().trim().max(200).nullish(),
  menuInterest: z.string().trim().max(500).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  website: z.string().max(0).nullish(), // honeypot: real people leave it empty
})

export const staffAccountSchema = z.object({
  email: z.email(),
  password: z.string().min(10, 'Use at least 10 characters').max(72),
  displayName: z.string().trim().min(2).max(60),
  role: z.enum(['attendant', 'kitchen', 'dispatcher', 'manager', 'owner']),
})

export const staffUpdateSchema = z.object({
  userId: z.uuid(),
  role: z.enum(['attendant', 'kitchen', 'dispatcher', 'manager', 'owner']).optional(),
  isActive: z.boolean().optional(),
  displayName: z.string().trim().min(2).max(60).optional(),
  password: z.string().min(10).max(72).optional(),
})

/** First human-readable message from a Zod error. */
export function firstZodMessage(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid input'
  const path = issue.path.join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}
