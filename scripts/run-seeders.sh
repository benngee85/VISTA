#!/bin/sh
# Run all seed scripts against the sovereign Valkey REST bridge.
# Usage: ./scripts/run-seeders.sh
#
# Requires the worldmonitor stack to be running (uvx podman-compose up -d).
# The Valkey REST bridge listens on localhost:8079 by default.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load REDIS_TOKEN (and any seeder API keys present) from .env so the
# host-side seeders can talk to the REST proxy with the same bearer the
# compose stack is using. Defaults removed in #3804 — the seeders fail-loud
# if REDIS_TOKEN is not in the environment or .env.
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env"
  set +a
fi

# Host seeders execute outside the Compose network. Never inherit the
# container-only http://valkey-rest:8080 endpoint from .env.
if [ -f "$PROJECT_DIR/.secrets/runtime.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.secrets/runtime.env"
  set +a
fi

VISTA_HOST_CACHE_REST_URL="${VISTA_HOST_CACHE_REST_URL:-http://127.0.0.1:8079}"
CACHE_REST_URL="$VISTA_HOST_CACHE_REST_URL"

if [ -z "${CACHE_REST_TOKEN:-}" ]; then
  if [ -n "${REDIS_TOKEN:-}" ]; then
    CACHE_REST_TOKEN="$REDIS_TOKEN"
  elif [ -n "${UPSTASH_REDIS_REST_TOKEN:-}" ]; then
    CACHE_REST_TOKEN="$UPSTASH_REDIS_REST_TOKEN"
  fi
fi

if [ -z "${CACHE_REST_TOKEN:-}" ]; then
  echo "ERROR: CACHE_REST_TOKEN is required." >&2
  echo "       REDIS_TOKEN and UPSTASH_REDIS_REST_TOKEN remain accepted compatibility inputs." >&2
  echo "       Generate with: openssl rand -hex 32" >&2
  exit 1
fi


UPSTASH_REDIS_REST_URL="$CACHE_REST_URL"
UPSTASH_REDIS_REST_TOKEN="$CACHE_REST_TOKEN"

export CACHE_REST_URL CACHE_REST_TOKEN
export UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN

# Host compatibility for API-authenticated warmers.
WORLDMONITOR_API_KEY="${WORLDMONITOR_API_KEY:-${WM_API_KEY:-}}"
export WORLDMONITOR_API_KEY

# Source API keys from docker-compose.override.yml if present.
# These keys are configured for the container but seeders run on the host.
OVERRIDE="$PROJECT_DIR/docker-compose.override.yml"
if [ -f "$OVERRIDE" ]; then
  _env_tmp=$(mktemp)
  grep -E '^[[:space:]]+[A-Z_]+:' "$OVERRIDE" \
    | grep -v '#' \
    | sed 's/^[[:space:]]*//' \
    | sed 's/: */=/' \
    | sed "s/[\"']//g" \
    | grep -E '^(NASA_FIRMS|GROQ|AISSTREAM|FRED|FINNHUB|EIA|ACLED_ACCESS_TOKEN|ACLED_EMAIL|ACLED_PASSWORD|CLOUDFLARE|AVIATIONSTACK|OPENAQ_API_KEY|WAQI_API_KEY|OPENROUTER_API_KEY|LLM_API_URL|LLM_API_KEY|LLM_MODEL|OLLAMA_API_URL|OLLAMA_MODEL)' \
    | sed 's/^/export /' > "$_env_tmp"
  . "$_env_tmp"
  rm -f "$_env_tmp"
fi

# Seeders execute directly on the host, not inside Docker.
# Translate the host-specific endpoint into the variable expected by
# the shared LLM client code.
LLM_API_URL="${LLM_API_URL_HOST:-http://localhost:1234/v1/chat/completions}"
export LLM_API_URL

if [ -z "${LLM_API_KEY:-}" ] && {
  [ -z "${ANTHROPIC_BASE_URL:-}" ] ||
  [ -z "${ANTHROPIC_API_KEY:-}" ]
}; then
  echo "ERROR: LLM_API_KEY is required for host-side LLM seeders." >&2
  exit 1
fi

if [ -z "${LLM_MODEL:-}" ] &&
  [ -z "${ANTHROPIC_MODEL:-}" ]; then
  echo "ERROR: LLM_MODEL is required for host-side LLM seeders." >&2
  exit 1
fi

printf '%s\n' "Host seeder endpoints:"
printf '  Valkey REST: %s\n' "$CACHE_REST_URL"
printf '  LLM API:    %s\n' "$LLM_API_URL"
printf '  LLM model:  %s\n' "$LLM_MODEL"


# Fail once before the long pass if the host endpoint or bearer token is wrong.
node --input-type=module - <<'NODE'
const url = process.env.CACHE_REST_URL;
const token = process.env.CACHE_REST_TOKEN;
const response = await fetch(`${url.replace(/\/+$/, '')}/pipeline`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify([['PING']]),
  signal: AbortSignal.timeout(5000),
}).catch((error) => {
  console.error(`ERROR: host Valkey REST preflight failed: ${error.message}`);
  process.exit(2);
});
const body = await response.text();
if (!response.ok || !body.includes('PONG')) {
  console.error(`ERROR: host Valkey REST preflight returned HTTP ${response.status}`);
  process.exit(2);
}
console.log('PASS: authenticated host Valkey REST preflight');
NODE

