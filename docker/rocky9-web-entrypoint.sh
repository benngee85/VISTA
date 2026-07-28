#!/bin/sh
set -eu

: "${API_UPSTREAM:?API_UPSTREAM is required}"
: "${LOCAL_API_TOKEN:?LOCAL_API_TOKEN is required}"

case "${API_UPSTREAM}" in
  http://*|https://*) ;;
  *)
    echo "API_UPSTREAM must use http:// or https://" >&2
    exit 1
    ;;
esac

envsubst '$API_UPSTREAM $LOCAL_API_TOKEN' \
  </etc/nginx/nginx-rocky9.conf.template \
  >/tmp/nginx.conf

exec /usr/sbin/nginx -e /dev/stderr -c /tmp/nginx.conf -g 'daemon off;'
