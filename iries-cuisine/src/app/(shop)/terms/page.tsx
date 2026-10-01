import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms & refunds' }

// TEMPLATE — have a lawyer review before launch.
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 pt-8 leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
      <h1 className="font-display text-4xl font-semibold">Terms of service & refund policy</h1>
      <p className="text-sm text-muted">Last updated: October 2026</p>
      <h2>Ordering and payment</h2>
      <ul>
        <li>All orders are prepaid by Mobile Money (MTN, Telecel, AT) or Visa/Mastercard through Paystack. We do not accept cash on delivery.</li>
        <li>Your order is sent to the kitchen only after your payment is confirmed. Prices are in Ghana cedis (GH₵) and include any delivery fee shown at checkout.</li>
        <li>Unpaid orders are cancelled automatically after a short time.</li>
      </ul>
      <h2>Delivery and pickup</h2>
      <ul>
        <li>We deliver to the areas listed at checkout. Delivery times are estimates; traffic and weather can cause delays.</li>
        <li>Please give an accurate landmark and keep your phone on so the rider can reach you.</li>
        <li>Scheduled orders are prepared to be ready around the time you choose.</li>
      </ul>
      <h2>Cancellations and refunds</h2>
      <ul>
        <li>If we cannot accept or must cancel your order, you get a <strong>full refund automatically</strong> to the account you paid with.</li>
        <li>If you paid twice by mistake, the duplicate payment is refunded automatically.</li>
        <li>Once your order has been accepted and cooking has started, you cannot cancel it.</li>
        <li>If something is wrong or missing, contact us on WhatsApp within 2 hours of delivery (a photo helps). We may refund all or part of the order.</li>
        <li>Refunds go back to the original payment method. MoMo refunds usually arrive within a few days; card refunds can take 5–10 working days depending on your bank.</li>
      </ul>
      <h2>Allergies</h2>
      <p>Our kitchen handles peanuts, fish, shellfish, eggs, gluten and other allergens. Tell us about allergies in the order notes, but we cannot guarantee any dish is allergen-free.</p>
      <h2>Your account</h2>
      <p>You sign in with a one-time code sent to your phone. Don’t share codes with anyone — our staff will never ask for them.</p>
      <h2>Changes</h2>
      <p>We may update these terms; the version on this page applies to your order.</p>
    </article>
  )
}
