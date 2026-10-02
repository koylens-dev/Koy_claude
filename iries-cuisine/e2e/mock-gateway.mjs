// Local stand-in for Supabase's API gateway + a fake Paystack, for end-to-end tests.
//  /rest/v1/*         -> PostgREST on :3001
//  /auth/v1/user      -> validates our HS256 JWT and returns a GoTrue-style user
//  /auth/v1/admin/users -> create / delete users (writes auth.users through psql)
//  /paystack/*        -> fake Paystack (initialize, verify, refund)
import http from 'node:http'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const SECRET = process.env.JWT_SECRET
const tx = new Map() // reference -> { amount, status }
const stats = { refunds: 0 } // how often the app called Paystack's refund API

function verifyJwt(token) {
  const [h, p, s] = token.split('.')
  const sig = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')
  if (sig !== s) return null
  return JSON.parse(Buffer.from(p, 'base64url').toString())
}

// Run one SQL statement against the e2e database (psql variables keep values quoted safely).
function sql(statement, vars = {}) {
  const args = ['-h', process.env.E2E_PGHOST, '-p', '54329', '-U', 'postgres', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1']
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`)
  return execFileSync(process.env.E2E_PSQL ?? 'psql', args, { input: statement }).toString().trim()
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' }
function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', ...CORS })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }
  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = Buffer.concat(chunks)

  if (url.pathname.startsWith('/rest/v1')) {
    const headers = { ...req.headers }
    delete headers.host
    const upstream = http.request(
      { host: '127.0.0.1', port: 3001, path: url.pathname.replace('/rest/v1', '') + url.search, method: req.method, headers },
      (up) => {
        res.writeHead(up.statusCode, { ...up.headers, ...CORS })
        up.pipe(res)
      },
    )
    upstream.on('error', (e) => send(res, 502, { message: e.message }))
    upstream.end(body)
    return
  }

  if (url.pathname === '/auth/v1/user') {
    const token = (req.headers.authorization ?? '').replace('Bearer ', '')
    const claims = token && verifyJwt(token)
    if (!claims || !claims.sub) return send(res, 401, { msg: 'invalid JWT' })
    return send(res, 200, { id: claims.sub, aud: 'authenticated', role: 'authenticated', email: claims.email ?? '', phone: claims.phone ?? '', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
  }
  if (url.pathname.startsWith('/auth/v1/admin/users')) {
    const claims = verifyJwt((req.headers.authorization ?? '').replace('Bearer ', ''))
    if (claims?.role !== 'service_role') return send(res, 403, { msg: 'service role required' })
    const id = url.pathname.split('/')[5]
    if (req.method === 'POST' && !id) {
      const b = JSON.parse(body.toString())
      const newId = crypto.randomUUID()
      try {
        sql(`insert into auth.users (id, email) values (:'id', :'email');`, { id: newId, email: b.email })
      } catch {
        return send(res, 422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' })
      }
      return send(res, 200, { id: newId, aud: 'authenticated', role: 'authenticated', email: b.email, user_metadata: b.user_metadata ?? {}, app_metadata: {}, created_at: new Date().toISOString() })
    }
    if (req.method === 'DELETE' && id) {
      sql(`delete from auth.users where id = :'id';`, { id })
      return send(res, 200, { id, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
    }
    if (req.method === 'PUT' && id) return send(res, 200, { id, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
    return send(res, 404, { msg: 'not found' })
  }
  if (url.pathname.startsWith('/auth/v1/')) return send(res, 200, { keys: [] })

  if (url.pathname === '/paystack/transaction/initialize') {
    const b = JSON.parse(body.toString())
    tx.set(b.reference, { amount: b.amount, status: 'pending' })
    return send(res, 200, { status: true, message: 'ok', data: { authorization_url: `https://checkout.paystack.test/${b.reference}`, access_code: 'ac_' + b.reference, reference: b.reference } })
  }
  const vm = url.pathname.match(/^\/paystack\/transaction\/verify\/(.+)$/)
  if (vm) {
    const ref = decodeURIComponent(vm[1])
    const t = tx.get(ref)
    if (!t) return send(res, 400, { status: false, message: 'Transaction reference not found' })
    return send(res, 200, { status: true, data: { id: 9000 + tx.size, status: t.status, reference: ref, amount: t.amount, currency: 'GHS', channel: 'mobile_money', fees: Math.round(t.amount * 0.0195), paid_at: new Date().toISOString(), gateway_response: 'Approved' } })
  }
  if (url.pathname === '/paystack/__approve') { // test helper: customer approves MoMo prompt
    const ref = url.searchParams.get('ref')
    if (tx.has(ref)) tx.get(ref).status = 'success'
    return send(res, 200, { ok: tx.has(ref) })
  }
  if (url.pathname === '/paystack/__stats') return send(res, 200, stats) // test helper
  if (url.pathname === '/paystack/refund') {
    stats.refunds++
    const b = JSON.parse(body.toString())
    return send(res, 200, { status: true, data: { id: Math.floor(Math.random() * 1e6), status: 'pending', amount: b.amount, currency: 'GHS', transaction: { reference: b.transaction } } })
  }
  if (url.pathname.startsWith('/paystack/refund/')) return send(res, 200, { status: true, data: { id: 1, status: 'processed', amount: 0, currency: 'GHS' } })
  send(res, 404, { message: 'not found ' + url.pathname })
})
server.listen(54321, '127.0.0.1', () => console.log('mock gateway on :54321'))
