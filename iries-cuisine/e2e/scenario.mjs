// End-to-end scenario against the running app (http://localhost:3100): checkout, payment
// webhooks, staff status changes, refunds, phone orders, exports, cron, the OTP hook and
// demo / training mode.
// Start the stack first:  bash e2e/up.sh   (see e2e/README.md)
import crypto from 'node:crypto'
import { sign } from './jwt.mjs'

const APP = 'http://localhost:3100'
const SECRET = process.env.JWT_SECRET ?? 'e2e-super-secret-jwt-key-with-at-least-32-chars'
let failures = 0
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} - ${label}${extra ? ` (${extra})` : ''}`)
  if (!cond) failures++
}

function cookieFor(user) {
  const access_token = sign({ sub: user.id, role: 'authenticated', aud: 'authenticated', phone: user.phone ?? '', email: user.email ?? '' }, SECRET)
  const session = {
    access_token,
    refresh_token: 'rt-' + user.id,
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    token_type: 'bearer',
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', phone: user.phone ?? '', email: user.email ?? '', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  }
  return `sb-localhost-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
}
const customer = cookieFor({ id: '11111111-1111-4111-8111-111111111111', phone: '233241110001' })
const attendant = cookieFor({ id: '22222222-2222-4222-8222-222222222222', email: 'esi@iries.test' })
const manager = cookieFor({ id: '33333333-3333-4333-8333-333333333333', email: 'akua@iries.test' })
const kitchen = cookieFor({ id: '44444444-4444-4444-8444-444444444444', email: 'kojo@iries.test' })
const owner = cookieFor({ id: '55555555-5555-4555-8555-555555555555', email: 'owner@iries.test' })

async function call(path, { method = 'GET', cookie, body, headers = {} } = {}) {
  const res = await fetch(APP + path, {
    method,
    redirect: 'manual',
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text, location: res.headers.get('location') }
}
const rest = async (path, role = 'service_role', init = {}) => {
  const key = sign({ role }, SECRET)
  const res = await fetch('http://localhost:54321/rest/v1' + path, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers ?? {}) } })
  return res.json()
}

// ---- menu ids from the DB
const [jollof] = await rest('/menu_items?slug=eq.jollof-grilled-chicken&select=id,menu_item_portions(id,name,price_pesewas),menu_item_modifier_groups(modifier_groups(name,modifier_options(id,name,price_pesewas)))')
const large = jollof.menu_item_portions.find((p) => p.name === 'Large')
const groups = Object.fromEntries(jollof.menu_item_modifier_groups.map((l) => [l.modifier_groups.name, l.modifier_groups.modifier_options]))
const hot = groups['Spice level'].find((o) => o.name === 'Hot')
const chicken = groups['Extra protein'].find((o) => o.name === 'Grilled chicken')
const [zone] = await rest('/delivery_zones?name=eq.Adenta&select=id,fee_pesewas')

// a valid schedule slot: tomorrow 13:00 Accra (= UTC) — inside the seeded hours every day of the week
const t = new Date(Date.now() + 86400000)
const slot = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 13, 0)).toISOString()

const order = {
  fulfilment: 'delivery',
  zoneId: zone.id,
  address: { gps: 'ga5430125', landmark: 'Behind Adenta SDA church', directions: 'Blue gate' },
  scheduledFor: slot,
  notes: 'Call when outside',
  lines: [{ itemId: jollof.id, portionId: large.id, optionIds: [hot.id, chicken.id], quantity: 2, notes: 'no onions' }],
  customer: { name: 'Ama Mensah', email: '', marketingConsent: true },
}

// ---- auth gates
ok((await call('/api/checkout', { method: 'POST', body: { ...order, mode: 'quote' } })).status === 401, 'checkout requires sign-in')
ok((await call('/checkout')).location?.includes('/login?next=%2Fcheckout'), 'proxy redirects signed-out checkout to login')
ok((await call('/staff/orders', { cookie: customer })).location?.includes('/staff/login'), 'customer cannot open staff console')
ok((await call('/admin', { cookie: attendant })).location?.endsWith('/staff'), 'attendant is bounced from admin')
ok((await call('/staff/orders', { cookie: attendant })).status === 200, 'attendant opens console')
ok((await call('/admin', { cookie: manager })).status === 200, 'manager opens admin')

