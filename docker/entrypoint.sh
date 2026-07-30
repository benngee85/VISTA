#!/bin/sh
set -e




# VISTA_API_PLAN_RUNTIME_ALIAS
# Read only the API-plan credential from the Compose-managed secret.
VISTA_RUNTIME_SECRET="/run/secrets/vista_runtime_env"

if [ -r "$VISTA_RUNTIME_SECRET" ]; then
  VISTA_SECRET_API_KEY=$(
    sed -n 's/^[[:space:]]*WM_API_KEY=//p' "$VISTA_RUNTIME_SECRET" |
      tail -n 1
  )

  case "$VISTA_SECRET_API_KEY" in
    wm_*)
      export WM_API_KEY="$VISTA_SECRET_API_KEY"
      export WORLDMONITOR_API_KEY="$VISTA_SECRET_API_KEY"
      ;;
  esac

  unset VISTA_SECRET_API_KEY
fi
# VISTA_API_PLAN_RUNTIME_ALIAS_END

# Docker secrets → env var bridge
# Reads /run/secrets/KEYNAME files and exports as env vars.
# Secrets take priority over env vars set via docker-compose environment block.
if [ -d /run/secrets ]; then
  for secret_file in /run/secrets/*; do
    [ -f "$secret_file" ] || continue
    key=$(basename "$secret_file")
    value=$(cat "$secret_file" | tr -d '\n')
    export "$key"="$value"
  done
fi

export LOCAL_API_PORT="${LOCAL_API_PORT:-46123}"
if [ -z "${LOCAL_API_TOKEN:-}" ]; then
  LOCAL_API_TOKEN="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")"
  export LOCAL_API_TOKEN
fi

envsubst '$LOCAL_API_PORT $LOCAL_API_TOKEN' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/worldmonitor.conf
