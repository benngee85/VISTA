#!/usr/bin/env node

import crypto from 'node:crypto';

const clean = (value) => {
  const normalized = value?.trim();
  return normalized || undefined;
};

const baseUrl =
  clean(process.env.CACHE_REST_URL)
  ?? clean(process.env.REDIS_REST_URL)
  ?? clean(process.env.UPSTASH_REDIS_REST_URL);

const token =
  clean(process.env.CACHE_REST_TOKEN)
  ?? clean(process.env.REDIS_TOKEN)
  ?? clean(process.env.UPSTASH_REDIS_REST_TOKEN);

if (!baseUrl || !token) {
  console.error(
    'CACHE_REST_URL/CACHE_REST_TOKEN or compatible Redis REST variables are required',
  );
  process.exit(2);
}

const timeoutMs = Number(
  process.env.CACHE_REST_PROBE_TIMEOUT_MS ?? 5_000,
);

if (!Number.isFinite(timeoutMs) || timeoutMs < 500) {
  console.error('CACHE_REST_PROBE_TIMEOUT_MS must be at least 500');
  process.exit(2);
}

const key = `health:transaction:${crypto.randomUUID()}`;
const expected = crypto.randomBytes(16).toString('hex');

const command = async (parts) => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/${parts.map(encodeURIComponent).join('/')}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      },
    );

    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `Redis REST HTTP ${response.status}: ${body.slice(0, 300)}`,
      );
    }

    let payload;

    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error(
        `Redis REST returned non-JSON: ${body.slice(0, 300)}`,
      );
    }

    if (payload?.error) {
      throw new Error(
        `Redis REST command error: ${payload.error}`,
      );
    }

    return payload?.result;
  } finally {
    clearTimeout(timeout);
  }
};

let deleteAttempted = false;

try {
  const setResult = await command([
    'SET',
    key,
    expected,
    'EX',
    '30',
  ]);

  if (String(setResult).toUpperCase() !== 'OK') {
    throw new Error(
      `SET returned unexpected result: ${String(setResult)}`,
    );
  }

  const value = await command(['GET', key]);

  if (value !== expected) {
    throw new Error(
      `GET mismatch: expected ${expected}, received ${String(value)}`,
    );
  }

  const ttl = Number(await command(['TTL', key]));

  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 30) {
    throw new Error(
      `TTL outside expected range: ${String(ttl)}`,
    );
  }

  const deleted = Number(await command(['DEL', key]));
  deleteAttempted = true;

  if (deleted !== 1) {
    throw new Error(
      `DEL returned unexpected result: ${String(deleted)}`,
    );
  }

  console.log(
    JSON.stringify({
      healthy: true,
      mode: 'transactional-non-lua',
      operations: ['SET', 'GET', 'TTL', 'DEL'],
      ttlSeconds: ttl,
    }),
  );
} catch (error) {
  if (!deleteAttempted) {
    try {
      await command(['DEL', key]);
    } catch {
      // Preserve the original probe failure.
    }
  }

  console.error(
    JSON.stringify({
      healthy: false,
      mode: 'transactional-non-lua',
      error:
        error instanceof Error
          ? error.message
          : String(error),
    }),
  );

  process.exit(1);
}