# Per-seeder wall-clock cap for STANDALONE seeders. They run sequentially, so a
# single upstream that hangs (e.g. a slow NOAA/NSIDC fetch that doesn't honour its
# own AbortSignal and keeps the node process alive for an hour) would burn the rest
# of the window and starve every later seeder — under a wrapping systemd/cron job
# timeout it drops everything after the hung one. Capping each seeder bounds that
# blast radius. Default 1800s (30min): above any standalone seeder's real runtime
# yet below the pathological hangs (60min+), so it kills only runaway runs.
# Override with SEED_TIMEOUT=<seconds>, or SEED_TIMEOUT=0 to disable.
#
# Bundle seeders (seed-bundle-*.mjs) are EXEMPT from this cap: scripts/_bundle-runner.mjs
# already hard-caps every section with its own wall-clock timer (SIGTERM→SIGKILL on
# the section's child PID — immune to the DNS-hang blind spot) and runs sections
# sequentially, so a bundle's *legitimate* total can exceed SEED_TIMEOUT (e.g.
# resilience-recovery's Import-HHI section alone budgets 30min). Wrapping a bundle in
# the outer cap would false-kill it mid-run and orphan the in-flight section child.
SEED_TIMEOUT="${SEED_TIMEOUT:-1800}"

# Resolve once whether the outer cap is usable (timeout(1) present and a positive
# numeric budget). Non-numeric/empty SEED_TIMEOUT → test errors → disabled (plain node).
if command -v timeout >/dev/null 2>&1 && [ "${SEED_TIMEOUT:-0}" -gt 0 ] 2>/dev/null; then
  timeout_enabled=true
else
  timeout_enabled=false
fi

# Bundle seeders self-bound per section — never wrap them in the outer cap.
is_bundle() {
  case "$1" in
    *seed-bundle-*) return 0 ;;
    *) return 1 ;;
  esac
}

# Whether THIS seeder is wrapped by the outer timeout.
caps_seed() {
  [ "$timeout_enabled" = true ] && ! is_bundle "$1"
}

run_seed_to_file() {
  seed_file="$1"
  seed_output="$2"

  if caps_seed "$seed_file"; then
    timeout -k 30 "$SEED_TIMEOUT" node "$seed_file" >"$seed_output" 2>&1 &
  else
    node "$seed_file" >"$seed_output" 2>&1 &
  fi

  seed_pid=$!
  seed_started=$(date +%s)
  seed_next_heartbeat=25
  while kill -0 "$seed_pid" 2>/dev/null; do
    sleep 5
    seed_now=$(date +%s)
    seed_elapsed=$((seed_now - seed_started))
    if kill -0 "$seed_pid" 2>/dev/null &&
      [ "$seed_elapsed" -ge "$seed_next_heartbeat" ]; then
      seed_bytes=$(wc -c <"$seed_output" | tr -d ' ')
      printf "\n  HEARTBEAT: %s running %ss output=%sB\n"         "$(basename "$seed_file")" "$seed_elapsed" "$seed_bytes"
      seed_next_heartbeat=$((seed_next_heartbeat + 25))
    fi
  done

  wait "$seed_pid"
}

# VISTA_BASELINE_SEED_PLAN_V2
ok=0
fail=0
skip=0
blocked=0
graceful=0
timedout=0

