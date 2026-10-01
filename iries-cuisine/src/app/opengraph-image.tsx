import { ImageResponse } from 'next/og'

export const alt = "Irie's Cuisine — Ghanaian food delivered in Adenta, Accra"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Default share card for WhatsApp / Instagram / Facebook links.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: 'linear-gradient(135deg, #241612 0%, #4a2116 60%, #9e3b22 100%)',
          color: '#fbf6ef',
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 6, textTransform: 'uppercase', color: '#c9973f' }}>Adenta · Accra</div>
        <div style={{ fontSize: 96, fontWeight: 700, marginTop: 16, lineHeight: 1 }}>Irie&apos;s Cuisine</div>
        <div style={{ fontSize: 40, marginTop: 24, opacity: 0.9 }}>Ghanaian food, cooked with love, delivered warm.</div>
        <div style={{ fontSize: 28, marginTop: 40, opacity: 0.8 }}>Order online · Pay with MoMo or card · Track live</div>
      </div>
    ),
    size,
  )
}