// ---- quote
const q = await call('/api/checkout', { method: 'POST', cookie: customer, body: { ...order, mode: 'quote' } })
const expectedUnit = large.price_pesewas + hot.price_pesewas + chicken.price_pesewas
ok(q.status === 200 && q.json.quote.ok, 'quote is ok', JSON.stringify(q.json?.quote?.issues))
ok(q.json.quote.subtotal === expectedUnit * 2 && q.json.quote.deliveryFee === zone.fee_pesewas, 'server prices from DB', `subtotal ${q.json.quote.subtotal}`)
const asap = await call('/api/checkout', { method: 'POST', cookie: customer, body: { ...order, scheduledFor: null, mode: 'quote' } })
ok(asap.json.quote.issues.some((i) => i.code === 'closed') || asap.json.quote.ok, 'ASAP outside hours is refused (or open now)')
const badSlot = await call('/api/checkout', { method: 'POST', cookie: customer, body: { ...order, scheduledFor: new Date(Date.parse(slot) + 600000).toISOString(), mode: 'quote' } })
ok(badSlot.json.quote.issues.some((i) => i.code === 'schedule_invalid'), 'off-grid schedule slot refused')
const tampered = await call('/api/checkout', { method: 'POST', cookie: customer, body: { ...order, lines: [{ ...order.lines[0], unitPrice: 1 }], mode: 'quote' } })
ok(tampered.json.quote.subtotal === expectedUnit * 2, 'client-sent prices are ignored')

// ---- place -> payment init
const placed = await call('/api/checkout', { method: 'POST', cookie: customer, body: { ...order, mode: 'place' } })
ok(placed.status === 200 && placed.json.authorizationUrl?.startsWith('https://checkout.paystack.test/'), 'order placed, Paystack checkout URL returned', placed.text.slice(0, 200))
const { token, orderId } = placed.json
const reference = placed.json.authorizationUrl.split('/').pop()
let [o] = await rest(`/orders?id=eq.${orderId}&select=status,total_pesewas,address_gps,customer_phone,scheduled_for`)
ok(o.status === 'awaiting_payment' && o.address_gps === 'GA-543-0125' && o.customer_phone === '+233241110001', 'order awaiting payment with normalised GPS and verified phone')

// track page before payment
let track = await call(`/t/${token}`)
ok(track.status === 200 && track.text.includes('Waiting for payment'), 'tracking page shows waiting for payment')

// pay link re-uses the open transaction
const pay = await call(`/pay/${token}`)
ok(pay.status === 303 && pay.location === placed.json.authorizationUrl, 'pay link re-uses the open Paystack checkout')

// ---- webhook: bad signature, then MoMo still pending, then approved
const evt = JSON.stringify({ event: 'charge.success', data: { reference, amount: o.total_pesewas } })
const sig = (b) => crypto.createHmac('sha512', 'sk_test_e2e').update(b).digest('hex')
ok((await call('/api/webhooks/paystack', { method: 'POST', body: evt, headers: { 'x-paystack-signature': 'bad' } })).status === 401, 'unsigned webhook rejected')
const pendingHook = await call('/api/webhooks/paystack', { method: 'POST', body: evt, headers: { 'x-paystack-signature': sig(evt) } })
ok(pendingHook.status === 200, 'webhook accepted', pendingHook.text)
;[o] = await rest(`/orders?id=eq.${orderId}&select=status`)
ok(o.status === 'awaiting_payment', 'forged/early "success" webhook does not mark paid: we re-verify with Paystack (still pending)')

