// CSV with a UTF-8 BOM so Excel shows "₵", names with accents etc. correctly.

type Cell = string | number | boolean | null | undefined

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // Defuse spreadsheet formula injection (=, +, -, @ at the start of user-entered text).
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))]
  return '﻿' + lines.join('\r\n') + '\r\n'
}
