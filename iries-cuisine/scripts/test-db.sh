#!/usr/bin/env bash
# Spins up a throwaway local Postgres, applies the Supabase migrations + seed on top
# of minimal Supabase stand-ins, then runs the SQL test suite.
# Requires Postgres 15+ binaries (initdb, pg_ctl, psql) on PATH or in /usr/lib/postgresql/*/bin.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DATA="$ROOT/.pgtest/data"
SOCK="$ROOT/.pgtest"
PORT=54329

cleanup() { "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$ROOT/.pgtest" && mkdir -p "$SOCK"
RUN_AS=""
if [ "$(id -u)" = "0" ]; then
  # Postgres refuses to run as root; use the 'postgres' OS user if present.
  id postgres >/dev/null 2>&1 || useradd -r postgres
  chown -R postgres "$ROOT/.pgtest"
  RUN_AS="runuser -u postgres --"
fi

$RUN_AS "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
$RUN_AS "$PGBIN/pg_ctl" -D "$DATA" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$ROOT/.pgtest/log" start >/dev/null

PSQL=("$PGBIN/psql" -h "$SOCK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "→ seed"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"

for t in "$ROOT"/supabase/tests/*.test.sql; do
  echo "→ test $(basename "$t")"
  "${PSQL[@]}" -o /dev/null -f "$t" 2>&1 | sed 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /'
done
