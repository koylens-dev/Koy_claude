// Money is always an integer number of pesewas (GHS 1.00 = 100 pesewas).

const formatter = new Intl.NumberFormat('en-GH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 18500 -> "GH₵185.00" (for screens). */
export function formatCedis(pesewas: number): string {
  const sign = pesewas < 0 ? '-' : ''
  return `${sign}GH₵${formatter.format(Math.abs(pesewas) / 100)}`
}

/**
 * 18500 -> "GHS 185.00" (for SMS). The ₵ sign is not in the GSM-7 alphabet: one ₵
 * turns a 160-character SMS into a 70-character one and can double the cost.
 */
export function formatGhsPlain(pesewas: number): string {
  const sign = pesewas < 0 ? '-' : ''
  return `${sign}GHS ${(Math.abs(pesewas) / 100).toFixed(2)}`
}

/** "185", "185.5", "185.50" -> 18550. Returns null for anything that is not a valid amount. */
export function parseCedisToPesewas(input: string): number | null {
  const cleaned = input.replace(/[,\s]|GH₵|GHS|₵/gi, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, frac = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

/** For CSV exports: 18550 -> "185.50". */
export function pesewasToDecimalString(pesewas: number): string {
  return (pesewas / 100).toFixed(2)
}
