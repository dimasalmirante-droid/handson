#!/usr/bin/env bash
# Handson · database migration runner (used by .github/workflows/db-migrate.yml)
#
# Actions
#   verify          Read-only. Builds a reference database from the migrations
#                   the target's history says are applied (or, before history
#                   exists, up to BASELINE) and compares the target's schema
#                   catalogue with it. Fails on any difference.
#   plan            verify + lists the migrations that `apply` would run.
#   repair-history  verify (against BASELINE) + records those migrations as
#                   applied in the target's migration history. Runs nothing else.
#                   Only when the history is empty.
#   apply           verify + plan, then applies each pending migration in its
#                   own transaction together with its history entry, then
#                   verifies the result against a reference with every
#                   migration applied.
#
# Environment
#   TARGET_DB_URL   Connection string (secret; never printed)
#   TARGET          staging | production (for messages)
#   ACTION          verify | plan | repair-history | apply
#   BASELINE        Optional version (e.g. 20261109000600); only used while
#                   the target has no migration history.
#   CONFIRM         Must equal TARGET for repair-history and apply.
#   (Tests only: MIGRATIONS_DIR, SUPABASE_BIN, REFERENCE_DB_URL override the defaults.)
#
# Nothing is ever reconciled automatically: any difference stops the run.

set -euo pipefail

: "${TARGET_DB_URL:?TARGET_DB_URL is required}"
: "${TARGET:?TARGET is required}"
: "${ACTION:?ACTION is required}"
BASELINE="${BASELINE:-}"
CONFIRM="${CONFIRM:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="${MIGRATIONS_DIR:-$ROOT/supabase/migrations}"
SUPABASE="${SUPABASE_BIN:-supabase}"
CATALOGUE="$ROOT/supabase/ops/catalogue.sql"
WORK="${RUNNER_TEMP:-/tmp}/handson-db"
REPORTS="$WORK/reports"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
LOCAL_DB_URL="${REFERENCE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
mkdir -p "$REPORTS"

log() { printf '%s\n' "$*"; }
summary() { printf '%s\n' "$*" >> "$SUMMARY"; }
fail() { log "::error::$*"; summary "**Stopped:** $*"; exit 1; }

target_psql() { psql "$TARGET_DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }
target_query() { target_psql -At -c "set default_transaction_read_only = on" -c "$1"; }

case "$ACTION" in verify|plan|repair-history|apply) ;; *) fail "Unknown action '$ACTION'";; esac
if [[ "$ACTION" == "repair-history" || "$ACTION" == "apply" ]] && [[ "$CONFIRM" != "$TARGET" ]]; then
  fail "Type the target name ('$TARGET') in the confirmation field to run '$ACTION'."
fi
if [[ -n "$BASELINE" && ! "$BASELINE" =~ ^[0-9]{14}$ ]]; then fail "BASELINE must be a 14-digit migration version"; fi

summary "## Database ${ACTION} — ${TARGET}"
summary ""

# ---------------------------------------------------------------------------
# Repository migrations and the target's history
# ---------------------------------------------------------------------------
mapfile -t REPO < <(cd "$MIGRATIONS" && ls -1 *.sql | sort | sed -E 's/^([0-9]{14})_.*/\1/')
file_for() { ls -1 "$MIGRATIONS"/"$1"_*.sql; }

HAS_HISTORY="$(target_query "select to_regclass('supabase_migrations.schema_migrations') is not null")"
APPLIED=()
if [[ "$HAS_HISTORY" == "t" ]]; then
  mapfile -t APPLIED < <(target_query "select version from supabase_migrations.schema_migrations order by version")
fi

# History must be exactly the first N repository migrations, in order.
for i in "${!APPLIED[@]}"; do
  if [[ "${REPO[$i]:-}" != "${APPLIED[$i]}" ]]; then
    fail "Migration history is inconsistent with the repository: position $((i + 1)) is '${APPLIED[$i]}' in the database but '${REPO[$i]:-none}' in the repository. Nothing was changed."
  fi
done

