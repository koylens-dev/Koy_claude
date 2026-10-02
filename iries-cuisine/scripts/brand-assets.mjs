// Builds every logo/icon/share image from the two master logo files in brand/source/.
//   npm run brand
// Re-run after replacing the masters, then commit the generated files.
//
// brand/source/logo-dark-square.png   gold logo on the midnight-green chevron background
// brand/source/logo-light-square.png  green logo on the cream chevron background
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const src = (f) => path.join(root, 'brand/source', f)
const out = (f) => path.join(root, f)

const MIDNIGHT = { r: 12, g: 28, b: 20 }
const CREAM_BACKGROUNDS = [[252, 232, 176], [248, 228, 176], [244, 228, 172], [248, 232, 176]]
const DARK_BACKGROUNDS = [[12, 28, 20], [16, 32, 24], [20, 36, 28], [12, 32, 24]]

/**
 * Removes the patterned background: each pixel's opacity comes from how far it is from
 * the nearest background shade, and its colour is "un-mixed" from that background so
 * anti-aliased edges stay smooth on any new surface.
 */
async function cutOut(file, backgrounds) {
  const { data, info } = await sharp(src(file)).raw().toBuffer({ resolveWithObject: true })
  const rgba = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const p = [data[i], data[i + 1], data[i + 2]]
    let best = backgrounds[0]
    let bestD = Infinity
    for (const b of backgrounds) {
      const d = Math.hypot(p[0] - b[0], p[1] - b[1], p[2] - b[2])
      if (d < bestD) [best, bestD] = [b, d]
    }
    const a = Math.min(1, Math.max(0, (bestD - 10) / 70))
    for (let c = 0; c < 3; c++) {
      rgba[j + c] = a > 0 ? Math.min(255, Math.max(0, Math.round((p[c] - (1 - a) * best[c]) / a))) : 0
    }
    rgba[j + 3] = Math.round(a * 255)
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
}

async function bbox(img) {
  const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true })
  let [x0, y0, x1, y1] = [info.width, info.height, 0, 0]
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

mkdirSync(out('public/brand'), { recursive: true })
mkdirSync(out('public/icons'), { recursive: true })

const onLight = await cutOut('logo-light-square.png', CREAM_BACKGROUNDS)
const onDark = await cutOut('logo-dark-square.png', DARK_BACKGROUNDS)
const full = await bbox(onLight)
const pad = 20

// Full horizontal logo (bowl + wordmark) for light and dark surfaces
for (const [img, name] of [[onLight, 'logo-on-light.png'], [onDark, 'logo-on-dark.png']]) {
  const buf = await sharp(await img.png().toBuffer())
    .extract({ left: full.left - pad, top: full.top - pad, width: full.width + 2 * pad, height: full.height + 2 * pad })
    .resize({ width: 1400 })
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toBuffer()
  await sharp(buf).toFile(out(`public/brand/${name}`))
  console.log('wrote public/brand/' + name)
}

// The bowl (left part of the logo) is the square brand mark used for app icons.
const darkPng = await onDark.png().toBuffer()
const bowlRegion = await bbox(sharp(darkPng).extract({ left: 0, top: 0, width: 1500, height: 4500 }))
const bowl = await sharp(darkPng).extract(bowlRegion).png().toBuffer()

/** Thickens thin line art so it stays legible at icon sizes (dilation by stacking shifted copies). */
async function thicken(png, radius) {
  if (radius < 1) return png
  const meta = await sharp(png).metadata()
  const layers = []
  for (let a = 0; a < 16; a++) {
    for (const r of [radius / 2, radius]) {
      layers.push({ input: png, left: Math.round(Math.cos((a * Math.PI) / 8) * r) + radius, top: Math.round(Math.sin((a * Math.PI) / 8) * r) + radius })
    }
  }
  return sharp({ create: { width: meta.width + 2 * radius, height: meta.height + 2 * radius, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([...layers, { input: png, left: radius, top: radius }])
    .png()
    .toBuffer()
}

async function icon(size, safeZone, file, { rounded = false } = {}) {
  const inner = Math.round(size * safeZone)
  const scaled = await sharp(bowl).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  const thick = await thicken(scaled, Math.max(1, Math.round(size * 0.008)))
  const mark = await sharp(thick).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  const base = sharp({ create: { width: size, height: size, channels: 4, background: { ...MIDNIGHT, alpha: 1 } } }).composite([{ input: mark, gravity: 'center' }])
  let png = await base.png().toBuffer()
  if (rounded) {
    const r = Math.round(size * 0.22)
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`)
    png = await sharp(png).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  }
  await sharp(png).png({ compressionLevel: 9 }).toFile(out(file))
  console.log('wrote', file)
}

await icon(192, 0.72, 'public/icons/icon-192.png')
await icon(512, 0.72, 'public/icons/icon-512.png')
await icon(512, 0.58, 'public/icons/maskable-512.png') // Android crops maskable icons to a circle
await icon(180, 0.72, 'src/app/apple-icon.png')
await icon(64, 0.84, 'src/app/icon.png', { rounded: true })

// Share card for WhatsApp / Instagram / Facebook links: the dark master, cropped to 1.91:1
const og = 4500 / 1.905
await sharp(src('logo-dark-square.png'))
  .extract({ left: 0, top: Math.round((4500 - og) / 2), width: 4500, height: Math.round(og) })
  .resize(1200, 630)
  .png({ compressionLevel: 9 })
  .toFile(out('src/app/opengraph-image.png'))
console.log('wrote src/app/opengraph-image.png')
