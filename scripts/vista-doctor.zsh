#!/bin/zsh
set -u
set -o pipefail
unsetopt BANG_HIST 2>/dev/null || true

SCRIPT_DIR=${0:A:h}
source "${SCRIPT_DIR}/lib/vista-ops.zsh"
cd "$VISTA_REPO_ROOT"

MODE=${1:---all}
vista_init_evidence "VISTA-doctor" >/dev/null
LOG="${VISTA_EVIDENCE_DIR}/vista-doctor.log"

(
  print -r -- "=== VISTA Doctor ==="
  print -r -- "Started: $(vista_utc)"
  print -r -- "Mode: $MODE"
  print -r -- "Heartbeat: ${VISTA_HEARTBEAT_SECONDS}s"

  print -r -- "\n=== Repository ==="
  git status -sb >"${VISTA_EVIDENCE_DIR}/git-status.txt" 2>&1
  cat "${VISTA_EVIDENCE_DIR}/git-status.txt"

  if git diff --check >"${VISTA_EVIDENCE_DIR}/git-diff-check.txt" 2>&1; then
    vista_finding PASS REPO-001 repository \
      "Git working changes pass whitespace validation"
  else
    vista_finding FAIL REPO-001 repository \
      "Git working changes contain whitespace errors" \
      "Inspect git-diff-check.txt"
  fi

  if [[ -f .env && -f .secrets/runtime.env ]]; then
    vista_finding PASS ENV-001 configuration \
      ".env and .secrets/runtime.env are present"
  else
    vista_finding FAIL ENV-001 configuration \
      "One or both authoritative environment files are missing" \
      "Restore .env and .secrets/runtime.env"
  fi

  python3 - .env .secrets/runtime.env \
    >"${VISTA_EVIDENCE_DIR}/environment-structure.txt" <<'PY'
from pathlib import Path
import re
import stat
import sys

def inspect(path_string):
    path = Path(path_string)
    values = {}
    duplicates = []
    blanks = []

    if not path.exists():
        print(f"{path}: missing")
        return

    for line in path.read_text().splitlines():
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if not match:
            continue
        name, value = match.groups()
        if name in values:
            duplicates.append(name)
        values[name] = value
        if not value.strip():
            blanks.append(name)

    mode = stat.S_IMODE(path.stat().st_mode)
    print(f"{path}: definitions={len(values)} duplicates={len(set(duplicates))} blanks={len(blanks)} mode={mode:04o}")
    if duplicates:
        print("duplicate_names=" + ",".join(sorted(set(duplicates))))

for item in sys.argv[1:]:
    inspect(item)
PY

  if python3 - .secrets/runtime.env <<'PYMODE'
from pathlib import Path
import stat
import sys
raise SystemExit(
    0 if stat.S_IMODE(Path(sys.argv[1]).stat().st_mode) == 0o600 else 1
)
PYMODE
  then
    vista_finding PASS ENV-002 security \
      "Runtime secret file permissions are mode 600"
  else
    vista_finding FAIL ENV-002 security \
      "Runtime secret file permissions are not mode 600" \
      "chmod 600 .secrets/runtime.env"
  fi

  print -r -- "\n=== Compose interpolation and runtime ==="
  if vista_run "Compose configuration" \
    "${VISTA_EVIDENCE_DIR}/compose-config.txt" \
    vista_compose config; then
    vista_finding PASS COMPOSE-001 runtime \
      "Compose resolves with both authoritative environment files"
  else
    vista_finding FAIL COMPOSE-001 runtime \
      "Compose interpolation failed" \
      "Inspect compose-config.txt"
  fi

  vista_compose config --services \
    >"${VISTA_EVIDENCE_DIR}/compose-services.txt" 2>&1 || true

  docker ps -a \
    --format '{{.Names}}\t{{.Status}}\t{{.Label "com.docker.compose.project"}}' \
    >"${VISTA_EVIDENCE_DIR}/docker-inventory.txt" 2>&1 || true

  rollback_count=$(
    grep -c -- '-rollback-' "${VISTA_EVIDENCE_DIR}/docker-inventory.txt" ||
      true
  )

  if (( rollback_count > 0 )); then
    vista_finding WARN HOUSEKEEPING-001 containers \
      "${rollback_count} rollback containers remain" \
      "./scripts/vista-housekeeping.zsh --apply-containers"
  else
    vista_finding PASS HOUSEKEEPING-001 containers \
      "No rollback containers remain"
  fi

  project_count=$(
    awk -F '\t' '$3 != "" { print $3 }' \
      "${VISTA_EVIDENCE_DIR}/docker-inventory.txt" |
      sort -u |
      wc -l |
      tr -d ' '
  )

  if (( project_count > 1 )); then
    vista_finding WARN COMPOSE-002 runtime \
      "Containers exist under ${project_count} Compose project identities" \
      "Consolidate COMPOSE_PROJECT_NAME before Kubernetes migration"
  else
    vista_finding PASS COMPOSE-002 runtime \
      "Compose project identity is singular"
  fi

  print -r -- "\n=== Host and container endpoint separation ==="
  vista_env_load

  host_cache_url=${VISTA_HOST_CACHE_REST_URL:-http://localhost:8079}
  configured_cache_url=${UPSTASH_REDIS_REST_URL:-}

  {
    print -r -- "host_cache_scheme=${host_cache_url%%:*}"
    print -r -- "host_cache_target=${host_cache_url#*://}"
    print -r -- "configured_cache_scheme=${configured_cache_url%%:*}"
    print -r -- "configured_cache_target=${configured_cache_url#*://}"
  } >"${VISTA_EVIDENCE_DIR}/cache-endpoint-scope.txt"

  if [[ "$configured_cache_url" == *"valkey-rest:"* ]] &&
    grep -Fq 'UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-' \
      scripts/run-seeders.sh; then
    vista_finding FAIL HOST-CACHE-001 seeders \
      "Host seeders inherit container-only Valkey DNS ${configured_cache_url}" \
      "./scripts/vista-remediate.zsh --apply HOST-CACHE-001"
  else
    vista_finding PASS HOST-CACHE-001 seeders \
      "Host seeder cache endpoint is separated from container DNS"
  fi

  if [[ -n "${CACHE_REST_TOKEN:-}" ]]; then
    vista_finding PASS CACHE-001 cache \
      "Cache REST credential is present without disclosure"
  else
    vista_finding FAIL CACHE-001 cache \
      "CACHE_REST_TOKEN is absent" \
      "Restore it in .secrets/runtime.env"
  fi

  print -r -- "\n=== LLM provider ==="
  if [[ -n "${ANTHROPIC_BASE_URL:-}" &&
        -n "${ANTHROPIC_MODEL:-}" &&
        -n "${ANTHROPIC_API_KEY:-}" ]]; then
    vista_finding PASS LLM-001 providers \
      "Anthropic-compatible provider configuration is complete"
  else
    vista_finding FAIL LLM-001 providers \
      "Anthropic-compatible provider configuration is incomplete" \
      "Set the three Anthropic runtime variables in .secrets/runtime.env"
  fi

  print -r -- "\n=== Seeder static and prior-result analysis ==="
  if tail -n 20 scripts/run-seeders.sh |
    grep -Eq 'exit [\"$]?\{?fail|fail.*-gt.*0'; then
    vista_finding PASS SEED-EXIT-001 seeders \
      "Seeder runner propagates aggregate failures"
  else
    vista_finding FAIL SEED-EXIT-001 seeders \
      "Seeder runner can report failures while returning success" \
      "./scripts/vista-remediate.zsh --apply SEED-EXIT-001"
  fi

  if grep -Fq 'VISTA_SEED_LOG_DIR' scripts/run-seeders.sh; then
    vista_finding PASS SEED-LOGGING-001 seeders \
      "Per-seeder full diagnostic logging is available"
  else
    vista_finding WARN SEED-LOGGING-001 seeders \
      "Seeder aggregation can conceal the underlying exception" \
      "./scripts/vista-remediate.zsh --apply SEED-LOGGING-001"
  fi

  if grep -Fq 'seed-consumer-prices.mjs' scripts/run-seeders.sh &&
    ! grep -Eq 'seed-consumer-prices.*--force|--force.*seed-consumer-prices' \
      scripts/run-seeders.sh; then
    vista_finding WARN SEED-ARGS-001 seeders \
      "Consumer-price seeder requires --force but the general runner has no argument policy" \
      "Add a per-seeder argument manifest"
  else
    vista_finding PASS SEED-ARGS-001 seeders \
      "Special seeder arguments are represented"
  fi

  if [[ -n "${WORLDMONITOR_SEED_REFRESH_KEY:-}" ]]; then
    vista_finding PASS SEED-SECRET-001 seeders \
      "Seeder refresh credential is present"
  else
    vista_finding FAIL SEED-SECRET-001 seeders \
      "WORLDMONITOR_SEED_REFRESH_KEY is absent" \
      "./scripts/vista-remediate.zsh --apply SEED-SECRET-001"
  fi

  latest_seeder_log=$(
    find "${VISTA_REPO_ROOT}/.." \
      -path '*worldmonitor-security-evidence-*' \
      -type f \
      -name seeders-complete.txt \
      -print 2>/dev/null |
      sort |
      tail -n 1
  )

  if [[ -n "$latest_seeder_log" ]]; then
    cp "$latest_seeder_log" \
      "${VISTA_EVIDENCE_DIR}/latest-seeder-result.txt"
    redis_unavailable=$(
      grep -c 'Redis unavailable' "$latest_seeder_log" || true
    )
    seeder_failures=$(
      grep -c '^→ .* FAIL ' "$latest_seeder_log" || true
    )
    vista_finding INFO SEED-HISTORY-001 seeders \
      "Latest run contains ${redis_unavailable} Redis-unavailable results and ${seeder_failures} explicit failures"
  fi

  print -r -- "\n=== HTTP smoke matrix ==="
  compact_code=$(
    curl -sS -o "${VISTA_EVIDENCE_DIR}/compact-health.json" \
      -w '%{http_code}' --max-time 30 \
      'http://localhost:3000/api/health?compact=1' 2>/dev/null ||
      print 000
  )

  if [[ "$compact_code" == "200" ]]; then
    vista_finding PASS HTTP-001 smoke \
      "Public compact health returned HTTP 200"
  else
    vista_finding FAIL HTTP-001 smoke \
      "Public compact health returned HTTP ${compact_code}" \
      "Inspect active Compose project and application logs"
  fi

  fallback_code=$(
    curl -sS -o "${VISTA_EVIDENCE_DIR}/api-fallback.json" \
      -w '%{http_code}' --max-time 90 \
      "http://localhost:3000/api/intelligence/v1/get-risk-scores?_vista_doctor=$(date +%s)" \
      2>/dev/null ||
      print 000
  )

  if [[ "$fallback_code" == "200" ]]; then
    vista_finding PASS HTTP-002 smoke \
      "Server-side paid API fallback returned HTTP 200"
  else
    vista_finding FAIL HTTP-002 smoke \
      "Server-side paid API fallback returned HTTP ${fallback_code}" \
      "Inspect server-side WM_API_KEY scope and fallback logs"
  fi

  print -r -- "\n=== Dependency lifecycle ==="
  node --input-type=module - \
    package-lock.json \
    "${VISTA_EVIDENCE_DIR}/npm-lifecycle.json" <<'NODE'
import fs from 'node:fs';

const [, , lockPath, outputPath] = process.argv;
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const packages = lock.packages ?? {};
const deprecated = [];
const engineRisks = [];

for (const [path, value] of Object.entries(packages)) {
  if (!value || typeof value !== 'object') continue;
  if (typeof value.deprecated === 'string') {
    deprecated.push({
      path,
      version: value.version ?? null,
      reason: value.deprecated,
    });
  }
  if (value.engines?.node) {
    engineRisks.push({
      path,
      version: value.version ?? null,
      node: value.engines.node,
    });
  }
}

fs.writeFileSync(
  outputPath,
  JSON.stringify({
    deprecatedCount: deprecated.length,
    deprecated,
    engineDeclarationCount: engineRisks.length,
    engineDeclarations: engineRisks,
  }, null, 2) + '\n',
);

console.log(`deprecated=${deprecated.length}`);
NODE

  deprecated_count=$(
    node -e "const x=require('${VISTA_EVIDENCE_DIR}/npm-lifecycle.json'); console.log(x.deprecatedCount)"
  )

  if (( deprecated_count > 0 )); then
    vista_finding WARN NPM-001 supply-chain \
      "${deprecated_count} deprecated installed npm package entries detected" \
      "./scripts/vista-validate.zsh dependency"
  else
    vista_finding PASS NPM-001 supply-chain \
      "No package-lock deprecation markers detected"
  fi

  print -r -- "\n=== Portability and hardened OCI posture ==="
  tracked_secret_matches=$(
    python3 - .secrets/runtime.env <<'PYSECRET'
from pathlib import Path
import subprocess
import sys

secret_file = Path(sys.argv[1])
values = []
for line in secret_file.read_text().splitlines():
    if not line or line.lstrip().startswith("#") or "=" not in line:
        continue
    _, value = line.split("=", 1)
    if len(value) >= 12:
        values.append(value.encode())

excluded = (
    "tests/",
    ".env.example",
    "package-lock.json",
    "npm-shrinkwrap.json",
)
matches = 0
for raw_path in subprocess.check_output(["git", "ls-files", "-z"]).split(b"\0"):
    if not raw_path:
        continue
    relative = raw_path.decode(errors="surrogateescape")
    if relative == ".env.example" or relative.startswith(excluded):
        continue
    try:
        content = Path(relative).read_bytes()
    except OSError:
        continue
    if any(value in content for value in values):
        matches += 1

print(matches)
PYSECRET
  )

  if (( tracked_secret_matches == 0 )); then
    vista_finding PASS OCI-SEC-001 security \
      "No obvious runtime credential literals found outside tests"
  else
    vista_finding FAIL OCI-SEC-001 security \
      "${tracked_secret_matches} possible tracked credential literals found" \
      "Review without copying values into evidence"
  fi

  for capability in docker kubernetes podman k3s gke; do
    case "$capability" in
      docker)
        [[ -f docker-compose.yml ]] && capability_status=PASS || capability_status=WARN
        ;;
      kubernetes|k3s|gke)
        if find . -maxdepth 4 -type f \
          \( -name 'kustomization.yaml' -o -name 'Chart.yaml' \) |
          grep -q .; then capability_status=PASS; else capability_status=WARN; fi
        ;;
      podman)
        if find . -maxdepth 4 -type f \
          \( -name '*.container' -o -name '*.kube' \) |
          grep -q .; then capability_status=PASS; else capability_status=WARN; fi
        ;;
    esac
    vista_finding "$capability_status" "PORT-${capability:u}" portability \
      "${capability} deployment surface assessment completed"
  done

  print -r -- "\n=== Constrained-network profile ==="
  if [[ -f config/operations/network-profiles.env ]]; then
    vista_finding PASS NET-001 network \
      "Declarative SATCOM network profile is present"
  else
    vista_finding FAIL NET-001 network \
      "SATCOM network profile is missing"
  fi

  print -r -- "\n=== Housekeeping assessment ==="
  scripts/vista-housekeeping.zsh --report \
    >"${VISTA_EVIDENCE_DIR}/housekeeping-report.txt" 2>&1 || true

  print -r -- "\n=== Quick validation ==="
  if vista_run "Quick validation" \
    "${VISTA_EVIDENCE_DIR}/quick-validation.txt" \
    env VISTA_EMBEDDED=1 scripts/vista-validate.zsh quick; then
    vista_finding PASS TEST-001 validation \
      "Quick static and smoke validation passed"
  else
    vista_finding FAIL TEST-001 validation \
      "Quick validation found one or more failures" \
      "Inspect quick-validation.txt"
  fi

  vista_render_findings
  cat "${VISTA_EVIDENCE_DIR}/findings-summary.txt"

  fail_count=$(awk -F '\t' '$1 == "FAIL" { count++ } END { print count+0 }' \
    "$VISTA_FINDINGS_FILE")

  print -r -- "Doctor completed with ${fail_count} failures"
  (( fail_count == 0 ))
) 2>&1 | tee "$LOG"

RESULT=${pipestatus[1]}
vista_finalize_evidence
exit "$RESULT"
