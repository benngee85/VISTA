const RELEASES_URL = "https://api.github.com/repos/benngee85/VISTA/releases/latest";
const CACHE_KEY = "github:latest-release:v1";
const CACHE_TTL_SECONDS = 300;

function getRedisCredentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/$/u, ''),
    token,
  };
}

async function readCachedRelease() {
  const credentials =
    getRedisCredentials();

  if (!credentials) {
    return null;
  }

  const response =
    await fetch(
      `${credentials.url}/get/${encodeURIComponent(CACHE_KEY)}`,
      {
        headers: {
          Authorization:
            `Bearer ${credentials.token}`,
        },
        signal:
          AbortSignal.timeout(3_000),
      },
    );

  if (!response.ok) {
    throw new Error(
      `GitHub release cache GET returned HTTP ${response.status}`,
    );
  }

  const payload =
    await response.json();

  if (
    !payload ||
    typeof payload !== 'object' ||
    !Object.prototype.hasOwnProperty.call(
      payload,
      'result',
    )
  ) {
    throw new Error(
      'GitHub release cache GET returned a malformed response',
    );
  }

  if (payload.result === null) {
    return null;
  }

  if (typeof payload.result === 'string') {
    return JSON.parse(
      payload.result,
    );
  }

  return payload.result;
}

async function writeCachedRelease(release) {
  const credentials =
    getRedisCredentials();

  if (!credentials) {
    return false;
  }

  const commands = [
    [
      'SET',
      CACHE_KEY,
      JSON.stringify(release),
      'EX',
      String(CACHE_TTL_SECONDS),
    ],
  ];

  const response =
    await fetch(
      `${credentials.url}/pipeline`,
      {
        method:
          'POST',
        headers: {
          Authorization:
            `Bearer ${credentials.token}`,
          'Content-Type':
            'application/json',
          'User-Agent':
            'worldmonitor-edge/1.0',
        },
        body:
          JSON.stringify(commands),
        signal:
          AbortSignal.timeout(5_000),
      },
    );

  if (!response.ok) {
    throw new Error(
      `GitHub release cache pipeline returned HTTP ${response.status}`,
    );
  }

  const results =
    await response.json();

  if (
    !Array.isArray(results) ||
    results.length !== commands.length
  ) {
    throw new Error(
      'GitHub release cache pipeline returned a malformed response',
    );
  }

  const firstResult =
    results[0];

  if (
    !firstResult ||
    typeof firstResult !== 'object' ||
    Object.prototype.hasOwnProperty.call(
      firstResult,
      'error',
    )
  ) {
    throw new Error(
      'GitHub release cache SET failed',
    );
  }

  return true;
}

export async function fetchLatestRelease(userAgent) {
  try {
    const cachedRelease =
      await readCachedRelease();

    if (cachedRelease) {
      return cachedRelease;
    }
  } catch {
    // Redis is a load shield, not a request dependency.
  }

  const response =
    await fetch(
      RELEASES_URL,
      {
        headers: {
          Accept:
            'application/vnd.github+json',
          'User-Agent':
            userAgent,
        },
      },
    );

  if (!response.ok) {
    return null;
  }

  const release =
    await response.json();

  try {
    await writeCachedRelease(
      release,
    );
  } catch {
    // A failed cache write must not discard a valid GitHub response.
  }

  return release;
}
