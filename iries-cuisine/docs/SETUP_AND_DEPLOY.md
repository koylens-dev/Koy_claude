# Setup and deployment guide

This guide takes you from nothing to a live ordering site. **You don't need to be a developer.** You will copy values between websites and click buttons. Allow about **3–4 hours** spread over two days; some approvals (Paystack, SMS sender ID) take a few business days, so **start steps 1–4 today**.

> **Words you'll see:**
> - **Environment variable**: a named setting (like `PAYSTACK_SECRET_KEY`) that you paste into Vercel. It's how the app gets passwords without them being written in the code.
> - **Secret key**: a password for a service. Never share it, never put it in WhatsApp or email, and never paste it into anything whose name starts with `NEXT_PUBLIC_`.

---

## 0. What you need

| Item | Notes |
|---|---|
| A laptop with Chrome | For the setup |
| An email address for the business | Used for all the service accounts. A shared one like `tech@yourdomain` is best. |
| A card that works for online US-dollar payments | Supabase (US$25/month) and Vercel (US$20/month) bill in USD. A Ghanaian Visa/Mastercard with international payments enabled, or a virtual dollar card. |
| Business documents | For Paystack: TIN, Registrar-General certificate, business bank or MoMo account **in the same name as the certificate** |
| A domain name | e.g. `iriescuisine.com`; the app can live at `order.iriescuisine.com` |
| The code | Folder `iries-cuisine/` in the GitHub repository `koylens-dev/Koy_claude` |

---

## 1. Paystack (payments): start today, approval takes days

1. Go to **paystack.com** → *Create a free account* → country **Ghana**.
2. In the dashboard open **Activate business / Compliance** and submit your documents. The business name on your bank/MoMo account must match the registration certificate exactly, or activation is rejected.
3. Settings → **Preferences → Payment channels**: turn on **Mobile Money** and **Card** (and **Bank Transfer** if offered).
4. Settings → **Payouts**: add the settlement bank account or MoMo wallet. If you want weekend money, read about **Manual payouts** in Paystack's help centre.
5. Settings → **API Keys & Webhooks**: copy the **Test Secret Key** (`sk_test_…`). You'll paste it into Vercel in step 5. Leave this page open; you'll come back for the webhook URL in step 7.

## 2. SMS (Arkesel): start today

1. Sign up at **arkesel.com**. Buy a small bundle (GH₵100–200 lasts a while at launch). Bundles that don't expire cost a little more per SMS but are simpler.
2. **Register a Sender ID** of up to 11 letters/numbers, e.g. `IriesFood`. The mobile networks approve it in a few business days.
3. Find your **API key** (SMS API v2) in the dashboard. Copy it.
4. *(Optional, recommended)* Create an **mNotify** account too and copy its API key. The app switches to it automatically if Arkesel ever fails.

## 3. Supabase (database, sign-in, live updates)

1. Go to **supabase.com** → *New project*.
   - **Region: West EU (London)**. This is the lowest latency for Accra.
   - Choose a strong database password and save it in a password manager.
   - Upgrade the organisation to the **Pro** plan (Billing). The free plan pauses and has no backups.
