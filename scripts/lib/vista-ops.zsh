#!/bin/zsh

setopt NO_BANG_HIST

typeset -g VISTA_REPO_ROOT=${VISTA_REPO_ROOT:-${0:A:h:h:h}}
typeset -g VISTA_HEARTBEAT_SECONDS=${VISTA_HEARTBEAT_SECONDS:-25}
typeset -g VISTA_EVIDENCE_DIR=${VISTA_EVIDENCE_DIR:-}
typeset -g VISTA_FINDINGS_FILE=${VISTA_FINDINGS_FILE:-}

vista_utc() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

vista_init_evidence() {
  local activity=$1
  local stamp
  stamp=$(date +%Y%m%d-%H%M%S)
  local root="${VISTA_REPO_ROOT}/../worldmonitor-security-evidence-$(date +%Y%m%d)"
  VISTA_EVIDENCE_DIR="${root}/${activity}-${stamp}"
  VISTA_FINDINGS_FILE="${VISTA_EVIDENCE_DIR}/findings.tsv"
  mkdir -p "$VISTA_EVIDENCE_DIR"
  : > "$VISTA_FINDINGS_FILE"
  print -r -- "$VISTA_EVIDENCE_DIR"
}

vista_finding() {
  local severity=$1
  local id=$2
  local component=$3
  local message=$4
  local remediation=${5:-}

  printf '%s\t%s\t%s\t%s\t%s\n' \
    "$severity" "$id" "$component" "$message" "$remediation" \
    >> "$VISTA_FINDINGS_FILE"

  printf '%-5s %-24s %s\n' "$severity" "$id" "$message"
}

vista_run() {
  local label=$1
  local output=$2
  shift 2

  local started=$SECONDS
  local next_heartbeat=$((SECONDS + VISTA_HEARTBEAT_SECONDS))

  print -r -- "START ${label} at $(vista_utc)"

  (
    "$@"
  ) >"$output" 2>&1 &

  local child=$!

  while kill -0 "$child" 2>/dev/null; do
    sleep 1
    if (( SECONDS >= next_heartbeat )); then
      local elapsed=$((SECONDS - started))
      local size=0
      [[ -f "$output" ]] && size=$(wc -c <"$output" | tr -d ' ')
      print -r -- "HEARTBEAT ${label}: running ${elapsed}s, output=${size}B"
      next_heartbeat=$((SECONDS + VISTA_HEARTBEAT_SECONDS))
    fi
  done

  local rc=0
  wait "$child" || rc=$?

  local elapsed=$((SECONDS - started))
  print -r -- "END ${label}: rc=${rc}, elapsed=${elapsed}s"
  return "$rc"
}

vista_env_load() {
  set -a
  [[ -f "${VISTA_REPO_ROOT}/.env" ]] &&
    source "${VISTA_REPO_ROOT}/.env"
  [[ -f "${VISTA_REPO_ROOT}/.secrets/runtime.env" ]] &&
    source "${VISTA_REPO_ROOT}/.secrets/runtime.env"
  set +a
}

vista_compose() {
  docker compose \
    --project-directory "$VISTA_REPO_ROOT" \
    --env-file "${VISTA_REPO_ROOT}/.env" \
    --env-file "${VISTA_REPO_ROOT}/.secrets/runtime.env" \
    "$@"
}

vista_render_findings() {
  python3 - "$VISTA_FINDINGS_FILE" \
    "${VISTA_EVIDENCE_DIR}/findings.json" \
    "${VISTA_EVIDENCE_DIR}/findings-summary.txt" <<'PY'
import csv
import json
import sys
from collections import Counter

source, json_target, summary_target = sys.argv[1:]
rows = []

with open(source, newline="") as handle:
    for severity, finding_id, component, message, remediation in csv.reader(
        handle,
        delimiter="\t",
    ):
        rows.append({
            "severity": severity,
            "id": finding_id,
            "component": component,
            "message": message,
            "remediation": remediation,
        })

with open(json_target, "w") as handle:
    json.dump(rows, handle, indent=2)
    handle.write("\n")

counts = Counter(row["severity"] for row in rows)
lines = [
    f"total={len(rows)}",
    f"pass={counts['PASS']}",
    f"warn={counts['WARN']}",
    f"fail={counts['FAIL']}",
    f"info={counts['INFO']}",
]

with open(summary_target, "w") as handle:
    handle.write("\n".join(lines) + "\n")
PY
}

vista_finalize_evidence() {
  vista_render_findings

  (
    cd "$VISTA_EVIDENCE_DIR"
    find . -type f -not -name SHA256SUMS -print0 |
      sort -z |
      xargs -0 shasum -a 256 > SHA256SUMS
    shasum -a 256 -c SHA256SUMS
  )

  local root=${VISTA_EVIDENCE_DIR:h}
  local base=${VISTA_EVIDENCE_DIR:t}
  COPYFILE_DISABLE=1 tar -czf "${VISTA_EVIDENCE_DIR}.tar.gz" \
    -C "$root" "$base"
  shasum -a 256 "${VISTA_EVIDENCE_DIR}.tar.gz"
  print -r -- "Evidence bundle: ${VISTA_EVIDENCE_DIR}.tar.gz"
}
