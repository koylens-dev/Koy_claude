import crypto from 'node:crypto'
export function sign(payload, secret) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const p = Buffer.from(JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400, ...payload })).toString('base64url')
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${s}`
}
// CLI: node jwt.mjs '<json>' secret
if (process.argv[1]?.endsWith("jwt.mjs") && process.argv[2]) console.log(sign(JSON.parse(process.argv[2]), process.argv[3]))