await fetch(`http://localhost:54321/paystack/__approve?ref=${reference}`) // customer approves the MoMo prompt
const evt2 = JSON.stringify({ event: 'charge.success', data: { reference, amount: o.total_pesewas, id: 2 } })
const hook = await call('/api/webhooks/paystack', { method: 'POST', body: evt2, headers: { 'x-paystack-signature': sig(evt2) } })
ok(hook.json?.result === 'paid', 'verified payment marks the order paid', hook.text)
const dup = await call('/api/webhooks/paystack', { method: 'POST', body: evt2, headers: { 'x-paystack-signature': sig(evt2) } })
ok(dup.json?.duplicate === true, 'duplicate webhook delivery ignored')
const verify = await call('/api/payments/verify', { method: 'POST', body: { reference, token } })
ok(verify.json?.result === 'already_processed', 'customer return verification is idempotent')
;[o] = await rest(`/orders?id=eq.${orderId}&select=status,paid_payment_id`)
ok(o.status === 'paid' && o.paid_payment_id, 'order is paid')
await new Promise((r) => setTimeout(r, 500))
let notes = await rest(`/notifications?order_id=eq.${orderId}&select=kind,status`)
ok(notes.some((n) => n.kind === 'order_paid' && n.status === 'sent'), 'payment SMS sent once', JSON.stringify(notes))

// ---- staff flow
ok((await call(`/api/staff/orders/${orderId}/status`, { method: 'POST', cookie: kitchen, body: { to: 'accepted' } })).status === 403, 'kitchen cannot accept')
const acc = await call(`/api/staff/orders/${orderId}/status`, { method: 'POST', cookie: attendant, body: { to: 'accepted', prepMinutes: 20 } })
ok(acc.status === 200 && acc.json.order.status === 'accepted', 'attendant accepts', acc.text.slice(0, 200))
ok((await call(`/api/staff/orders/${orderId}/status`, { method: 'POST', cookie: kitchen, body: { to: 'in_kitchen' } })).json?.order?.status === 'in_kitchen', 'kitchen starts')
ok((await call(`/api/staff/orders/${orderId}/status`, { method: 'POST', cookie: customer, body: { to: 'ready' } })).status === 401, 'customer cannot use staff API')
ok((await call(`/api/staff/orders/${orderId}/refund`, { method: 'POST', cookie: attendant, body: { amountPesewas: 500, reason: 'test' } })).status === 403, 'attendant cannot refund')
const partial = await call(`/api/staff/orders/${orderId}/refund`, { method: 'POST', cookie: manager, body: { amountPesewas: 1000, reason: 'Missing coleslaw' } })
ok(partial.status === 200 && partial.json.refund.ok, 'manager partial refund', partial.text.slice(0, 200))
const over = await call(`/api/staff/orders/${orderId}/refund`, { method: 'POST', cookie: manager, body: { amountPesewas: 99999999, reason: 'too much' } })
ok(over.status === 422, 'over-refund refused', over.json?.error?.message)
const cancel = await call(`/api/staff/orders/${orderId}/status`, { method: 'POST', cookie: manager, body: { to: 'cancelled', note: 'Gas ran out' } })
ok(cancel.status === 200 && cancel.json.refund?.ok && cancel.json.order.status === 'refunded', 'manager cancel => automatic refund of the balance => Refunded', cancel.text.slice(0, 300))
;[o] = await rest(`/orders?id=eq.${orderId}&select=status,refunded_pesewas,total_pesewas`)
ok(o.refunded_pesewas === o.total_pesewas, 'refunded total equals amount paid')
track = await call(`/t/${token}`)
ok(track.text.includes('Refund'), 'tracking page shows the refund')
await new Promise((r) => setTimeout(r, 500))
const [cancelSms] = await rest(`/notifications?order_id=eq.${orderId}&kind=eq.order_cancelled&select=body`)
ok(cancelSms?.body.includes('GHS 285.00'), 'cancellation SMS states the balance actually refunded', cancelSms?.body)

