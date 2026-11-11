#!/usr/bin/env bash
# Self-test for scripts/db-migrate.sh against a throwaway local Postgres.
# Exercises every safeguard: verify, plan, refusal on drift or inconsistent
# history, repair-history, apply with per-migration transactions, and the
# post-apply verification. Needs psql and a Postgres the test may create
# databases in:  SELFTEST_ADMIN_URL=postgresql://postgres@127.0.0.1:54322/postgres
set -uo pipefail
ADMIN_URL="${SELFTEST_ADMIN_URL:?set SELFTEST_ADMIN_URL}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
RUNNER="$ROOT/scripts/db-migrate.sh"
BASE="${ADMIN_URL%/*}"
TMP="$(mktemp -d)"
export SUPABASE_BIN="$HERE/fake-supabase.sh" SELFTEST_ADMIN_URL="$ADMIN_URL" REFERENCE_DB_URL="$BASE/reference" RUNNER_TEMP="$TMP"
BASELINE="20261109000600"
pass=0; failed=0

new_target() {
  psql "$ADMIN_URL" -X -q -c "drop database if exists target" -c "create database target"
  psql "$BASE/target" -X -q -v ON_ERROR_STOP=1 -f "$HERE/supabase-stubs.sql"
}
apply_manually() { # versions up to $1, the way the SQL Editor did (no history); $2 = crlf to use Windows line endings
  for f in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
    v="$(basename "$f" | cut -c1-14)"; [[ "$v" > "$1" ]] && break
    if [[ "${2:-}" == "crlf" ]]; then
      sed 's/$/\r/' "$f" > "$TMP/crlf.sql"
      psql "$BASE/target" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$TMP/crlf.sql" >/dev/null
    else
      psql "$BASE/target" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$f" >/dev/null
    fi
  done
}
fingerprint() { # body fingerprint of public.$1 as reported by the catalogue
  psql "$BASE/target" -X -q -At -f "$ROOT/supabase/ops/catalogue.sql" | grep "^function|$1(" | sed -E 's/.*\|body=//'
}
run() { # expect(ok|fail) label env...
  local expect="$1" label="$2"; shift 2
  local out; out="$(env TARGET_DB_URL="$BASE/target" TARGET=staging GITHUB_STEP_SUMMARY="$TMP/summary.md" "$@" "$RUNNER" 2>&1)"; local rc=$?
  if [[ ( "$expect" == ok && $rc -eq 0 ) || ( "$expect" == fail && $rc -ne 0 ) ]]; then
    pass=$((pass + 1)); echo "  ✓ $label"
  else
    failed=$((failed + 1)); echo "  ✗ $label (exit $rc)"; echo "$out" | tail -20; tail -30 "$TMP/summary.md"
  fi
  : > "$TMP/summary.md"
}
history_count() { psql "$BASE/target" -X -At -c "select count(*) from supabase_migrations.schema_migrations" 2>/dev/null || echo 0; }
check() { if [[ "$2" == "$3" ]]; then pass=$((pass + 1)); echo "  ✓ $1"; else failed=$((failed + 1)); echo "  ✗ $1: expected '$3', got '$2'"; fi; }
TOTAL="$(ls "$ROOT"/supabase/migrations/*.sql | wc -l | tr -d ' ')"

echo "Fresh staging database"
new_target
run ok   "verify with no history and no baseline" ACTION=verify
run fail "apply without typing the target name" ACTION=apply CONFIRM=production
run ok   "apply everything" ACTION=apply CONFIRM=staging
check "history records every migration" "$(history_count)" "$TOTAL"
run ok   "verify after apply" ACTION=verify
run ok   "apply again does nothing" ACTION=apply CONFIRM=staging

echo "Reference database setup"
run ok   "reference is built with the migrations copied in (CLI init creates no migrations folder)" ACTION=verify
run fail "a CLI config without major_version stops the run" ACTION=verify SELFTEST_INIT_WITHOUT_MAJOR=1
check "history unchanged by the failed run" "$(history_count)" "$TOTAL"