2. **Create the database tables.** Choose one:
   - **Easy way (copy & paste):** open **SQL Editor** → *New query*. Paste the whole contents of each file below **in this order**, clicking **Run** after each:
     1. `supabase/migrations/20261001000100_core_schema.sql`
     2. `supabase/migrations/20261001000200_functions.sql`
     3. `supabase/migrations/20261001000300_security.sql`
     4. `supabase/seed.sql` (sample menu, zones and hours that you'll edit later; skip it if you prefer to start empty)
   - **Developer way:** `npx supabase link --project-ref <ref>` then `npx supabase db push`, and run `seed.sql` in the SQL Editor.
3. **Copy your keys:** Project Settings → **API Keys**.
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (`sb_secret_…`) → `SUPABASE_SECRET_KEY` (**secret!**)
4. **Authentication → URL Configuration:** set **Site URL** to your final address, e.g. `https://order.iriescuisine.com`.
5. **Authentication → Rate Limits:** raise *SMS messages sent per hour* to about **100** (the default is low).
6. Phone sign-in is switched on in step 7, after the site has an address.

## 4. Domain

Buy the domain if you haven't. You'll connect it in step 6.

## 5. Vercel (hosting)

1. Go to **vercel.com** → sign up with GitHub → **Add New… → Project** → import **koylens-dev/Koy_claude**.
2. **Root Directory: `iries-cuisine`** (important). Framework: **Next.js** (detected automatically).
3. Open **Environment Variables** and add each of these (all environments):

| Name | Value | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://order.iriescuisine.com` | Your address, no trailing `/` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `+233…` | Business WhatsApp number |
| `NEXT_PUBLIC_SUPPORT_PHONE` | `+233…` | Business phone |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `hello@…` | Business email |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Step 3.3 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Step 3.3 |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | Step 3.3 (**secret**) |
| `SUPABASE_SMS_HOOK_SECRET` | `v1,whsec_…` | Step 7.2 (add it after step 7, then redeploy) |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` now, `sk_live_…` at go-live | Step 1.5 (**secret**) |
| `SMS_PROVIDER` | `arkesel` | — |
| `SMS_FALLBACK_PROVIDER` | `mnotify` (or leave empty) | — |
| `SMS_SENDER_ID` | `IriesFood` (your approved ID) | Step 2.2 |
| `ARKESEL_API_KEY` | … | Step 2.3 (**secret**) |
| `MNOTIFY_API_KEY` | … | Step 2.4 (**secret**, optional) |
| `STAFF_ALERT_PHONES` | `+233…,+233…` | Managers who get "order waiting" and catering SMS |
| `CRON_SECRET` | a long random string | Make one at [passwordsgenerator.net](https://passwordsgenerator.net) (40+ characters, no symbols) or run `openssl rand -hex 32` |
| `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` | from sentry.io (optional) | Step 9 |

4. Click **Deploy**. The first build takes 2–3 minutes.
5. **Upgrade the Vercel team to Pro** (Settings → Billing). This is required for a business, and it runs the 5-minute background job in `vercel.json` (payment re-checks, unpaid-order timeouts, staff alerts). The project's functions run in **London** (also set in `vercel.json`).

The full list of settings, with comments, is in [`.env.example`](../.env.example).

## 6. Connect your domain

Vercel → Project → **Settings → Domains** → add `order.iriescuisine.com`. Vercel shows a DNS record, usually a **CNAME** pointing to `cname.vercel-dns.com`. Add it at your domain registrar. HTTPS is set up automatically within minutes.

## 7. Connect the services to your site

1. **Paystack webhook:** Paystack → Settings → API Keys & Webhooks → **Test Webhook URL**:
   `https://order.iriescuisine.com/api/webhooks/paystack` → Save.
2. **Phone sign-in (OTP by SMS):**
   1. Supabase → **Authentication → Auth Hooks** → *Add hook* → **Send SMS hook** → type **HTTPS**.
   2. URL: `https://order.iriescuisine.com/api/auth/sms-hook`
   3. Click **Generate secret**, copy it (`v1,whsec_…`) → add it in Vercel as `SUPABASE_SMS_HOOK_SECRET` → **Redeploy** (Vercel → Deployments → ⋯ → Redeploy).
   4. Supabase → **Authentication → Sign In / Providers → Phone**: enable. Set **SMS OTP expiry** to `300` seconds and **OTP length** to `6`. Save.
   5. Leave **Email** enabled (staff sign in with email). Phone sign-up must stay allowed, because new customers are created on their first code.
3. **Create your owner login.**
   1. Supabase → **Authentication → Users → Add user → Create new user**: your email and a strong password, with **Auto Confirm** ticked.
   2. Then in **SQL Editor** run (with your email and name):
   ```sql
   insert into public.staff (user_id, display_name, role)
   select id, 'Your Name', 'owner' from auth.users where email = 'you@example.com';
   ```
   3. Now sign in at `https://order.iriescuisine.com/staff/login`.

## 8. Set up the restaurant (Admin)

Sign in at `/staff/login` → **Admin**:

1. **Hours & settings:**
   - Opening hours, holidays, default prep time, pickup address, WhatsApp and support numbers.
   - The **"Accepting orders"** switch pauses ordering instantly.
2. **Delivery zones:** your real areas, fees, minimum orders and ride times. Turn off the samples you don't need.
3. **Extras & spice:** spice levels, extra protein, sides and their prices.
4. **Menu:** edit or hide the sample dishes; add yours with photos. Take photos in landscape, in daylight; the app shrinks them automatically. New dishes start **hidden** until you switch "On menu" on.
5. **Staff:** create a login for every attendant, cook, rider and manager. Every action is recorded against the person who did it, so **never share logins**.

## 9. Monitoring (15 minutes, do it before launch)

- **Uptime:** at [uptimerobot.com](https://uptimerobot.com), add an HTTP monitor for `https://order.iriescuisine.com/api/health` every 5 minutes, with alerts to two phones/emails.
- **Errors:** at [sentry.io](https://sentry.io), create a Next.js project, copy the DSN into `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` in Vercel, and redeploy.
- **Backups:** Supabase Pro makes daily backups automatically (kept 7 days). Check Database → Backups once.

## 10. Test everything in test mode (Paystack test keys)

Use **real phones**, one Android and one iPhone, on mobile data.

| ✓ | Test |
|---|---|
| ☐ | Open the site on Android Chrome → "Install" → it appears on the home screen |
| ☐ | On iPhone Safari → Share → **Add to Home Screen** |
| ☐ | Sign in with your phone → the 6-digit code arrives by SMS |
| ☐ | Order for delivery → pay with Paystack's **test** MoMo/card details (see *Test Payments* in Paystack's docs) → the tracking page shows "Payment received" and you get an SMS |
| ☐ | Attendant tablet: tap **Start shift** → the next paid order **rings loudly** → Accept (prep time) → customer SMS |
| ☐ | Kitchen tablet: ticket appears → Start → Ready (watch the timer colours) |
| ☐ | Attendant: **Send out** (rider name/phone, WhatsApp the rider) → Delivered |
| ☐ | Reject a paid order → the customer is refunded automatically (Paystack dashboard → Refunds) |
| ☐ | Manager: partial refund from Admin → Orders |
| ☐ | Phone order: Staff → New order → the customer gets the pay link by SMS/WhatsApp → pays → it rings |
| ☐ | Mark a dish **sold out** → it shows "Sold out" on a customer phone within seconds |
| ☐ | Turn Wi-Fi off on the kitchen tablet for a minute → the red "Offline" banner appears → turn it on → orders catch up |
| ☐ | Admin → Sales shows the test orders; the CSV exports open in Excel |
| ☐ | Print a ticket (if you bought a thermal printer: install it as a normal printer on the tablet/PC, then choose it in the print dialog) |

## 11. Go live

1. Paystack must show your business as **activated**.
2. Paystack → API Keys & Webhooks → copy the **Live Secret Key** → Vercel `PAYSTACK_SECRET_KEY` = `sk_live_…`.
3. Set the **Live Webhook URL** in Paystack to the same `…/api/webhooks/paystack`.
4. Redeploy in Vercel.
5. Place a real small order with your own MoMo, accept it, then refund it from Admin. You should see the money leave and come back.
6. Clear the test orders: SQL Editor → paste and run [`supabase/reset_test_orders.sql`](../supabase/reset_test_orders.sql). Order numbers restart at #1001. **Only do this before the first real customer order**, because it removes all orders and payments.

## 12. Everyday changes you can make yourself

| Change | How |
|---|---|
| Prices, dishes, photos, zones, hours, holidays | Admin pages (no developer needed) |
| Pause all orders (power cut, overload) | Admin → Hours & settings → *Accepting orders* off |
| Brand colours | Edit the block at the top of `src/app/globals.css` (on GitHub: open the file → pencil icon → commit). Vercel redeploys automatically. |
| Logo / app icon | Developer runs `npm run icons -- path/to/logo.png` and commits |
| Privacy policy / terms text | `src/app/(shop)/privacy/page.tsx` and `terms/page.tsx`. **Have a lawyer review them before launch.** |

## 13. Troubleshooting

| Problem | Check |
|---|---|
| OTP code never arrives | Supabase → Authentication → Logs; Vercel → Logs for `/api/auth/sms-hook`; your Arkesel balance; the sender ID is approved (or temporarily remove `SMS_SENDER_ID` to use the provider's default) |
| Paid but the order still says "Waiting for payment" | Paystack → Settings → Webhooks shows delivery attempts and responses. The 5-minute job also re-checks every open payment, so it fixes itself within 5 minutes. |
| No alarm on the attendant tablet | Tap **Start shift** after every page reload (browsers block sound until you tap). Set the tablet volume to maximum and turn off "Do not disturb". |
| "Offline — reconnecting" stays red | The tablet's internet. Orders and payments are still safe on the server; the screen catches up on reconnect. |
| A refund failed | Admin → Orders → filter **Needs attention** → open the order → **Retry refund** (or refund from the Paystack dashboard) |
| Staff member left | Admin → Staff → switch them off. They lose access immediately. |

## For developers

- Local development: `npm install`, copy `.env.example` to `.env.local`, then `npm run dev`. For a local Supabase, use `npx supabase init && npx supabase start` (needs Docker). It applies `supabase/migrations` and `supabase/seed.sql` on `npx supabase db reset`. Use `SMS_PROVIDER=console` to print OTPs and SMS to the terminal.
- Checks: `npm run typecheck`, `npm run lint`, `npm test` (unit), `npm run test:db` (database, needs local Postgres), `npm run test:e2e` (full stack; see `e2e/README.md`).
- New database functions are granted to `anon`/`authenticated` by Supabase's defaults. Add a matching `revoke`/`grant` like those in `20261001000300_security.sql` for every new function.
