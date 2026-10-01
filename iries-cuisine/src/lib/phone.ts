// Ghana phone numbers. Stored everywhere as E.164: +233XXXXXXXXX (9 digits after 233).
// Mobile numbers start with 2 or 5 after the country code (024, 054, 055, 059, 020, 050, 026, 027, 056, 057 …).

const NATIONAL = /^[25]\d{8}$/

/** Accepts 0241234567, 024 123 4567, 241234567, 233241234567, +233 24 123 4567. Returns +233241234567 or null. */
export function normalizeGhanaPhone(input: string | null | undefined): string | null {
  if (!input) return null
  let digits = input.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.startsWith('00233')) digits = digits.slice(5)
  else if (digits.startsWith('233')) digits = digits.slice(3)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  if (!NATIONAL.test(digits)) return null
  return `+233${digits}`
}

/** +233241234567 -> "024 123 4567" (how Ghanaians write numbers). */
export function formatGhanaPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  const n = normalizeGhanaPhone(e164)
  if (!n) return e164
  const local = `0${n.slice(4)}`
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
}

/** For wa.me links and SMS gateways: +233241234567 -> "233241234567". */
export function toMsisdn(e164: string): string {
  return e164.replace(/^\+/, '')
}

/** https://wa.me link with an optional pre-filled message. */
export function whatsappLink(e164: string, text?: string): string {
  const base = `https://wa.me/${toMsisdn(e164)}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
