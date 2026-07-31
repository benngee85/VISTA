#!/bin/zsh
set -euo pipefail
unsetopt BANG_HIST

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO"

ENV_ARGS=()
for FILE in .env .env.node .env.local .secrets/runtime.env; do
  [[ -f "$FILE" ]] && ENV_ARGS+=(--env-file "$FILE")
done

exec env \
  -u COMPOSE_FILE \
  -u COMPOSE_ENV_FILES \
  -u COMPOSE_PATH_SEPARATOR \
  docker compose \
    --project-directory "$REPO" \
    "${ENV_ARGS[@]}" \
    "$@"
