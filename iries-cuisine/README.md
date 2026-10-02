# Irie's Cuisine: ordering & restaurant operations

A Progressive Web App for **Irie's Cuisine** (Adenta, Accra). It covers the whole order lifecycle in one system: customers order and pay, the attendant confirms, the kitchen prepares, the order goes out for delivery or pickup, and the sale is recorded and reported.

**Customers** install it from the browser on Android or iPhone (no app store). **Staff** use the same app on a tablet or phone.

| Document | For |
|---|---|
| [docs/TECHNICAL_PLAN.md](docs/TECHNICAL_PLAN.md) | Stack & hosting choices, cost table, architecture, database, order state machine, payment flow, roadmap and launch-date assessment |
| [docs/SETUP_AND_DEPLOY.md](docs/SETUP_AND_DEPLOY.md) | Step-by-step setup for a non-specialist: accounts, keys, deployment, testing, go-live |
| [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) | Day-by-day plan to 12 October 2026 and the go-live checklist |
| [docs/STAFF_GUIDE.md](docs/STAFF_GUIDE.md) | One-page guide for attendants, kitchen and managers |
| [.env.example](.env.example) | Every setting, explained |

## What's in Phase 1

- **Customer app**
  - Menu with photos, portions, extras and spice level; live "sold out"; search; cart; notes.
  - Delivery by zone (fee + minimum) or pickup. Ghana Post GPS + landmark + "pin my location".
  - Opening hours and scheduled orders.
  - Phone + OTP sign-in.
  - Prepaid checkout (MoMo, cards); live tracking; SMS updates; receipts; order history; reorder.
  - Catering enquiries; WhatsApp support.
- **Payments**
  - Paystack, confirmed server-side only: signed webhooks, re-verified with the Paystack API, idempotent.
  - Pending/failed/late/duplicate payments handled.
  - Automatic refund on reject or cancel; manager partial refunds.
  - Payment links for phone and WhatsApp orders.
- **Staff**
  - Attendant console: loud alarm, accept/reject, prep time, call/WhatsApp the customer, phone-order entry, sold-out toggles, send-out with rider info.
  - Kitchen display: colour-coded timers.
  - Printable 80 mm tickets.
  - Keeps working through brief internet drops.
- **Admin**
  - Menu, photos, extras, zones, hours, settings, staff and roles.
  - Order search with timelines and refunds; audit log.
  - Sales dashboard; CSV exports (orders, items, payments, customers with consent); catering inbox.
- **Operations**
  - A job every 5 minutes: payment re-checks, unpaid-order timeouts, auto-complete, refund tracking, and an SMS to managers about orders waiting to be accepted.
  - Health endpoint; Sentry.

## Tech

Next.js 16 (React 19, TypeScript, Tailwind CSS 4) on **Vercel** (London) · **Supabase** Postgres, Auth, Realtime and Storage (London) · **Paystack** · **Arkesel / mNotify** SMS · Sentry.

```
src/
  app/(shop)/        customer pages: menu, cart, checkout, login, tracking (/t/[token]), orders, account, catering, legal
  app/staff/         staff login, attendant console, kitchen display, phone orders, sold-out, tickets
  app/admin/         sales dashboard, orders & refunds, menu, extras, zones, settings, staff, customers, catering, audit
  app/api/           checkout, Paystack webhook, payment verify, staff actions, exports, cron, OTP SMS hook, health
  app/pay/[token]    permanent payment link → Paystack checkout
  lib/               pricing, opening hours, phone/GPS formats, SMS templates, signatures (pure, unit-tested)
  lib/server/        Paystack client, payments & refunds, SMS providers, notifications, auth helpers
brand/source/        master logo files (dark and light); `npm run brand` builds every logo, icon and share image from them
supabase/
  migrations/        schema, business functions (state machine, payments, refunds, reports), security (RLS)
  seed.sql           sample menu, zones and hours
  tests/             database test suite
e2e/                 full-stack end-to-end test (real build + Postgres + PostgREST + mocks)
```

## Developing

```bash
npm install
cp .env.example .env.local   # fill in; SMS_PROVIDER=console prints SMS to the terminal
npm run dev                  # http://localhost:3000

npm run typecheck && npm run lint
npm test                     # unit tests
npm run test:db              # database tests (needs local Postgres 15+)
npm run test:e2e             # end-to-end (needs PostgREST; see e2e/README.md)
npm run build
```

For a local Supabase (needs Docker), run `npx supabase init && npx supabase start`. Then run `npx supabase db reset` to apply the migrations and seed.

## Security notes

- The browser never sends prices. The server prices every order from the database, and the database enforces every status change and refund limit.
- Row-level security is on for every table. The server-only secret key is used only in API routes.
- Webhooks are verified by signature (Paystack HMAC-SHA512; Supabase Standard Webhooks). Payments are re-verified with Paystack before an order is marked paid.
- Card data never touches our servers. Paystack hosts the checkout.
- Rate limits protect checkout, OTP, payment links and forms. Inputs are validated with Zod.
- An audit log records price changes, refunds, rejections, cancellations, staff and settings changes.
- Marketing consent is opt-in and timestamped (Data Protection Act, 2012 (Act 843)). Customers can ask for their data or its deletion.
