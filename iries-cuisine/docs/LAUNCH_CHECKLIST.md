# Launch plan: 1 → 12 October 2026

The code is done and tested. What's left is accounts, approvals, content, devices and people. Each line names who usually does it. "Tech" means whoever follows [`SETUP_AND_DEPLOY.md`](./SETUP_AND_DEPLOY.md).

## Day by day

| Date | Do | Who | Blocking? |
|---|---|---|---|
| **Fri 2 Oct** | Create the Paystack account and **submit compliance documents** (names must match exactly) | Owner | **Yes, critical path** |
| Fri 2 Oct | Create the Arkesel account, buy credit, **register the sender ID** | Owner | Has a fallback (default sender ID) |
| Fri 2 Oct | Buy the domain. Create the Supabase (Pro, London) and Vercel (Pro) accounts with the dollar card. | Owner / tech | Yes |
| Fri 2 Oct | Steps 3, 5, 6 and 7 of the setup guide (database, deploy, domain, OTP hook, owner login) | Tech | Yes |
| Sat 3 – Sun 4 | **Menu content:** final dishes, portions, prices, spice/extras, descriptions. Photograph the dishes in daylight. | Owner + chef | Photos have a fallback (placeholders) |
| Sat 3 – Sun 4 | Real delivery zones, fees, minimum orders and ride times; opening hours; public holidays | Owner | Yes |
| Mon 5 | Buy or prepare devices: kitchen tablet (10", Android), attendant phone or tablet, chargers, data bundle as Wi-Fi backup, optional 80 mm thermal printer | Owner | Kitchen tablet: yes |
| Mon 5 | Create staff logins (Admin → Staff), one per person | Manager | Yes |
| Mon 5 – Tue 6 | **Test mode run-through** on real phones: the whole checklist in setup guide §10 | Tech + manager | Yes |
| Tue 6 | Send the privacy policy and terms to a lawyer. **Register with the Data Protection Commission** as a data controller. | Owner | Legal |
| Wed 7 | Staff training session 1 (30 min): attendant console, alarm, accept/reject, phone orders, sold out, kitchen display | Manager | Yes |
| **Wed 7 – Thu 8** | Paystack activated → **switch to live keys** (§11) → real small order + refund | Tech | **Yes** |
| Thu 8 – Sat 10 | **Soft launch:** invite 20–50 friends and family to order for real. Watch the dashboard, timings and SMS. Fix anything awkward. | Everyone | Strongly recommended |
| Sat 10 | Staff training session 2: rush-hour drill (5 orders at once), offline drill (switch Wi-Fi off), refund drill | Manager | Yes |
| Sun 11 | Run the reset script ([`supabase/reset_test_orders.sql`](../supabase/reset_test_orders.sql)) **only if you want to clear soft-launch test orders**. Final checks (below). Prepare launch posts with dish links (`/menu/<dish>`). | Owner / tech | — |
| **Mon 12 Oct** | 🎉 Go live: share the link on Instagram/WhatsApp status, pin the WhatsApp catalogue link, staff on shift 30 minutes early | Everyone | — |

**If Paystack is not activated by Fri 9 Oct:** keep the launch date for the *announcement*, but open ordering only when activation lands (Admin → *Accepting orders* off, with a pause message such as "Ordering opens on …"). Plan B is a Hubtel adapter (1–2 days of development). Don't fall back to unverified MoMo transfers.

## Go-live morning checklist

- [ ] Paystack shows **Live** mode; `PAYSTACK_SECRET_KEY` starts with `sk_live_`; the live webhook URL is set
- [ ] A live test order (your own MoMo) reached the kitchen; it was refunded successfully
- [ ] OTP SMS arrives within ~30 seconds on MTN, Telecel and AT numbers
- [ ] Admin → Hours & settings: *Accepting orders* **on**; correct hours; delivery and pickup on
- [ ] Every active dish has the right price; sold-out items toggled
- [ ] Attendant tablet: signed in, **Start shift tapped**, volume at maximum, charger plugged in, screen stays on
- [ ] Kitchen tablet: signed in, **Start shift tapped**, mounted where cooks can see it
- [ ] `STAFF_ALERT_PHONES` set to the manager on duty
- [ ] UptimeRobot monitor green; Sentry receiving events (optional)
- [ ] Paystack payout account confirmed (and manual payouts if you need weekend cash)
- [ ] WhatsApp support phone is with someone during opening hours

## The first week

- **Each night:** Admin → Sales → *Today*; check rejected/cancelled orders and their reasons.
- **Each morning:** Admin → Export → **Payments** for yesterday; compare the total with Paystack's settlement. The dashboard also flags any payment anomaly or failed refund at the top.
- **Weekly:** look at average prep and accept times. If accepting regularly takes more than 3 minutes, add a second attendant at peak or lower `STAFF_ALERT_AFTER_MINUTES`.
