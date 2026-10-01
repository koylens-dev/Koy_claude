#!/usr/bin/env bash
APP="$(cd "$(dirname "$0")/.." && pwd)"
PGROOT=$APP/.pgtest-e2e
for p in next gateway postgrest; do [ -f "$PGROOT/$p.pid" ] && kill "$(cat "$PGROOT/$p.pid")" 2>/dev/null; done
pkill -f "[n]ext-server" 2>/dev/null
PGBIN="$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")"
if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$PGBIN/pg_ctl" -D "$PGROOT/pgdata" -m immediate stop >/dev/null 2>&1
else "$PGBIN/pg_ctl" -D "$PGROOT/pgdata" -m immediate stop >/dev/null 2>&1; fi
echo stopped
