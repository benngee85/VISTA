#!/bin/sh
set -eu

if [ -z "${VALKEY_PASSWORD:-}" ]; then
  echo "ERROR: VALKEY_PASSWORD is required" >&2
  exit 1
fi

exec /usr/bin/valkey-server \
  --bind 0.0.0.0 \
  --port 6379 \
  --protected-mode yes \
  --requirepass "$VALKEY_PASSWORD" \
  --dir /data \
  --dbfilename dump.rdb \
  --appendonly yes \
  --appendfilename appendonly.aof \
  --appendfsync everysec \
  --save 900 1 \
  --save 300 10 \
  --save 60 10000
