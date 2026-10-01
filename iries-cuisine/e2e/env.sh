# Test-only configuration for the local end-to-end stack. NOT real secrets.
export NEXT_TELEMETRY_DISABLED=1
export JWT_SECRET=e2e-super-secret-jwt-key-with-at-least-32-chars
_jwt() { node "$(dirname "${BASH_SOURCE[0]}")/jwt.mjs" "$1" "$JWT_SECRET"; }
export NEXT_PUBLIC_SITE_URL=http://localhost:3100
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(_jwt '{"role":"anon"}')"
export SUPABASE_SECRET_KEY="$(_jwt '{"role":"service_role"}')"
export PAYSTACK_SECRET_KEY=sk_test_e2e
export PAYSTACK_API_BASE=http://localhost:54321/paystack
export SMS_PROVIDER=console
export SUPABASE_SMS_HOOK_SECRET='v1,whsec_ZTJlLXRlc3Qtb25seS1zbXMtaG9vay1zZWNyZXQtMzJieXRlcw=='
export CRON_SECRET=e2e-cron-secret
export STAFF_ALERT_PHONES=+233200000001
export STAFF_ALERT_AFTER_MINUTES=0
export NEXT_PUBLIC_WHATSAPP_NUMBER=+233200000000
