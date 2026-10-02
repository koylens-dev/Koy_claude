import type { Config } from '@netlify/functions'

// Netlify stand-in for the Vercel Cron in vercel.json: calls the app's housekeeping
// endpoint every 5 minutes (payment re-checks, unpaid-order timeouts, refund tracking,
// manager alerts). Scheduled functions only run on the published deploy.
const runCron = async () => {
  const site = Netlify.env.get('URL')
  const secret = Netlify.env.get('CRON_SECRET')
  if (!site || !secret) {
    console.log('cron skipped: URL or CRON_SECRET not set')
    return
  }
  const res = await fetch(`${site}/api/cron`, { headers: { authorization: `Bearer ${secret}` } })
  console.log('cron', res.status, (await res.text()).slice(0, 300))
}

export default runCron

export const config: Config = { schedule: '*/5 * * * *' }
