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
#   (Tests only: MIGRATIONS_DIR, SUPABASE_BIN, REFERENCE_DB_URL,
#   ACCEPTED_DIFFERENCES_FILE and CATALOGUE_FILE override the defaults.)
#
# Accepted differences (supabase/ops/accepted-differences.json) are reviewed
# exceptions pinned to exact catalogue lines. An entry is used only for its
# target and only when the reference includes its `applies_from_baseline`
# migration. Used entries are always reported. Verification fails on any
# other difference, on an entry whose exact difference is not present (stale
# or changed), and on a malformed file.
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
CATALOGUE="${CATALOGUE_FILE:-$ROOT/supabase/ops/catalogue.sql}"
ACCEPTED_FILE="${ACCEPTED_DIFFERENCES_FILE:-$ROOT/supabase/ops/accepted-differences.json}"
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

# ---------------------------------------------------------------------------
# Accepted differences: validate the whole file before anything else
# ---------------------------------------------------------------------------
command -v jq >/dev/null || fail "jq is required"
if [[ ! -f "$ACCEPTED_FILE" ]]; then
  ACCEPTED_FILE="$WORK/no-accepted-differences.json"
  echo '{"version": 1, "entries": []}' > "$ACCEPTED_FILE"
fi
read -r -d '' VALIDATE_ACCEPTED <<'JQ' || true
  def fields: ["target", "applies_from_baseline", "expected", "found", "reason", "approval"];
  # The object a catalogue line describes: its fields up to the first key=value.
  def identity: split("|") | until(length == 0 or (.[-1] | test("=") | not); .[:-1]) | join("|");
  def catalogue_line: type == "string" and test("^[a-z_]+\\|[^\\r\\n]+$") and (startswith("data|") | not);
  if type != "object" then "the file must contain a JSON object"
  elif .version != 1 then "\"version\" must be 1"
  elif (.entries | type) != "array" then "\"entries\" must be a list"
  else
    (.entries | to_entries[] | .key as $i | .value as $e | "entry \($i + 1)" as $n |
      if ($e | type) != "object" then "\($n): must be an object"
      elif (($e | keys) - fields) != [] then "\($n): unknown field(s): \((($e | keys) - fields) | join(", "))"
      elif (fields - ($e | keys)) != [] then "\($n): missing field(s): \((fields - ($e | keys)) | join(", "))"
      elif ($e.target | IN("staging", "production") | not) then "\($n): target must be staging or production"
      elif ($e.applies_from_baseline | type) != "string" or ($e.applies_from_baseline | IN($repo[]) | not) then "\($n): applies_from_baseline must be a migration version in the repository"
      elif ($e.expected | catalogue_line | not) then "\($n): expected must be one schema catalogue line"
      elif ($e.found | catalogue_line | not) then "\($n): found must be one schema catalogue line"
      elif $e.expected == $e.found then "\($n): expected and found are identical"
      elif ($e.expected | identity) != ($e.found | identity) then "\($n): expected and found describe different objects"
      elif ($e.reason | type) != "string" or ($e.reason | length) < 40 then "\($n): reason must explain the difference (at least 40 characters)"
      elif ($e.approval | type) != "string" or ($e.approval | length) < 40 then "\($n): approval must say how the entry is approved (at least 40 characters)"
      else empty end),
    (.entries | group_by([.target, .expected]) | map(select(length > 1))[] | "duplicate entries for \(.[0].target): \(.[0].expected)"),
    (.entries | group_by([.target, .found]) | map(select(length > 1))[] | "duplicate entries for \(.[0].target): \(.[0].found)")
  end
JQ
REPO_JSON="$(printf '%s\n' "${REPO[@]}" | jq -R . | jq -cs .)"
ACCEPTED_PROBLEMS="$(jq -r --argjson repo "$REPO_JSON" "$VALIDATE_ACCEPTED" "$ACCEPTED_FILE" 2>&1)" \
  || fail "The accepted differences file is not valid JSON: $ACCEPTED_PROBLEMS"
if [[ -n "$ACCEPTED_PROBLEMS" ]]; then
  summary "- Accepted differences file is malformed:"
  while IFS= read -r problem; do summary "  - $problem"; done <<< "$ACCEPTED_PROBLEMS"
  fail "The accepted differences file is malformed. Nothing was changed."
fi

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
  # The CLI's init creates supabase/config.toml but not supabase/migrations/.
  mkdir -p "$dir/supabase/migrations"
  # The reference must use the same Postgres major version as the target.
  grep -qE '^major_version = [0-9]+$' "$dir/supabase/config.toml" \
    || fail "Unexpected Supabase CLI config: no major_version setting. Nothing was changed by this step."
  sed -i -E "s/^major_version = [0-9]+$/major_version = ${MAJOR}/" "$dir/supabase/config.toml"
  for v in "$@"; do cp "$(file_for "$v")" "$dir/supabase/migrations/"; done
  local copied
  copied="$(find "$dir/supabase/migrations" -maxdepth 1 -name '*.sql' | wc -l | tr -d ' ')"
  [[ "$copied" == "$#" ]] || fail "Reference database setup copied $copied of $# migration file(s)."
  (cd "$dir" && "$SUPABASE" start -x realtime,studio,imgproxy,edge-runtime,logflare,vector,postgres-meta,supavisor >/dev/null)
}

