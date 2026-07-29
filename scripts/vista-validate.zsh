#!/bin/zsh
set -u
set -o pipefail
unsetopt BANG_HIST 2>/dev/null || true

SCRIPT_DIR=${0:A:h}
source "${SCRIPT_DIR}/lib/vista-ops.zsh"
cd "$VISTA_REPO_ROOT"

MODE=${1:-quick}
WORK=$(mktemp -d /tmp/vista-validation.XXXXXX)
trap 'rm -rf "$WORK"' EXIT

run_step() {
  local name=$1
  shift
  if vista_run "$name" "${WORK}/${name// /-}.log" "$@"; then
    cat "${WORK}/${name// /-}.log"
  else
    cat "${WORK}/${name// /-}.log"
    return 1
  fi
}

has_npm_script() {
  node -e \
    "const p=require('./package.json'); process.exit(p.scripts?.['$1'] ? 0 : 1)"
}

quick() {
  git diff --check || return
  zsh -n scripts/vista-doctor.zsh \
    scripts/vista-remediate.zsh \
    scripts/vista-validate.zsh \
    scripts/vista-housekeeping.zsh \
    scripts/vista-compose.zsh || return
  sh -n scripts/run-seeders.sh || return
  vista_compose config >/dev/null || return
  curl -fsS --max-time 30 \
    'http://localhost:3000/api/health?compact=1' >/dev/null || return
}

static_validation() {
  quick || return
  if has_npm_script typecheck; then
    run_step "npm typecheck" npm run typecheck || return
  fi
  if has_npm_script lint; then
    run_step "npm lint" npm run lint || return
  fi
}

smoke() {
  vista_compose ps -a || return
  curl -fsS --max-time 30 \
    'http://localhost:3000/api/health?compact=1' >/dev/null || return
  curl -fsS --max-time 90 \
    "http://localhost:3000/api/intelligence/v1/get-risk-scores?_vista_smoke=$(date +%s)" \
    >/dev/null || return
}

dependency() {
  run_step "npm audit" npm audit --json || true
  run_step "npm outdated" npm outdated --json || true
  if command -v docker >/dev/null; then
    docker image inspect worldmonitor:latest >/dev/null 2>&1 || true
  fi
}

full() {
  static_validation || return
  smoke || return
  if has_npm_script test:data; then
    run_step "complete data tests" npm run test:data || return
  fi
}

run_mode() {
  case "$MODE" in
    quick) quick ;;
    static) static_validation ;;
    smoke) smoke ;;
    dependency) dependency ;;
    full) full ;;
    *)
      print -u2 -- "Usage: $0 quick|static|smoke|dependency|full"
      return 2
      ;;
  esac
}

if [[ "${VISTA_EMBEDDED:-0}" == "1" ]]; then
  run_mode
  exit $?
fi

vista_init_evidence "VISTA-validation-${MODE}" >/dev/null
LOG="${VISTA_EVIDENCE_DIR}/validation-${MODE}.log"

(run_mode) 2>&1 | tee "$LOG"
RESULT=${pipestatus[1]}

for step_log in "$WORK"/*.log(N); do
  cp "$step_log" "$VISTA_EVIDENCE_DIR/"
done

if (( RESULT == 0 )); then
  vista_finding PASS VALIDATION-001 validation \
    "Validation profile ${MODE} passed"
else
  vista_finding FAIL VALIDATION-001 validation \
    "Validation profile ${MODE} failed" \
    "Inspect validation-${MODE}.log and step logs"
fi

vista_finalize_evidence
exit "$RESULT"
