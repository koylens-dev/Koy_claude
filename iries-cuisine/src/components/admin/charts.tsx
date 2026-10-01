'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

// Small, dependency-free charts for the sales dashboard.
// Single series in the brand colour (validated: contrast >= 3:1 on the surface),
// thin bars (<= 24px) with 4px rounded data-ends, hairline solid grid, hover + keyboard
// tooltips, and a table view so no value depends on hovering.

const BAR = 'var(--brand)'
const GRID = '#ece4da'

function niceStep(max: number, targetTicks = 4) {
  if (max <= 0) return 1
  const raw = max / targetTicks
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return nice * pow
}

function roundedTopBar(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return ''
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
}

export type ColumnDatum = { key: string; label: string; value: number }

export function ColumnChart({
  data,
  format,
  axisFormat,
  height = 220,
  title,
  className,
}: {
  data: ColumnDatum[]
  format: (v: number) => string
  axisFormat?: (v: number) => string
  height?: number
  title: string
  className?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const padL = 52
  const padR = 8
  const padT = 12
  const padB = 28
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const max = Math.max(0, ...data.map((d) => d.value))
  const step = niceStep(max)
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const band = data.length ? plotW / data.length : plotW
  const barW = Math.max(3, Math.min(24, band - 2))
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 52))))
  const y = (v: number) => padT + plotH - (v / top) * plotH
  const fmtAxis = axisFormat ?? format

  return (
    <div className={cn('relative', className)}>
      <div ref={wrapRef} className="relative w-full">
        {data.length === 0 ? (
          <p className="grid place-items-center text-sm text-muted" style={{ height }}>
            No sales in this period.
          </p>
        ) : (
          <svg width={width} height={height} role="img" aria-label={title} className="block">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--muted)] text-[11px] tabular-nums">
                  {fmtAxis(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = padL + band * i + band / 2
              const h = (d.value / top) * plotH
              return (
                <g key={d.key}>
                  <path d={roundedTopBar(cx - barW / 2, y(d.value), barW, h)} fill={BAR} opacity={active === null || active === i ? 1 : 0.55} />
                  {i % labelEvery === 0 && (
                    <text x={cx} y={height - 8} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
                      {d.label}
                    </text>
                  )}
                  {/* hit target: the whole column band, bigger than the bar */}
                  <rect
                    x={padL + band * i}
                    y={padT}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${d.label}: ${format(d.value)}`}
                    onPointerEnter={() => setActive(i)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="outline-none"
                  />
                </g>
              )
            })}
            <line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke="#d9cdbf" strokeWidth={1} />
          </svg>
        )}
        {active !== null && data[active] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: Math.min(width - 60, Math.max(60, padL + band * active + band / 2)), top: Math.max(0, y(data[active].value) - 6) }}
          >
            <strong className="block text-sm">{format(data[active].value)}</strong>
            <span className="opacity-80">{data[active].label}</span>
          </div>
        )}
      </div>
      {data.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowTable((s) => !s)} className="text-xs font-semibold text-brand underline">
            {showTable ? 'Hide table' : 'View as table'}
          </button>
          {showTable && (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {data.map((d) => (
                  <tr key={d.key} className="border-t border-line">
                    <td className="py-1">{d.label}</td>
                    <td className="py-1 text-right tabular-nums">{format(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

/** Horizontal bars with the value at the tip — for "by payment method", "by zone". */
export function BarList({ rows, format }: { rows: { label: string; value: number; sub?: string }[]; format: (v: number) => string }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="text-sm text-muted">No data for this period.</p>
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="tabular-nums">
              <strong>{format(r.value)}</strong>
              {r.sub && <span className="ml-1 text-xs text-muted">{r.sub}</span>}
            </span>
          </div>
          <div className="mt-1 h-2.5 w-full rounded-r bg-[#f3ece4]">
            <div className="h-2.5 rounded-r-[4px]" style={{ width: `${max ? Math.max(1, (r.value / max) * 100) : 0}%`, background: BAR }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function StatTile({ label, value, hint, hero }: { label: string; value: string; hint?: string; hero?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <p className="text-sm text-muted">{label}</p>
      <p className={cn('mt-1 font-sans font-semibold', hero ? 'text-5xl' : 'text-2xl')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