// ---- phone order by attendant
const phoneOrder = await call('/api/staff/orders', {
  method: 'POST',
  cookie: attendant,
  body: { mode: 'place', channel: 'whatsapp', customer: { name: 'Yaw Boateng', phone: '0551234567' }, fulfilment: 'pickup', address: {}, lines: [{ itemId: jollof.id, portionId: large.id, optionIds: [hot.id], quantity: 1 }], sendPaymentSms: true },
})
ok(phoneOrder.status === 200 && phoneOrder.json.links.pay.includes('/pay/'), 'attendant creates WhatsApp order with pay link', phoneOrder.text.slice(0, 200))
const phonePay = await call(new URL(phoneOrder.json.links.pay).pathname)
ok(phonePay.status === 303 && phonePay.location.startsWith('https://checkout.paystack.test/'), 'pay link redirects to Paystack')

// ---- exports, cron, sms hook, health
const csv = await call('/api/admin/export?type=orders&from=2020-01-01&to=2030-12-31', { cookie: manager })
ok(csv.status === 200 && csv.text.includes('order_number') && csv.text.includes('Ama Mensah'), 'manager exports orders CSV')
ok((await call('/api/admin/export?type=orders&from=2020-01-01&to=2030-12-31', { cookie: attendant })).status === 403, 'attendant cannot export')
const cust = await call('/api/admin/export?type=customers', { cookie: manager })
ok(cust.status === 200 && cust.text.includes('+233241110001'), 'customer export with consent column')
ok((await call('/api/cron')).status === 401, 'cron requires secret')
const cron = await call('/api/cron', { headers: { authorization: 'Bearer e2e-cron-secret' } })
ok(cron.status === 200 && cron.json.ok, 'cron runs', cron.text)

