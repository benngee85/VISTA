#!/bin/zsh
set -euo pipefail
unsetopt BANG_HIST 2>/dev/null || true

SCRIPT_DIR=${0:A:h}
source "${SCRIPT_DIR}/lib/vista-ops.zsh"
cd "$VISTA_REPO_ROOT"

[[ "${1:-}" == "--apply" ]] || {
  print -u2 -- "Usage: $0 --apply FINDING-ID [FINDING-ID ...]"
  exit 2
}
shift

(( $# > 0 )) || {
  print -u2 -- "No remediation identifiers supplied"
  exit 2
}

BACKUP_DIR="${VISTA_REPO_ROOT}/../vista-remediation-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp scripts/run-seeders.sh "$BACKUP_DIR/run-seeders.sh"
[[ -f .secrets/runtime.env ]] &&
  cp .secrets/runtime.env "$BACKUP_DIR/runtime.env"
chmod -R go-rwx "$BACKUP_DIR"

for finding in "$@"; do
  case "$finding" in
    HOST-CACHE-001)
      python3 - <<'PY'
from pathlib import Path
import re

path = Path("scripts/run-seeders.sh")
text = path.read_text()
if "# VISTA_HOST_CACHE_SCOPE" not in text:
    block = r'''
# VISTA_HOST_CACHE_SCOPE
# Host-side seeders cannot resolve Compose-only service names. Keep this
# override separate from the container CACHE_REST_URL.
VISTA_HOST_CACHE_REST_URL="${VISTA_HOST_CACHE_REST_URL:-http://localhost:8079}"
export CACHE_REST_URL="$VISTA_HOST_CACHE_REST_URL"
export REDIS_REST_URL="$VISTA_HOST_CACHE_REST_URL"
export UPSTASH_REDIS_REST_URL="$VISTA_HOST_CACHE_REST_URL"
'''
    anchors = (
        re.compile(r"^ok=0\s*$", re.MULTILINE),
        re.compile(r"^for\s+f\s+in\b", re.MULTILINE),
    )
    for anchor in anchors:
        match = anchor.search(text)
        if match:
            text = text[:match.start()] + block + "\n" + text[match.start():]
            break
    else:
        raise SystemExit("FAIL: safe seeder execution anchor not found")
path.write_text(text)
print("PASS: host seeders now target localhost:8079 by default")
PY
      ;;

    SEED-EXIT-001)
      if ! grep -Fq '# VISTA_AGGREGATE_EXIT' scripts/run-seeders.sh; then
        cat >> scripts/run-seeders.sh <<'SH'

# VISTA_AGGREGATE_EXIT
# A complete run must not report success when one or more seeders failed or
# exceeded their execution budget.
if [ "$fail" -gt 0 ] || [ "$timedout" -gt 0 ]; then
  exit 1
fi
SH
      fi
      print -r -- "PASS: seeder aggregate failures now propagate"
      ;;

    SEED-SECRET-001)
      set -a
      source ./.env
      source ./.secrets/runtime.env
      set +a
      if [[ -z "${WORLDMONITOR_SEED_REFRESH_KEY:-}" ]]; then
        value=$(openssl rand -hex 32)
        print -r -- "WORLDMONITOR_SEED_REFRESH_KEY=${value}" \
          >> .secrets/runtime.env
        chmod 600 .secrets/runtime.env
      fi
      print -r -- "PASS: seeder refresh credential is present"
      ;;

    SEED-LOGGING-001)
      python3 - <<'PY'
from pathlib import Path

path = Path("scripts/run-seeders.sh")
text = path.read_text()
if "VISTA_SEED_LOG_DIR" not in text:
    anchor = 'output=$(run_seed "$f")'
    if anchor not in text:
        raise SystemExit("FAIL: seeder output capture anchor not found")
    block = '''output=$(run_seed "$f")

  # VISTA_SEED_LOG_DIR
  # Preserve complete output so aggregation cannot hide the actual exception.
  if [ -n "${VISTA_SEED_LOG_DIR:-}" ]; then
    umask 077
    mkdir -p "$VISTA_SEED_LOG_DIR"
    seed_log_name=$(basename "$f" .mjs)
    printf '%s\\n' "$output" >"$VISTA_SEED_LOG_DIR/${seed_log_name}.log"
  fi'''
    text = text.replace(anchor, block, 1)
path.write_text(text)
print("PASS: protected per-seeder logging is available")
PY
      ;;

    *)
      print -u2 -- "REFUSED unknown remediation: $finding"
      exit 2
      ;;
  esac
done

sh -n scripts/run-seeders.sh
git diff --check

print -r -- "Backup: $BACKUP_DIR"
print -r -- "Running post-remediation doctor"
exec scripts/vista-doctor.zsh --post-remediation
