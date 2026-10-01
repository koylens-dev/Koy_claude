// SMS wording. Kept to plain GSM-7 characters and ~160 characters where possible:
// a single "₵", curly quote or emoji switches the whole SMS to UCS-2 (70 chars per
// part) and can double or triple the cost per message.

import { formatGhsPlain } from './money'
import { formatGhanaPhone } from './phone'
import { formatSlot, formatTime } from './time'

const GSM_REPLACEMENTS: [RegExp, string][] = [
  [/[‘’‛′]/g, "'"],
  [/[“”″]/g, '"'],
  [/[–—]/g, '-'],
  [/…/g, '...'],
  [/GH₵\s?/g, 'GHS '],
  [/₵\s?/g, 'GHS '],
  [/ /g, ' '],
]

// GSM 03.38 basic character set + extension table characters.
const GSM_CHARS =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€"

export function toGsmSafe(text: string): string {
  let out = text
  for (const [re, rep] of GSM_REPLACEMENTS) out = out.replace(re, rep)
  return [...out].filter((ch) => GSM_CHARS.includes(ch)).join('').replace(/ {2,}/g, ' ').trim()
}

/** Number of SMS parts a GSM-7 message will be billed as. */
export function smsParts(text: string): number {
  const extended = [...text].filter((c) => '^{}\\[~]|€'.includes(c)).length
  const len = text.length + extended
  return len <= 160 ? 1 : Math.ceil(len / 153)
}

/** Only promise money we have actually asked the gateway to send back. */
function refundLine(refundPesewas: number) {
  return refundPesewas > 0
    ? `A refund of ${formatGhsPlain(refundPesewas)} has been started.`
    : 'Our team will contact you about your refund.'
}

type OrderInfo = {
  orderNumber: number
  totalPesewas: number
  fulfilment: 'delivery' | 'pickup'
  prepMinutes?: number | null
  estimatedReadyAt?: string | null
  scheduledFor?: string | null
  riderName?: string | null
  riderPhone?: string | null
  deliveryCode?: string | null
  trackUrl: string
}

export const smsTemplates = {
  otp: (code: string) => `Your Irie's Cuisine code is ${code}. Do not share this code with anyone.`,

  orderPaid: (o: OrderInfo) =>
    `Irie's Cuisine: ${formatGhsPlain(o.totalPesewas)} received for order #${o.orderNumber}. We'll confirm shortly. Track: ${o.trackUrl}`,

  orderAccepted: (o: OrderInfo) => {
    if (o.scheduledFor) return `Order #${o.orderNumber} confirmed for ${formatSlot(o.scheduledFor)}. Track: ${o.trackUrl}`
    if (o.fulfilment === 'pickup') {
      const at = o.estimatedReadyAt ? ` around ${formatTime(o.estimatedReadyAt)}` : ''
      return `Order #${o.orderNumber} confirmed! Ready for pickup${at}. Track: ${o.trackUrl}`
    }
    return `Order #${o.orderNumber} confirmed! Cooking now (about ${o.prepMinutes ?? 30} min), then on its way. Track: ${o.trackUrl}`
  },

  outForDelivery: (o: OrderInfo) => {
    const rider = o.riderName ? ` with ${o.riderName}${o.riderPhone ? ` (${formatGhanaPhone(o.riderPhone)})` : ''}` : ''
    const code = o.deliveryCode ? ` Code: ${o.deliveryCode}.` : ''
    return `Order #${o.orderNumber} is on its way${rider}.${code} Track: ${o.trackUrl}`
  },

  readyForPickup: (o: OrderInfo, pickupAddress: string) =>
    `Order #${o.orderNumber} is ready for pickup at Irie's Cuisine, ${pickupAddress}. Show this SMS at the counter.`,

  orderRejected: (o: OrderInfo, reason: string, refundPesewas: number) =>
    `Sorry, we couldn't take order #${o.orderNumber} (${reason}). ${refundLine(refundPesewas)}`,

  orderCancelled: (o: OrderInfo, reason: string, refundPesewas: number) =>
    `Order #${o.orderNumber} was cancelled (${reason}). ${refundLine(refundPesewas)}`,

  partialRefund: (o: OrderInfo, amountPesewas: number) =>
    `Irie's Cuisine: we've refunded ${formatGhsPlain(amountPesewas)} on order #${o.orderNumber}. Sorry for the trouble.`,

  paymentLink: (orderNumber: number, totalPesewas: number, payUrl: string) =>
    `Irie's Cuisine order #${orderNumber}: ${formatGhsPlain(totalPesewas)}. Pay with MoMo or card here: ${payUrl}`,

  staffUnaccepted: (orderNumber: number, totalPesewas: number, minutes: number) =>
    `ALERT: order #${orderNumber} (${formatGhsPlain(totalPesewas)}) was paid ${minutes} min ago and is not accepted yet. Check the attendant screen.`,

  cateringAlert: (name: string, phone: string, date: string | null, headcount: number | null) =>
    `New catering enquiry: ${name}, ${formatGhanaPhone(phone)}${date ? `, ${date}` : ''}${headcount ? `, ${headcount} guests` : ''}. See Admin > Catering.`,
}