if (( ${#APPLIED[@]} > 0 )); then
  [[ -z "$BASELINE" ]] || fail "BASELINE is only used while the migration history is empty; this target already has a history."
  BASE=("${APPLIED[@]}")
  summary "- Migration history: ${#APPLIED[@]} applied, last \`${APPLIED[${#APPLIED[@]}-1]}\`"
elif [[ -n "$BASELINE" ]]; then
  BASE=()
  for v in "${REPO[@]}"; do [[ "$v" > "$BASELINE" ]] || BASE+=("$v"); done
  (( ${#BASE[@]} > 0 )) && [[ "${BASE[${#BASE[@]}-1]}" == "$BASELINE" ]] || fail "BASELINE $BASELINE is not a migration in the repository."
  summary "- Migration history: empty. Comparing with the repository up to \`$BASELINE\` (${#BASE[@]} migrations)."
else
  BASE=()
  summary "- Migration history: empty. Expecting a database with none of the repository migrations."
fi

PENDING=()
for v in "${REPO[@]:${#BASE[@]}}"; do PENDING+=("$v"); done

# ---------------------------------------------------------------------------
# Reference database built from migration files (local Supabase stack)
# ---------------------------------------------------------------------------
MAJOR="$(target_query "select current_setting('server_version_num')::int / 10000")"
build_reference() {
  local dir="$WORK/reference"
  (cd "$dir" 2>/dev/null && "$SUPABASE" stop --no-backup >/dev/null 2>&1) || true
  rm -rf "$dir" && mkdir -p "$dir"
  (cd "$dir" && "$SUPABASE" init --force >/dev/null)
  sed -i -E "s/^major_version = [0-9]+/major_version = ${MAJOR}/" "$dir/supabase/config.toml"
  for v in "$@"; do cp "$(file_for "$v")" "$dir/supabase/migrations/"; done
  (cd "$dir" && "$SUPABASE" start -x realtime,studio,imgproxy,edge-runtime,logflare,vector,postgres-meta,supavisor >/dev/null)
}

run_catalogue() { # $1 = url, $2 = output prefix
  psql "$1" -X -q -At -v ON_ERROR_STOP=1 -f "$CATALOGUE" | LC_ALL=C sort > "$REPORTS/$2.all.txt"
  grep -v '^data|' "$REPORTS/$2.all.txt" > "$REPORTS/$2.schema.txt" || true
  grep '^data|' "$REPORTS/$2.all.txt" > "$REPORTS/$2.data.txt" || true
}

compare() { # $1 = label
  local diff_file="$REPORTS/$1.diff"
  if diff -u "$REPORTS/reference.schema.txt" "$REPORTS/target.schema.txt" > "$diff_file"; then
    summary "- Schema comparison ($1): **identical** ($(wc -l < "$REPORTS/target.schema.txt") objects checked)."
    return 0
  fi
  summary "- Schema comparison ($1): **differences found** (\`-\` expected from migrations, \`+\` found in the database):"
  summary ""
  summary '```diff'
  head -n 200 "$diff_file" >> "$SUMMARY"
  summary '```'
  return 1
}

verify_against() { # $1 = label, then versions
  local label="$1"; shift
  log "Building reference database from $# migration(s)…"
  build_reference "$@"
  run_catalogue "$LOCAL_DB_URL" reference
  run_catalogue "$TARGET_DB_URL" target
  if ! diff -q "$REPORTS/reference.data.txt" "$REPORTS/target.data.txt" >/dev/null; then
    summary "- Reference data differs from the seed (expected when administrators add catalogue entries; not a schema problem)."
  fi
  compare "$label"
}

verify_against "before" "${BASE[@]}" || fail "The ${TARGET} database does not match the verified baseline. Nothing was changed. Review the differences and agree a reconciliation before trying again."

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------
summary ""
if (( ${#PENDING[@]} == 0 )); then
  summary "- Pending migrations: none."
else
  summary "- Pending migrations (${#PENDING[@]}):"
  for v in "${PENDING[@]}"; do summary "  - \`$(basename "$(file_for "$v")")\`"; done
fi

case "$ACTION" in
  verify|plan)
    summary ""
    summary "Read-only run: nothing was changed."
    ;;

  repair-history)
    (( ${#APPLIED[@]} == 0 )) || fail "repair-history is only for a target with an empty history."
    [[ -n "$BASELINE" ]] || fail "repair-history needs BASELINE (the last migration already present in the database)."
    {
      echo "create schema if not exists supabase_migrations;"
      echo "create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);"
      for v in "${BASE[@]}"; do
        name="$(basename "$(file_for "$v")" .sql)"; name="${name#*_}"
        echo "insert into supabase_migrations.schema_migrations (version, name, statements) values ('$v', '$name', '{}');"
      done
    } > "$WORK/repair.sql"
    target_psql --single-transaction -f "$WORK/repair.sql"
    summary ""
    summary "Recorded ${#BASE[@]} migration(s) as already applied (history only; no migration was run)."
    ;;

  apply)
    if (( ${#PENDING[@]} == 0 )); then summary ""; summary "Nothing to apply."; exit 0; fi
    if (( ${#APPLIED[@]} == 0 )) && [[ -n "$BASELINE" ]]; then
      fail "This target has objects but no migration history. Run repair-history first."
    fi
    target_psql -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);"
    for v in "${PENDING[@]}"; do
      file="$(file_for "$v")"; name="$(basename "$file" .sql)"; name="${name#*_}"
      if grep -q '\$hs_migration\$' "$file"; then fail "$file contains the reserved quoting tag \$hs_migration\$"; fi
      {
        cat "$file"
        printf '\ninsert into supabase_migrations.schema_migrations (version, name, statements) values (%s, %s, array[$hs_migration$%s$hs_migration$]);\n' \
          "'$v'" "'$name'" "$(cat "$file")"
      } > "$WORK/apply-$v.sql"
      log "Applying $name…"
      target_psql --single-transaction -f "$WORK/apply-$v.sql" || fail "$name failed and was rolled back. Migrations before it remain applied; see the log."
      summary "  - applied \`$name\`"
    done
    verify_against "after" "${REPO[@]}" || fail "Applied, but the result differs from a reference built from all migrations. Investigate before deploying."
    summary ""
    summary "All pending migrations applied and verified."
    ;;
esac
