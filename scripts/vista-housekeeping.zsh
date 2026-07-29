#!/bin/zsh
set -u
unsetopt BANG_HIST 2>/dev/null || true

SCRIPT_DIR=${0:A:h}
REPO=${SCRIPT_DIR:h}
MODE=${1:---report}
RETENTION_DAYS=${VISTA_EVIDENCE_RETENTION_DAYS:-14}
KEEP_LATEST=${VISTA_EVIDENCE_KEEP_LATEST:-5}
EVIDENCE_PARENT=${REPO:h}

print -r -- "mode=$MODE"
print -r -- "retention_days=$RETENTION_DAYS"
print -r -- "keep_latest=$KEEP_LATEST"

typeset -a candidates
candidates=(
  ${(f)"$(
    find "$EVIDENCE_PARENT" \
      -maxdepth 2 \
      -type d \
      -name 'worldmonitor-security-evidence-*' \
      -mtime "+${RETENTION_DAYS}" \
      -print 2>/dev/null |
      sort -r |
      tail -n "+$((KEEP_LATEST + 1))"
  )"}
)

print -r -- "old_evidence_directories=${#candidates}"

if [[ "$MODE" == "--apply" ]]; then
  for target in "${candidates[@]}"; do
    case "$target" in
      "${EVIDENCE_PARENT}"/worldmonitor-security-evidence-*)
        print -r -- "Removing expired evidence: $target"
        rm -rf -- "$target"
        ;;
      *)
        print -u2 -- "REFUSED unsafe target: $target"
        exit 1
        ;;
    esac
  done
fi

rollback_count=$(
  docker ps -a --format '{{.Names}}' 2>/dev/null |
    grep -c -- '-rollback-' ||
    true
)
print -r -- "rollback_containers=$rollback_count"

if [[ "$MODE" == "--apply-containers" ]]; then
  docker ps -a --format '{{.Names}}' |
    grep -- '-rollback-' |
    while IFS= read -r container; do
      [[ -z "$container" ]] && continue
      print -r -- "Removing stopped rollback container: $container"
      docker container rm "$container"
    done
fi

backup_root="${HOME}/.vista-sensitive-backups"
if [[ -d "$backup_root" ]]; then
  backup_count=$(find "$backup_root" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  print -r -- "protected_backup_directories=$backup_count"
  print -r -- "protected_backup_action=report-only"
fi

docker system df 2>/dev/null || true
