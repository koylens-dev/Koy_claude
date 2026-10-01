import type { Metadata } from 'next'
import { publicEnv } from '@/lib/public-env'

export const metadata: Metadata = { title: 'Privacy policy' }

// TEMPLATE — have a Ghanaian lawyer review before launch, and register with the
// Data Protection Commission as a data controller (Data Protection Act, 2012 (Act 843)).
export default function PrivacyPage() {
  return (
    <article className="prose-sm mx-auto max-w-2xl space-y-4 pt-8 leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
      <h1 className="font-display text-4xl font-semibold">Privacy policy</h1>
      <p className="text-sm text-muted">Last updated: October 2026</p>
      <p>
        Irie’s Cuisine (“we”) runs this ordering service from Adenta, Accra. This policy explains what personal data we collect and why, in line with Ghana’s Data
        Protection Act, 2012 (Act 843).
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Your mobile number (to sign you in with a one-time code and send order updates).</li>
        <li>Your name, and email if you give it (for receipts).</li>
        <li>Delivery details: delivery area, Ghana Post GPS address, landmark, directions and — only if you tap “Pin my location” — your GPS position.</li>
        <li>Your orders, payments status and any messages you send us.</li>
      </ul>
      <p>
        We do <strong>not</strong> see or store your card number or MoMo PIN. Payments are processed by Paystack, a licensed payment processor.
      </p>
      <h2>Why we use it</h2>
      <ul>
        <li>To take, prepare, deliver and support your orders (necessary to fulfil our contract with you).</li>
        <li>To keep financial records required by Ghanaian law.</li>
        <li>To prevent fraud and abuse.</li>
        <li>To send offers and news — <strong>only if you opt in</strong>. You can opt out any time in “My account” or by replying to us.</li>
      </ul>
      <h2>Who we share it with</h2>
      <ul>
        <li>Our riders: your name, phone and delivery details for your delivery only.</li>
        <li>Service providers who process data for us: Paystack (payments), our SMS provider (order texts), Supabase and Vercel (secure hosting; servers in the United Kingdom/European Union).</li>
        <li>Authorities, where the law requires it.</li>
      </ul>
      <p>We never sell your personal data.</p>
      <h2>How long we keep it</h2>
      <p>Order and payment records are kept for as long as tax and accounting law requires. Marketing preferences are kept until you change them. You may ask us to delete your account at any time.</p>
      <h2>Your rights</h2>
      <p>
        You can ask to see the data we hold about you, to correct it, to delete it, or to stop marketing. Contact us below. If you are unhappy with our answer you can complain to
        the Data Protection Commission of Ghana.
      </p>
      <h2>Contact</h2>
      <p>
        {publicEnv.supportEmail && <>Email: {publicEnv.supportEmail}. </>}
        {publicEnv.whatsappNumber && <>WhatsApp: {publicEnv.whatsappNumber}.</>}
      </p>
    </article>
  )
}
