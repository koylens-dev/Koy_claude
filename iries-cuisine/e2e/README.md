# End-to-end tests

Runs the real production build against a real Postgres with the Supabase migrations, using
[PostgREST](https://postgrest.org) (what Supabase uses for its REST API) plus a small mock that
stands in for Supabase Auth and Paystack. It walks an order through the whole lifecycle:

checkout quote → order + Paystack checkout → signed webhook (re-verified with "Paystack") →
paid → attendant accepts → kitchen → manager partial refund → cancel with automatic refund →
phone/WhatsApp order with pay link → CSV exports → cron → OTP SMS hook → catering → sales report.

```bash
# one-off: download a PostgREST binary for your OS from
# https://github.com/PostgREST/postgrest/releases and point POSTGREST_BIN at it
export POSTGREST_BIN=/path/to/postgrest
npm run test:e2e
```

Run it before every release. It does **not** call the real Paystack, SMS provider or Supabase;
use Paystack test mode on a staging deployment for that (see docs/SETUP_AND_DEPLOY.md, step 9).
