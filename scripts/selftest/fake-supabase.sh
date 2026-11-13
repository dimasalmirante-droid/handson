#!/usr/bin/env bash
# Stand-in for the Supabase CLI in the migration runner self-test: builds the
# "reference" database in a plain local Postgres instead of a Supabase stack.
set -euo pipefail
ADMIN_URL="${SELFTEST_ADMIN_URL:?}"
STUBS="$(dirname "$0")/supabase-stubs.sql"
case "${1:-}" in
  init)
    # Like the real CLI (v2.121.0): creates supabase/config.toml only, not
    # supabase/migrations/. SELFTEST_INIT_WITHOUT_MAJOR simulates a config
    # format without the major_version setting.
    mkdir -p supabase
    if [[ -n "${SELFTEST_INIT_WITHOUT_MAJOR:-}" ]]; then
      printf '[db]\nport = 54322\n' > supabase/config.toml
    else
      printf '[db]\nport = 54322\nmajor_version = 15\n' > supabase/config.toml
    fi
    ;;
  stop) ;;
  start)
    psql "$ADMIN_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists reference" -c "create database reference"
    ref="${ADMIN_URL%/*}/reference"
    psql "$ref" -X -q -v ON_ERROR_STOP=1 -f "$STUBS"
    for f in $(ls supabase/migrations/*.sql 2>/dev/null | sort); do psql "$ref" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$f" >/dev/null; done
    ;;
  *) echo "fake supabase: unsupported $*" >&2; exit 1 ;;
esac
