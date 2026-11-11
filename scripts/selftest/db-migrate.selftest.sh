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
  cp "$TMP/summary.md" "$TMP/last-summary.md"; : > "$TMP/summary.md"
}
history_count() { psql "$BASE/target" -X -At -c "select count(*) from supabase_migrations.schema_migrations" 2>/dev/null || echo 0; }
said() { if grep -qF -- "$2" "$TMP/last-summary.md"; then check "$1" yes yes; else check "$1" no yes; fi; }
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
# The only function with a multi-line string literal (dynamic SQL) is reported; nothing else differs.
run fail "verify reports the CRLF inside a string literal" ACTION=verify BASELINE="$BASELINE"
check "the only differing function is admin_set_record_verification" \
  "$(grep -E '^[-+]function\|' "$TMP/handson-db/reports/before.diff" | sed -E 's/^[-+]function\|([a-z_]+)\(.*/\1/' | sort -u | tr '\n' ' ')" \
  "admin_set_record_verification "
check "no other kind of object differs" \
  "$(grep -E '^[-+][a-z_]+\|' "$TMP/handson-db/reports/before.diff" | grep -cvE '^[-+]function\|admin_set_record_verification\(')" "0"

# Fingerprints of individual bodies (CR = \r, LF = \n; $q$ marks the SQL to create).
create() { # name, body format, literal (\r and \n are expanded in both)
  psql "$BASE/target" -X -q -v ON_ERROR_STOP=1 -c "create function public.$1() returns text language plpgsql as \$q\$$(printf "$2" "$(printf '%b' "${3:-}")")\$q\$"
}
create st_lf          'begin\n  return 1;\nend'
create st_crlf        'begin\r\n  return 1;\r\nend'
create st_lit_lf      'begin\n  return %s;\nend' "'a\nb'"
create st_lit_crlf    'begin\r\n  return %s;\r\nend' "'a\r\nb'"
create st_lit_lf_crlf 'begin\r\n  return %s;\r\nend' "'a\nb'"
create st_cmt_lf      "begin\n  -- don't change\n  return %s;\nend" "'a\nb'"
create st_cmt_crlf    "begin\r\n  -- don't change\r\n  return %s;\r\nend" "'a\r\nb'"
create st_dq_lf       'begin\n  return %s;\nend' "'x'::\"text\""
create st_dq_crlf     'begin\r\n  return %s;\r\nend' "'x'::\"text\""
create st_dollar_lf   'begin\n  return %s;\nend' '$x$a\nb$x$'
create st_dollar_crlf 'begin\r\n  return %s;\r\nend' '$x$a\nb$x$'
create st_cr          'begin\r  return 1;\rend'
create st_other       'begin\n  return 2;\nend'
f() { fingerprint "$1"; }
same() { if [[ -n "$(f "$2")" && "$(f "$2")" == "$(f "$3")" ]]; then check "$1" same same; else check "$1" different same; fi; }
differ() { if [[ -n "$(f "$2")" && "$(f "$2")" != "$(f "$3")" ]]; then check "$1" different different; else check "$1" same different; fi; }
same   "CRLF line endings in code match LF"                              st_lf st_crlf
differ "CRLF inside a string literal is a difference"                     st_lit_lf st_lit_crlf
same   "CRLF in code with an identical literal matches"                   st_lit_lf st_lit_lf_crlf
differ "an apostrophe in a -- comment does not hide a literal difference" st_cmt_lf st_cmt_crlf
same   "quoted identifiers are handled"                                   st_dq_lf st_dq_crlf
differ "bodies with inner dollar quotes are compared byte-for-byte"       st_dollar_lf st_dollar_crlf
differ "a lone CR is a difference"                                        st_lf st_cr
differ "different bodies have different fingerprints"                     st_lf st_other
psql "$BASE/target" -X -q -c "drop function public.st_lf(), public.st_crlf(), public.st_lit_lf(), public.st_lit_crlf(), public.st_lit_lf_crlf(), public.st_cmt_lf(), public.st_cmt_crlf(), public.st_dq_lf(), public.st_dq_crlf(), public.st_dollar_lf(), public.st_dollar_crlf(), public.st_cr(), public.st_other()"
psql "$BASE/target" -X -q -c "create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as \$\$ select true \$\$"
run fail "verify still detects a genuinely changed function" ACTION=verify BASELINE="$BASELINE"
check "the changed function is reported" "$(grep -cE '^[-+]function\|is_admin\(' "$TMP/handson-db/reports/before.diff")" "2"

