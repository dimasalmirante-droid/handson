#!/usr/bin/env bash
# Stand-in for the Supabase CLI in the migration runner self-test: builds the
# "reference" database in a plain local Postgres instead of a Supabase stack.
set -euo pipefail
ADMIN_URL="${SELFTEST_ADMIN_URL:?}"
STUBS="$(dirname "$0")/supabase-stubs.sql"
case "${1:-}" in
  init) mkdir -p supabase/migrations && echo "[db]
major_version = 15" > supabase/config.toml ;;
  stop) ;;
  start)
    psql "$ADMIN_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists reference" -c "create database reference"
    ref="${ADMIN_URL%/*}/reference"
    psql "$ref" -X -q -v ON_ERROR_STOP=1 -f "$STUBS"
    for f in $(ls supabase/migrations/*.sql 2>/dev/null | sort); do psql "$ref" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$f" >/dev/null; done
    ;;
  *) echo "fake supabase: unsupported $*" >&2; exit 1 ;;
esac
