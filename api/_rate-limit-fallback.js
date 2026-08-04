import { redisMultiExec } from './_upstash-json.js';

const FALLBACK_REDIS_TIMEOUT_MS = 1_000;

function normalizeLuaMode(value) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'enabled') return 'enabled';
  if (normalized === 'disabled') return 'disabled';
  return 'auto';
}

function isSelfHostedRedisRest() {
  const authority =
    process.env.CACHE_REST_URL
    ?? process.env.REDIS_REST_URL
    ?? process.env.UPSTASH_REDIS_REST_URL
    ?? '';

  try {
    const url = new URL(authority);
    return /^redis-rest$/i.test(url.hostname);
  } catch {
    return /(^|\/)redis-rest(?::|\/|$)/i.test(authority);
  }
}

function initialLuaUnsupported() {
  const mode = normalizeLuaMode(process.env.CACHE_REST_LUA_MODE);

  if (mode === 'disabled') return true;
  if (mode === 'enabled') return false;

  // The self-hosted Redis REST bridge intentionally blocks EVAL/EVALSHA.
  // Skip one known-failing Lua request after every process restart.
  return isSelfHostedRedisRest();
}

let luaUnsupported = initialLuaUnsupported();
let fallbackTransitionLogged = false;

// Duration parsing mirrors @upstash/ratelimit's internal (unexported) `ms()`
// helper. Needed only so the non-Lua fallback can pass a plain-seconds EXPIRE.
export function durationToSeconds(window) {
  const match = /^(\d+)\s?(ms|s|m|h|d)$/.exec(window);
  if (!match) throw new Error(`Unable to parse rate-limit window: ${window}`);
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const unitSeconds = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86_400 };
  return Math.max(1, Math.ceil(value * (unitSeconds[unit] ?? 1)));
}

function commandError(entry, command) {
  if (!entry?.error) return null;
  return new Error(`rate-limit fallback: ${command} failed: ${entry.error}`);
}

// Atomic non-Lua fixed-window fallback. INCR, EXPIRE-NX and TTL execute
// inside one authenticated Redis MULTI/EXEC transaction. General-purpose
// EVAL/EVALSHA remains blocked by the self-hosted Redis REST proxy.
//
// EXPIRE's NX flag requires Redis 7+. If an older endpoint returns a
// per-command error or leaves the key without a TTL, degrade instead of
// creating a permanent counter.
async function fixedWindowLimit(key, limit, windowSeconds) {
  const result = await redisMultiExec([
    ['INCR', key],
    ['EXPIRE', key, String(windowSeconds), 'NX'],
    ['TTL', key],
  ], FALLBACK_REDIS_TIMEOUT_MS);
  if (!result) throw new Error('rate-limit fallback: Redis transaction unavailable');

  const incrError = commandError(result[0], 'INCR');
  if (incrError) throw incrError;
  const expireError = commandError(result[1], 'EXPIRE');
  if (expireError) throw expireError;
  const ttlError = commandError(result[2], 'TTL');
  if (ttlError) throw ttlError;

  const count = Number(result[0]?.result ?? 0);
  if (!Number.isFinite(count) || count < 1) {
    throw new Error(`rate-limit fallback: invalid Redis counter (${String(result[0]?.result)})`);
  }

  const ttlRaw = Number(result[2]?.result ?? -1);
  if (!Number.isFinite(ttlRaw) || ttlRaw < 0) {
    throw new Error(`rate-limit fallback: Redis key has no expiry (ttl=${String(result[2]?.result ?? 'missing')})`);
  }

  return { success: count <= limit, limit, reset: Date.now() + ttlRaw * 1000 };
}

// Drop-in replacement for `ratelimit.limit(identifier)` that transparently
// falls back to fixedWindowLimit the moment EVAL/EVALSHA is detected as
// unsupported. Any OTHER Lua-path error is rethrown unchanged so existing
// per-caller fail-open/failClosed + Sentry handling is untouched.
export async function limitWithFallback(rl, identifier, fallbackKey, limit, windowSeconds) {
  if (!luaUnsupported) {
    try {
      return await rl.limit(identifier);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/Command not allowed: (EVAL|EVALSHA|SCRIPT)\b/i.test(msg)) throw err;
      luaUnsupported = true;
      if (!fallbackTransitionLogged) {
        fallbackTransitionLogged = true;
        console.warn(
          '[rate-limit] EVAL/EVALSHA rejected by this Redis endpoint '
          + '— switching to the transactional non-Lua fixed-window fallback '
          + 'for the rest of this process',
        );
      }
    }
  }

  try {
    return await fixedWindowLimit(fallbackKey, limit, windowSeconds);
  } catch (err) {
    throw new Error('rate-limit fallback: Redis unavailable', { cause: err });
  }
}

export function getRateLimitFallbackMode() {
  return luaUnsupported
    ? 'transactional-fixed-window'
    : 'lua-sliding-window';
}

export function resetRateLimitFallbackForTest() {
  luaUnsupported = initialLuaUnsupported();
  fallbackTransitionLogged = false;
}