const hookSecret = process.env.SUPABASE_SMS_HOOK_SECRET ?? 'v1,whsec_ZTJlLXRlc3Qtb25seS1zbXMtaG9vay1zZWNyZXQtMzJieXRlcw=='
const hookBody = JSON.stringify({ user: { phone: '233241110001' }, sms: { otp: '482913' } })
const ts = String(Math.floor(Date.now() / 1000))
const key = Buffer.from(hookSecret.replace('v1,whsec_', ''), 'base64')
const hsig = crypto.createHmac('sha256', key).update(`msg_1.${ts}.${hookBody}`).digest('base64')
const sms = await call('/api/auth/sms-hook', { method: 'POST', body: hookBody, headers: { 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': `v1,${hsig}` } })
ok(sms.status === 200, 'OTP SMS hook delivers code', sms.text)
ok((await call('/api/auth/sms-hook', { method: 'POST', body: hookBody, headers: { 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': 'v1,bad' } })).status === 401, 'OTP hook rejects bad signature')

const cat = await call('/api/catering', { method: 'POST', body: { name: 'Efua', phone: '0201234567', headcount: 120, eventDate: '2026-12-12', eventType: 'Wedding / engagement' } })
ok(cat.status === 200, 'catering enquiry saved')

// sales summary through the API as the manager
const mgrKey = sign({ sub: '33333333-3333-4333-8333-333333333333', role: 'authenticated' }, SECRET)
const summary = await (await fetch('http://localhost:54321/rest/v1/rpc/sales_summary', { method: 'POST', headers: { apikey: mgrKey, authorization: `Bearer ${mgrKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_from: new Date(Date.now() - 86400000).toISOString().slice(0, 10), p_to: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }) })).json()
ok(summary.totals?.orders === 1 && summary.totals.refunds_pesewas === o.total_pesewas, 'sales summary counts the order and its refunds', JSON.stringify(summary.totals))

// ---- demo / training mode
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const paystackRefunds = async () => (await (await fetch('http://localhost:54321/paystack/__stats')).json()).refunds
ok((await call('/api/admin/demo', { method: 'POST', cookie: manager, body: { action: 'seed' } })).status === 403, 'only the owner can load demo data')
ok((await call('/api/admin/demo', { cookie: attendant })).status === 403, 'attendant cannot see demo status')
const seeded = await call('/api/admin/demo', { method: 'POST', cookie: owner, body: { action: 'seed' } })
ok(seeded.status === 200 && seeded.json.seeded.history_orders > 500 && seeded.json.seeded.live_orders === 10, 'owner loads six weeks of demo orders + 10 live ones', seeded.text.slice(0, 200))
ok(seeded.json?.logins?.length === 4 && seeded.json.logins.every((l) => l.password.length === 14), 'four practice logins returned once', JSON.stringify(seeded.json?.logins?.map((l) => l.role)))
ok((await call('/api/admin/demo', { method: 'POST', cookie: owner, body: { action: 'seed' } })).status === 409, 'demo data cannot be loaded twice')
const demoStatus = await call('/api/admin/demo', { cookie: manager })
ok(demoStatus.status === 200 && demoStatus.json.orders > 500 && demoStatus.json.staff.length === 4, 'manager sees demo status')
const demoStaff = await rest('/staff?is_demo=eq.true&role=eq.attendant&select=user_id')
const demoAttendant = cookieFor({ id: demoStaff[0].user_id, email: seeded.json.logins.find((l) => l.role === 'attendant').email })
ok((await call('/staff/orders', { cookie: demoAttendant })).status === 200, 'practice attendant login opens the console')

const [demoUnpaid] = await rest('/orders?is_demo=eq.true&status=eq.awaiting_payment&select=id,public_token,order_number')
const demoPayLink = await call(`/pay/${demoUnpaid.public_token}`)
ok(demoPayLink.status === 303 && demoPayLink.location.includes(`/t/${demoUnpaid.public_token}?error=demo`), 'demo pay link never reaches Paystack', demoPayLink.location)
ok((await call(`/api/staff/orders/${phoneOrder.json.order.id}/demo-pay`, { method: 'POST', cookie: attendant })).status === 403, 'real orders cannot be "simulated" paid')
ok((await call(`/api/staff/orders/${demoUnpaid.id}/demo-pay`, { method: 'POST', cookie: kitchen })).status === 403, 'kitchen cannot simulate payments')
const demoPaid = await call(`/api/staff/orders/${demoUnpaid.id}/demo-pay`, { method: 'POST', cookie: demoAttendant })
ok(demoPaid.status === 200 && demoPaid.json.order.status === 'paid', 'simulated payment moves the demo order to New (paid)', demoPaid.text.slice(0, 200))
const demoAcc = await call(`/api/staff/orders/${demoUnpaid.id}/status`, { method: 'POST', cookie: demoAttendant, body: { to: 'accepted', prepMinutes: 15 } })
ok(demoAcc.json?.order?.status === 'accepted', 'staff practise accepting a demo order')
await sleep(600)
const demoNotes = await rest(`/notifications?order_id=eq.${demoUnpaid.id}&select=kind,status,provider`)
ok(demoNotes.length >= 2 && demoNotes.every((n) => n.status === 'skipped' && n.provider === 'demo'), 'demo orders never send SMS (logged as skipped)', JSON.stringify(demoNotes))

const refundsBefore = await paystackRefunds()
const [demoNew] = await rest('/orders?is_demo=eq.true&status=eq.paid&select=id,total_pesewas&limit=1')
const demoReject = await call(`/api/staff/orders/${demoNew.id}/status`, { method: 'POST', cookie: demoAttendant, body: { to: 'rejected', note: 'Practice: sold out' } })
ok(demoReject.status === 200 && demoReject.json.refund?.ok && demoReject.json.order.status === 'refunded', 'practice rejection refunds the demo order', demoReject.text.slice(0, 300))
const [demoKitchen] = await rest('/orders?is_demo=eq.true&status=eq.in_kitchen&select=id&limit=1')
const demoPartial = await call(`/api/staff/orders/${demoKitchen.id}/refund`, { method: 'POST', cookie: manager, body: { amountPesewas: 500, reason: 'Practice partial refund' } })
ok(demoPartial.status === 200 && demoPartial.json.refund.ok, 'practice partial refund recorded', demoPartial.text.slice(0, 200))
ok((await paystackRefunds()) === refundsBefore, 'demo refunds never call Paystack')
const [demoRefund] = await rest(`/refunds?order_id=eq.${demoNew.id}&select=status,provider_refund_id`)
ok(demoRefund?.status === 'processed' && demoRefund.provider_refund_id.startsWith('DEMO-RF-'), 'demo refund marked processed locally', JSON.stringify(demoRefund))

const cronDemo = await call('/api/cron', { headers: { authorization: 'Bearer e2e-cron-secret' } })
ok(cronDemo.status === 200 && cronDemo.json.staffAlerts === 0, 'unaccepted demo orders never SMS the manager', cronDemo.text)

const practice = await call('/api/staff/orders', {
  method: 'POST',
  cookie: attendant,
  body: { mode: 'place', channel: 'phone', demo: true, customer: { name: 'Practice Customer', phone: '0241119999' }, fulfilment: 'pickup', address: {}, lines: [{ itemId: jollof.id, portionId: large.id, optionIds: [hot.id], quantity: 1 }], sendPaymentSms: true },
})
ok(practice.status === 200 && practice.json.order.is_demo === true, 'attendant creates a practice order', practice.text.slice(0, 200))
await sleep(600)
ok((await rest(`/notifications?order_id=eq.${practice.json.order.id}&select=id`)).length === 0, 'practice order sends no payment-link SMS')
ok((await call(`/api/staff/orders/${practice.json.order.id}/demo-pay`, { method: 'POST', cookie: attendant })).json?.order?.status === 'paid', 'practice order can be simulated paid')

const csvDemo = await call('/api/admin/export?type=orders&from=2020-01-01&to=2030-12-31', { cookie: manager })
ok(csvDemo.status === 200 && csvDemo.text.split('\n').length <= 4 && !csvDemo.text.includes('+2332000'), 'accounting export leaves demo orders out', `${csvDemo.text.split('\n').length} lines`)
const payCsv = await call('/api/admin/export?type=payments&from=2020-01-01&to=2030-12-31', { cookie: manager })
ok(payCsv.status === 200 && !payCsv.text.includes('DEMO-'), 'payments export leaves demo payments out')
const custDemo = await call('/api/admin/export?type=customers', { cookie: manager })
ok(custDemo.status === 200 && !custDemo.text.includes('+2332000') && custDemo.text.includes('+233241110001'), 'customer export never includes demo numbers')
const summaryDemo = await (await fetch('http://localhost:54321/rest/v1/rpc/sales_summary', { method: 'POST', headers: { apikey: mgrKey, authorization: `Bearer ${mgrKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), p_to: new Date().toISOString().slice(0, 10) }) })).json()
ok(summaryDemo.totals?.orders > 300, 'sales report shows the demo history', `${summaryDemo.totals?.orders} orders`)

ok((await call('/api/admin/demo', { method: 'POST', cookie: manager, body: { action: 'clear' } })).status === 403, 'only the owner can remove demo data')
const cleared = await call('/api/admin/demo', { method: 'POST', cookie: owner, body: { action: 'clear' } })
ok(cleared.status === 200 && cleared.json.orders > 500 && cleared.json.staff === 4, 'owner removes all demo data in one click', cleared.text)
ok((await rest('/orders?is_demo=eq.true&select=id')).length === 0 && (await rest('/staff?is_demo=eq.true&select=user_id')).length === 0, 'no demo orders or practice logins left')
const realLeft = await rest(`/orders?id=in.(${orderId},${phoneOrder.json.order.id})&select=id`)
ok(realLeft.length === 2, 'real orders untouched')
ok((await call('/staff/orders', { cookie: demoAttendant })).location?.includes('/staff/login'), 'practice login no longer works')

console.log(failures ? `\n${failures} FAILED` : '\nAll end-to-end checks passed.')
process.exit(failures ? 1 : 0)
