#!/bin/sh
set -e




# VISTA_API_PLAN_RUNTIME_ALIAS
# Read only the API-plan credential from the Compose-managed secret.
# MLC-VISTA sovereign entitlement credential
# MLC-VISTA sovereign session authority
if [ -r /run/secrets/vista_runtime_env ]; then
  WM_SESSION_SECRET=$(awk -F= '$1 == "WM_SESSION_SECRET" {sub(/^[^=]*=/, ""); value=$0} END {print value}' /run/secrets/vista_runtime_env)
  WORLDMONITOR_API_KEY=$(awk -F= '$1 == "WM_API_KEY" {sub(/^[^=]*=/, ""); value=$0} END {print value}' /run/secrets/vista_runtime_env)
  WORLDMONITOR_VALID_KEYS=$(awk -F= '$1 == "WORLDMONITOR_VALID_KEYS" {sub(/^[^=]*=/, ""); value=$0} END {print value}' /run/secrets/vista_runtime_env)
  WORLDMONITOR_UPSTREAM_API_KEY=$(awk -F= '$1 == "WORLDMONITOR_UPSTREAM_API_KEY" {sub(/^[^=]*=/, ""); value=$0} END {print value}' /run/secrets/vista_runtime_env)
  WORLDMONITOR_UPSTREAM_API_BASE_URL=$(awk -F= '$1 == "WORLDMONITOR_UPSTREAM_API_BASE_URL" {sub(/^[^=]*=/, ""); value=$0} END {print value}' /run/secrets/vista_runtime_env)

  [ -n "$WM_SESSION_SECRET" ] || { echo "FAIL: WM_SESSION_SECRET is missing" >&2; exit 1; }
  [ -n "$WORLDMONITOR_API_KEY" ] || { echo "FAIL: WM_API_KEY is missing" >&2; exit 1; }
  [ -n "$WORLDMONITOR_VALID_KEYS" ] || { echo "FAIL: WORLDMONITOR_VALID_KEYS is missing" >&2; exit 1; }

  export WM_SESSION_SECRET
  export WORLDMONITOR_API_KEY
  export WORLDMONITOR_VALID_KEYS

  if [ -n "$WORLDMONITOR_UPSTREAM_API_KEY" ]; then
    export WORLDMONITOR_UPSTREAM_API_KEY
  fi

  if [ -n "$WORLDMONITOR_UPSTREAM_API_BASE_URL" ]; then
    export WORLDMONITOR_UPSTREAM_API_BASE_URL
  fi
fi

if [ -r /run/secrets/vista_runtime_env ]; then
  VISTA_ENTITLEMENT_PROVIDER_TOKEN=$(awk -F= '$1 == "VISTA_ENTITLEMENT_SERVICE_TOKEN" {sub(/^[^=]*=/, ""); value=$0} END {print value}' /run/secrets/vista_runtime_env)
  export VISTA_ENTITLEMENT_PROVIDER_TOKEN
fi

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

# VISTA_POST_SECRET_API_AUTHORITY_NORMALISATION
# Docker secret files are imported after vista_runtime_env. A dedicated
# /run/secrets/WORLDMONITOR_API_KEY may therefore replace the earlier
# canonical value. Reconcile the enterprise allowlist only after every
# secret source has been loaded.
if [ -n "${WORLDMONITOR_API_KEY:-}" ]; then
  case ",${WORLDMONITOR_VALID_KEYS:-}," in
    *",${WORLDMONITOR_API_KEY},"*)
      ;;
    *)
      if [ -n "${WORLDMONITOR_VALID_KEYS:-}" ]; then
        WORLDMONITOR_VALID_KEYS="${WORLDMONITOR_API_KEY},${WORLDMONITOR_VALID_KEYS}"
      else
        WORLDMONITOR_VALID_KEYS="${WORLDMONITOR_API_KEY}"
      fi
      ;;
  esac

  export WORLDMONITOR_API_KEY
  export WORLDMONITOR_VALID_KEYS
else
  echo "FAIL: effective WORLDMONITOR_API_KEY is missing after secret loading" >&2
  exit 1
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/worldmonitor.conf
