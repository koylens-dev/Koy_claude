#!/usr/bin/env bash
# End-to-end test stack: Postgres (migrated + seeded) + PostgREST + mock Supabase-auth/Paystack
# gateway + the production build of the app on http://localhost:3100.
#
# Needs: Postgres 15+ binaries, a PostgREST binary (https://github.com/PostgREST/postgrest/releases)
# at $POSTGREST_BIN, Node 20+. Run:  bash e2e/up.sh && node e2e/scenario.mjs ; bash e2e/down.sh
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
E2E="$APP/e2e"
PGBIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
PGROOT=$APP/.pgtest-e2e
DATA=$PGROOT/pgdata
SOCK=$PGROOT/sock
source "$E2E/env.sh"

rm -rf "$PGROOT" && mkdir -p "$SOCK"
RUN_AS=""
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || useradd -r postgres
  chown -R postgres "$PGROOT"
  RUN_AS="runuser -u postgres --"
fi
$RUN_AS "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
$RUN_AS "$PGBIN/pg_ctl" -D "$DATA" -o "-k $SOCK -p 54329 -c listen_addresses=''" -l "$PGROOT/pg.log" start >/dev/null
PSQL=("$PGBIN/psql" -h "$SOCK" -p 54329 -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$APP/supabase/tests/00_supabase_stubs.sql" 2>/dev/null
for f in "$APP"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$APP/supabase/seed.sql"
"${PSQL[@]}" <<'SQL'
create role authenticator noinherit login;
grant anon, authenticated, service_role to authenticator;
insert into auth.users (id, phone) values ('11111111-1111-4111-8111-111111111111', '233241110001');
insert into auth.users (id, email) values
  ('22222222-2222-4222-8222-222222222222', 'esi@iries.test'),
  ('33333333-3333-4333-8333-333333333333', 'akua@iries.test'),
  ('44444444-4444-4444-8444-444444444444', 'kojo@iries.test'),
  ('55555555-5555-4555-8555-555555555555', 'owner@iries.test');
insert into public.staff (user_id, display_name, role) values
  ('22222222-2222-4222-8222-222222222222', 'Esi', 'attendant'),
  ('33333333-3333-4333-8333-333333333333', 'Akua', 'manager'),
  ('44444444-4444-4444-8444-444444444444', 'Kojo', 'kitchen'),
  ('55555555-5555-4555-8555-555555555555', 'Irie', 'owner');
SQL
cat > "$PGROOT/postgrest.conf" <<CONF
db-uri = "postgres://authenticator@/postgres?host=$SOCK&port=54329"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 3001
server-host = "127.0.0.1"
CONF
nohup "$POSTGREST_BIN" "$PGROOT/postgrest.conf" > "$PGROOT/postgrest.log" 2>&1 & echo $! > "$PGROOT/postgrest.pid"
E2E_PSQL="$PGBIN/psql" E2E_PGHOST="$SOCK" nohup node "$E2E/mock-gateway.mjs" > "$PGROOT/gateway.log" 2>&1 & echo $! > "$PGROOT/gateway.pid"
cd "$APP" && npx next build >/dev/null
nohup npx next start -p 3100 > "$PGROOT/next.log" 2>&1 & echo $! > "$PGROOT/next.pid"
for _ in $(seq 1 40); do curl -sf -o /dev/null http://localhost:3100/api/health && break; sleep 1; done
curl -s http://localhost:3100/api/health; echo
