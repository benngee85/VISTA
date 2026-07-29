#!/bin/zsh
set -euo pipefail
unsetopt BANG_HIST 2>/dev/null || true

SCRIPT_DIR=${0:A:h}
PROJECT_DIR=${SCRIPT_DIR:h}

cd "$PROJECT_DIR"

test -f .env
test -f .secrets/runtime.env

exec docker compose \
  --project-directory "$PROJECT_DIR" \
  --env-file "$PROJECT_DIR/.env" \
  --env-file "$PROJECT_DIR/.secrets/runtime.env" \
  "$@"