echo "Accepted differences (production-like database at baseline 20261109000500)"
B5="20261109000500"
REAL="$ROOT/supabase/ops/accepted-differences.json"
variant() { jq "$2" "$REAL" > "$TMP/accepted-$1.json"; echo "$TMP/accepted-$1.json"; }
EMPTY="$TMP/accepted-empty.json"; echo '{"version": 1, "entries": []}' > "$EMPTY"
prod() { # expect, label, ACTION=…, accepted-differences file, more env…
  local expect="$1" label="$2" action="$3" file="$4"; shift 4
  run "$expect" "$label" TARGET=production "$action" ACCEPTED_DIFFERENCES_FILE="$file" "$@"
}
new_target; apply_manually "$B5" crlf
prod fail "without an accepted entry the difference fails" ACTION=verify "$EMPTY" BASELINE="$B5"
prod ok   "the exact approved difference passes" ACTION=verify "$REAL" BASELINE="$B5"
said      "it is reported as an accepted difference" "**Accepted difference** (before, from migration \`$B5\`)"
said      "the result says it is not identical" "identical apart from 1 accepted difference(s)"
prod fail "a different function-body hash fails" ACTION=verify "$(variant hash '.entries[0].found |= sub("body=[0-9a-f]+$"; "body=00000000000000000000000000000000")')" BASELINE="$B5"
said      "the mismatched entry is reported as stale" "**Stale accepted difference**"
prod fail "an entry for another target is not used" ACTION=verify "$(variant staging '.entries[0].target = "staging"')" BASELINE="$B5"
prod fail "an entry scoped to a later migration is not used" ACTION=verify "$(variant later '.entries[0].applies_from_baseline = "20261109000600"')" BASELINE="$B5"
said      "unused entries are reported" "Accepted differences not used in this comparison"
for bad in \
  'unknown-version|.entries[0].applies_from_baseline = "20261109000550"' \
  'missing-reason|del(.entries[0].reason)' \
  'short-reason|.entries[0].reason = "CRLF"' \
  'missing-approval|del(.entries[0].approved)' \
  'extra-field|.entries[0].note = "x"' \
  'bad-target|.entries[0].target = "prod"' \
  'identical|.entries[0].found = .entries[0].expected' \
  'other-object|.entries[0].found |= sub("admin_set_record_verification"; "admin_set_role")' \
  'multi-line|.entries[0].found += "\n+function|x()|body=1"' \
  'data-line|.entries[0].expected = "data|provinces|rows=11|fingerprint=x"' \
  'duplicate|.entries += [.entries[0]]' \
  'wrong-version|.version = 2'; do
  prod fail "malformed entry fails: ${bad%%|*}" ACTION=verify "$(variant "${bad%%|*}" "${bad#*|}")" BASELINE="$B5"
  said "malformed file reported: ${bad%%|*}" "accepted differences file is malformed"
done
printf '{"version": 1, "entries": [' > "$TMP/accepted-invalid.json"
prod fail "an invalid JSON file fails" ACTION=verify "$TMP/accepted-invalid.json" BASELINE="$B5"
prod fail "repair-history without the accepted entry fails" ACTION=repair-history "$EMPTY" CONFIRM=production BASELINE="$B5"
check "history unchanged" "$(history_count)" "0"
prod fail "repair-history with a malformed file fails" ACTION=repair-history "$TMP/accepted-identical.json" CONFIRM=production BASELINE="$B5"
check "history unchanged" "$(history_count)" "0"
prod ok   "repair-history with only the accepted difference" ACTION=repair-history "$REAL" CONFIRM=production BASELINE="$B5"
check "history records the five migrations" "$(history_count)" "5"
prod ok   "plan uses the accepted difference" ACTION=plan "$REAL"
prod ok   "apply: the final verification against every migration still uses it" ACTION=apply "$REAL" CONFIRM=production
said      "the final verification reports it" "**Accepted difference** (after, from migration \`$B5\`)"
check "history records every migration" "$(history_count)" "$TOTAL"

new_target; apply_manually "$B5" crlf
psql "$BASE/target" -X -q -c 'drop policy "Admins read consent history" on public.consent_records'
prod fail "an additional unrelated difference fails" ACTION=verify "$REAL" BASELINE="$B5"
said      "the accepted difference is still reported" "**Accepted difference**"
prod fail "repair-history with an additional difference fails" ACTION=repair-history "$REAL" CONFIRM=production BASELINE="$B5"
check "history unchanged" "$(history_count)" "0"

new_target; apply_manually "$B5" crlf
psql "$BASE/target" -X -q -c "create or replace function public.admin_set_record_verification(p_table text, p_id uuid, p_status public.verification_status, p_note text default null) returns void language plpgsql security definer set search_path = '' as \$\$ begin null; end \$\$"
prod fail "a changed production fingerprint fails" ACTION=verify "$REAL" BASELINE="$B5"
said      "the entry is reported as stale" "**Stale accepted difference**"

new_target; apply_manually "$B5"
prod fail "a stale entry fails when the difference no longer exists" ACTION=verify "$REAL" BASELINE="$B5"
said      "the stale entry is named" "Remove or update the entry"

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
