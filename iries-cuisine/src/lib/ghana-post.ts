// Ghana Post GPS digital addresses look like "GA-543-0125" or "AK-484-9321":
// two letters (region + district), then a 3–4 digit area code, then a 4-digit unique code.
// There is no free official lookup API, so we validate the format and keep the
// landmark + directions alongside it for the rider.

const PATTERN = /^([A-Z]{2})-?(\d{3,4})-?(\d{4})$/

export function normalizeGhanaPostGps(input: string | null | undefined): string | null {
  if (!input) return null
  const compact = input.toUpperCase().replace(/[\s_.]/g, '').replace(/–|—/g, '-')
  const m = PATTERN.exec(compact)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

export function isValidGhanaPostGps(input: string | null | undefined): boolean {
  return normalizeGhanaPostGps(input) !== null
}

/** Google Maps link for the rider. Prefers exact coordinates; falls back to a text search. */
export function mapsLink(opts: { lat?: number | null; lng?: number | null; gps?: string | null; landmark?: string | null }): string | null {
  if (opts.lat != null && opts.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${opts.lat},${opts.lng}`
  }
  const q = [opts.gps, opts.landmark, 'Accra'].filter(Boolean).join(', ')
  if (!opts.gps && !opts.landmark) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
