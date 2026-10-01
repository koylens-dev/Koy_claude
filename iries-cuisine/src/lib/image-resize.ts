'use client'

/**
 * Shrinks a phone photo before upload (often 4–8 MB) to a ~150–300 KB WebP,
 * max 1600 px wide. Menu pages stay fast on 3G and storage stays cheap.
 */
export async function resizeImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  if (blob && blob.type === 'image/webp') return blob
  // Older Safari can't encode WebP: fall back to JPEG
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!jpeg) throw new Error('Could not process the image')
  return jpeg
}
