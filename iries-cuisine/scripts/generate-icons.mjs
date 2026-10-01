// Generates the PWA / favicon icons.
//   npm run icons                      -> placeholder "I" monogram in the brand colours
//   npm run icons -- path/to/logo.png  -> icons from your own square logo (PNG/SVG, 1024px+ recommended)
// Then commit the files in public/icons and src/app.
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const BRAND = '#9e3b22'
const CREAM = '#fbf6ef'
const GOLD = '#c9973f'

const monogram = (rounded, scale = 1) => {
  const s = (v) => 256 + (v - 256) * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="${BRAND}"/>
  <rect x="${s(176)}" y="${s(132)}" width="${160 * scale}" height="${30 * scale}" rx="${6 * scale}" fill="${CREAM}"/>
  <rect x="${s(224)}" y="${s(150)}" width="${64 * scale}" height="${212 * scale}" fill="${CREAM}"/>
  <rect x="${s(176)}" y="${s(350)}" width="${160 * scale}" height="${30 * scale}" rx="${6 * scale}" fill="${CREAM}"/>
  <circle cx="${s(358)}" cy="${s(138)}" r="${22 * scale}" fill="${GOLD}"/>
</svg>`
}

const logo = process.argv[2]
mkdirSync(path.join(root, 'public/icons'), { recursive: true })

async function render(svgOrFile, size, out, { background } = {}) {
  let img = typeof svgOrFile === 'string' && svgOrFile.startsWith('<svg') ? sharp(Buffer.from(svgOrFile)) : sharp(svgOrFile)
  img = img.resize(size, size, { fit: 'contain', background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } })
  await img.png({ compressionLevel: 9 }).toFile(out)
  console.log('wrote', path.relative(root, out))
}

if (logo) {
  const bg = { r: 251, g: 246, b: 239, alpha: 1 }
  await render(logo, 192, path.join(root, 'public/icons/icon-192.png'), { background: bg })
  await render(logo, 512, path.join(root, 'public/icons/icon-512.png'), { background: bg })
  // maskable: logo inside the 80% safe zone
  const inner = await sharp(logo).resize(360, 360, { fit: 'contain', background: bg }).png().toBuffer()
  await sharp({ create: { width: 512, height: 512, channels: 4, background: bg } })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(path.join(root, 'public/icons/maskable-512.png'))
  await render(logo, 180, path.join(root, 'src/app/apple-icon.png'), { background: bg })
  await render(logo, 48, path.join(root, 'src/app/icon.png'), { background: bg })
} else {
  await render(monogram(true), 192, path.join(root, 'public/icons/icon-192.png'))
  await render(monogram(true), 512, path.join(root, 'public/icons/icon-512.png'))
  await render(monogram(false, 0.78), 512, path.join(root, 'public/icons/maskable-512.png'))
  await render(monogram(false), 180, path.join(root, 'src/app/apple-icon.png'))
  writeFileSync(path.join(root, 'src/app/icon.svg'), monogram(true))
  console.log('wrote src/app/icon.svg')
}