echo "Production-like database (six migrations run in the SQL Editor, no history)"
new_target; apply_manually "$BASELINE"
psql "$BASE/target" -X -q -c "insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ('00000000-0000-4000-8000-000000000001', 'a@example.com', now(), '{\"terms_version\":\"draft-2026-11\"}')"
run ok   "verify against the baseline" ACTION=verify BASELINE="$BASELINE"
run fail "verify against a wrong baseline" ACTION=verify BASELINE=20261109000500
run fail "apply before history is recorded" ACTION=apply CONFIRM=staging BASELINE="$BASELINE"
run fail "repair-history without confirmation" ACTION=repair-history BASELINE="$BASELINE"
run ok   "repair-history" ACTION=repair-history CONFIRM=staging BASELINE="$BASELINE"
check "history records the six migrations" "$(history_count)" "6"
run fail "repair-history again is refused" ACTION=repair-history CONFIRM=staging BASELINE="$BASELINE"
run ok   "plan" ACTION=plan
run ok   "apply the pending migrations" ACTION=apply CONFIRM=staging
check "history records every migration" "$(history_count)" "$TOTAL"
if [[ "$(psql "$BASE/target" -X -At -c "select to_regclass('public.accounts') is not null")" == "t" ]]; then
  check "existing account received an accounts record" "$(psql "$BASE/target" -X -At -c "select count(*) from public.accounts")" "1"
fi

echo "Windows line endings (migrations pasted with CRLF, as in production)"
new_target; apply_manually "$BASELINE" crlf
check "function bodies are stored with CRLF" "$(psql "$BASE/target" -X -At -c "select bool_or(prosrc like E'%\r\n%') from pg_proc where pronamespace = 'public'::regnamespace")" "t"
run ok   "verify matches the LF reference" ACTION=verify BASELINE="$BASELINE"
psql "$BASE/target" -X -q -c "create function public.selftest_lf() returns int language sql as \$\$ select 1;
select 2 \$\$" -c "create function public.selftest_crlf() returns int language sql as \$\$ select 1;$(printf '\r')
select 2 \$\$" -c "create function public.selftest_cr() returns int language sql as \$\$ select 1;$(printf '\r')select 2 \$\$" -c "create function public.selftest_other() returns int language sql as \$\$ select 1;
select 3 \$\$"
lf="$(fingerprint selftest_lf)"
check "LF and CRLF bodies have the same fingerprint" "$(fingerprint selftest_crlf)" "$lf"
check "LF and CR bodies have the same fingerprint" "$(fingerprint selftest_cr)" "$lf"
if [[ -n "$lf" && "$(fingerprint selftest_other)" != "$lf" ]]; then check "different bodies have different fingerprints" ok ok; else check "different bodies have different fingerprints" same different; fi
psql "$BASE/target" -X -q -c "drop function public.selftest_lf(), public.selftest_crlf(), public.selftest_cr(), public.selftest_other()"
psql "$BASE/target" -X -q -c "create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as \$\$ select true \$\$"
run fail "verify still detects a genuinely changed function" ACTION=verify BASELINE="$BASELINE"

echo "Drift and inconsistent history are refused"
new_target; apply_manually "$BASELINE"
psql "$BASE/target" -X -q -c 'drop policy "Admins read consent history" on public.consent_records'
run fail "verify detects a dropped policy" ACTION=verify BASELINE="$BASELINE"
run fail "repair-history refuses when the schema differs" ACTION=repair-history CONFIRM=staging BASELINE="$BASELINE"
check "history unchanged" "$(history_count)" "0"
new_target; apply_manually "$BASELINE"
run ok   "repair-history" ACTION=repair-history CONFIRM=staging BASELINE="$BASELINE"
psql "$BASE/target" -X -q -c "insert into supabase_migrations.schema_migrations (version, name) values ('20261109000700', 'unknown')"
run fail "unknown version in history" ACTION=plan
psql "$BASE/target" -X -q -c "delete from supabase_migrations.schema_migrations where version in ('20261109000700', '20261109000300')"
run fail "gap in history" ACTION=plan

echo "A failing migration is rolled back and stops the run"
new_target
MIG="$TMP/migrations"; mkdir -p "$MIG"; cp "$ROOT"/supabase/migrations/*.sql "$MIG/"
printf 'create table public.half_done (id int);\nselect 1/0;\n' > "$MIG/20991231000000_broken.sql"
run fail "apply stops at the broken migration" ACTION=apply CONFIRM=staging MIGRATIONS_DIR="$MIG"
check "everything before it is applied and recorded" "$(history_count)" "$TOTAL"
check "nothing from the broken migration remains" "$(psql "$BASE/target" -X -At -c "select to_regclass('public.half_done') is null")" "t"

psql "$ADMIN_URL" -X -q -c "drop database if exists target" -c "drop database if exists reference"
rm -rf "$TMP"
echo
echo "$pass passed, $failed failed"
[[ $failed -eq 0 ]]