# Catalogue lines are sorted here in byte order (LC_ALL=C), whatever order the
# query returns them in; compare() relies on that and checks it.
run_catalogue() { # $1 = url, $2 = output prefix
  psql "$1" -X -q -At -v ON_ERROR_STOP=1 -f "$CATALOGUE" > "$REPORTS/$2.raw.txt"
  LC_ALL=C sort "$REPORTS/$2.raw.txt" > "$REPORTS/$2.all.txt"
  { grep -v '^data|' "$REPORTS/$2.all.txt" || true; } > "$REPORTS/$2.schema.txt"
  { grep '^data|' "$REPORTS/$2.all.txt" || true; } > "$REPORTS/$2.data.txt"
}

compare() { # $1 = label, then the reference's migration versions
  local label="$1"; shift
  local ref_last="${*: -1}"
  local removed="$REPORTS/$label.removed" added="$REPORTS/$label.added" tmp="$REPORTS/$label.tmp"
  # comm needs both inputs in the same byte order: sort them here (independently
  # of run_catalogue) and let comm verify it.
  LC_ALL=C sort -o "$REPORTS/reference.schema.txt" "$REPORTS/reference.schema.txt"
  LC_ALL=C sort -o "$REPORTS/target.schema.txt" "$REPORTS/target.schema.txt"
  LC_ALL=C comm --check-order -23 "$REPORTS/reference.schema.txt" "$REPORTS/target.schema.txt" > "$removed" \
    || fail "Internal error: the schema comparison inputs are not sorted. Nothing was changed."
  LC_ALL=C comm --check-order -13 "$REPORTS/reference.schema.txt" "$REPORTS/target.schema.txt" > "$added" \
    || fail "Internal error: the schema comparison inputs are not sorted. Nothing was changed."

  # Entries for this target whose migration is part of this reference.
  local used=0 stale=0 entry expected found from reason approval
  while IFS= read -r entry; do
    expected="$(jq -r .expected <<< "$entry")"; found="$(jq -r .found <<< "$entry")"
    from="$(jq -r .applies_from_baseline <<< "$entry")"; reason="$(jq -r .reason <<< "$entry")"
    approval="$(jq -r .approval <<< "$entry")"
    if grep -Fxq -- "$expected" "$removed" && grep -Fxq -- "$found" "$added"; then
      used=$((used + 1))
      { grep -Fxv -- "$expected" "$removed" || true; } > "$tmp" && mv "$tmp" "$removed"
      { grep -Fxv -- "$found" "$added" || true; } > "$tmp" && mv "$tmp" "$added"
      summary "- **Accepted difference** ($label, from migration \`$from\`): $reason"
      summary "  - Approval: $approval"
      summary "  - Expected: \`$expected\`"
      summary "  - Found: \`$found\`"
    else
      stale=$((stale + 1))
      local why="the database no longer shows exactly this difference"
      grep -Fxq -- "$expected" "$REPORTS/reference.schema.txt" || why="the reference no longer contains the expected line"
      grep -Fxq -- "$expected" "$REPORTS/reference.schema.txt" && ! grep -Fxq -- "$found" "$REPORTS/target.schema.txt" \
        && why="the database no longer contains the accepted line (its fingerprint changed or the difference was fixed)"
      summary "- **Stale accepted difference** ($label): $why. Remove or update the entry for \`$expected\`."
    fi
  done < <(jq -c --arg t "$TARGET" --arg last "$ref_last" \
             '.entries[] | select(.target == $t and $last != "" and .applies_from_baseline <= $last)' "$ACCEPTED_FILE")

  local out_of_scope
  out_of_scope="$(jq -r --arg t "$TARGET" --arg last "$ref_last" \
    '[.entries[] | select(.target != $t or $last == "" or .applies_from_baseline > $last)] | length' "$ACCEPTED_FILE")"
  (( out_of_scope == 0 )) || summary "- Accepted differences not used in this comparison (other target or later migration): $out_of_scope."

  { sed 's/^/-/' "$removed"; sed 's/^/+/' "$added"; } > "$REPORTS/$label.diff"
  if [[ ! -s "$REPORTS/$label.diff" ]] && (( stale == 0 )); then
    if (( used > 0 )); then
      summary "- Schema comparison ($label): **identical apart from $used accepted difference(s)** ($(wc -l < "$REPORTS/target.schema.txt") objects checked)."
    else
      summary "- Schema comparison ($label): **identical** ($(wc -l < "$REPORTS/target.schema.txt") objects checked)."
    fi
    return 0
  fi
  if [[ -s "$REPORTS/$label.diff" ]]; then
    summary "- Schema comparison ($label): **differences found** (\`-\` expected from migrations, \`+\` found in the database):"
    summary ""
    summary '```diff'
    head -n 200 "$REPORTS/$label.diff" >> "$SUMMARY"
    summary '```'
  fi
  return 1
}

verify_against() { # $1 = label, then versions
  local label="$1"; shift
  log "Building reference database from $# migration(s)…"
  build_reference "$@"
  run_catalogue "$LOCAL_DB_URL" reference
  run_catalogue "$TARGET_DB_URL" target
  if ! diff -q <(LC_ALL=C sort "$REPORTS/reference.data.txt") <(LC_ALL=C sort "$REPORTS/target.data.txt") >/dev/null; then
    summary "- Reference data differs from the seed (expected when administrators add catalogue entries; not a schema problem)."
  fi
  compare "$label" "$@"
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
    if (( ${#APPLIED[@]} == 0 )) && [[ -n "$BASELINE" ]]; then
      fail "This target has objects but no migration history. Run repair-history first."
    fi
    if (( ${#PENDING[@]} == 0 )); then summary ""; summary "Nothing to apply."; exit 0; fi
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