# Build an ordered, duplicate-free baseline. Bundle scripts are scheduler
# wrappers around these same seeders and must not be run a second time.
set --
for f in "$SCRIPT_DIR"/seed-*.mjs; do
  candidate_name="$(basename "$f")"
  case "$candidate_name" in
    seed-bundle-*.mjs)
      printf "POLICY SKIP: %s (deployment scheduler wrapper)\n" "$candidate_name"
      skip=$((skip + 1))
      ;;
    seed-consumer-prices.mjs|seed-digest-notifications.mjs)
      printf "POLICY SKIP: %s (manual/notification job, not baseline data seeder)\n" "$candidate_name"
      skip=$((skip + 1))
      ;;
    seed-climate-anomalies.mjs|seed-correlation.mjs|seed-cross-source-signals.mjs|\
    seed-hs2-chokepoint-exposure.mjs|seed-insights.mjs|seed-military-cii.mjs|\
    seed-recovery-import-hhi.mjs|seed-recovery-reexport-share.mjs|\
    seed-regional-briefs.mjs|seed-regional-snapshots.mjs|\
    seed-resilience-scores.mjs|seed-sovereign-wealth.mjs|\
    seed-thermal-escalation.mjs)
      # Appended after primary sources below.
      ;;
    *)
      set -- "$@" "$f"
      ;;
  esac
done

for deferred_name in \
  seed-climate-anomalies.mjs \
  seed-hs2-chokepoint-exposure.mjs \
  seed-recovery-import-hhi.mjs \
  seed-recovery-reexport-share.mjs \
  seed-sovereign-wealth.mjs \
  seed-resilience-scores.mjs \
  seed-correlation.mjs \
  seed-cross-source-signals.mjs \
  seed-thermal-escalation.mjs \
  seed-insights.mjs \
  seed-military-cii.mjs \
  seed-regional-snapshots.mjs \
  seed-regional-briefs.mjs
do
  [ -f "$SCRIPT_DIR/$deferred_name" ] &&
    set -- "$@" "$SCRIPT_DIR/$deferred_name"
done

for f in "$@"; do
  name="$(basename "$f")"
  printf "→ %s ... " "$name"

  case "$name" in
    seed-comtrade-bilateral-hs4.mjs|seed-recovery-import-hhi.mjs|seed-recovery-reexport-share.mjs)
      if [ -z "${COMTRADE_API_KEYS:-}" ]; then
        printf "BLOCKED (COMTRADE_API_KEYS not configured)\n"
        blocked=$((blocked + 1))
        continue
      fi
      ;;
    seed-defense-patents.mjs)
      if [ -z "${USPTO_API_KEY:-}" ]; then
        printf "BLOCKED (USPTO_API_KEY not configured)\n"
        blocked=$((blocked + 1))
        continue
      fi
      ;;
    seed-bigmac.mjs)
      if [ -z "${EXA_API_KEYS:-${EXA_API_KEY:-}}" ]; then
        printf "BLOCKED (EXA_API_KEYS not configured)\n"
        blocked=$((blocked + 1))
        continue
      fi
      ;;
  esac

  seed_tmp="$(mktemp)"
  run_seed_to_file "$f" "$seed_tmp"
  rc=$?
  output="$(cat "$seed_tmp")"

  # Preserve complete output so aggregation cannot hide the exception.
  if [ -n "${VISTA_SEED_LOG_DIR:-}" ]; then
    umask 077
    mkdir -p "$VISTA_SEED_LOG_DIR"
    seed_log_name="$(basename "$f" .mjs)"
    cp "$seed_tmp" "$VISTA_SEED_LOG_DIR/${seed_log_name}.log"
  fi
  rm -f "$seed_tmp"

  last="$(printf '%s\n' "$output" | tail -1)"

  if caps_seed "$f" && { [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; }; then
    printf "TIMEOUT (killed after %ss)\n" "$SEED_TIMEOUT"
    timedout=$((timedout + 1))
  elif [ "$rc" -eq 75 ]; then
    printf "GRACEFUL (%s)\n" "$last"
    graceful=$((graceful + 1))
  elif [ "$rc" -ne 0 ] && printf '%s\n' "$output" |
    grep -Eqi 'not configured|not set|is required|no credentials configured|Data file not found locally or on R2|requires CONNECT proxy|Usage:'; then
    printf "BLOCKED (%s)\n" "$last"
    blocked=$((blocked + 1))
  elif [ "$rc" -ne 0 ]; then
    printf "FAIL (%s)\n" "$last"
    fail=$((fail + 1))
  elif printf '%s\n' "$last" |
    grep -Eqi 'skip|not set|missing.*key|not found'; then
    printf "SKIP (%s)\n" "$last"
    skip=$((skip + 1))
  else
    printf "OK\n"
    ok=$((ok + 1))
  fi
done

echo ""
echo "Done: $ok ok, $skip policy/runtime skipped, $blocked blocked by configuration, $graceful gracefully deferred, $fail failed, $timedout timed out"

if [ "$fail" -gt 0 ] || [ "$timedout" -gt 0 ]; then
  exit 1
fi

if [ "${VISTA_SEED_STRICT_COVERAGE:-0}" = "1" ] &&
  { [ "$blocked" -gt 0 ] || [ "$graceful" -gt 0 ]; }; then
  exit 2
fi
