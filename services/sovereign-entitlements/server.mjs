import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const MAX_REQUEST_BYTES = 16_384;
const DEFAULT_PORT = 46_124;
const DEFAULT_KEY_PREFIX = 'vista:entitlements:v1';
const DEFAULT_AUDIT_KEY = 'vista:audit:entitlements:v1';
const MAX_AUDIT_EVENTS = 10_000;

function parsePort(raw) {
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535
    ? parsed
    : DEFAULT_PORT;
}

function normaliseBaseUrl(raw) {
  const url = new URL(raw);
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

export function readServiceConfig(environment = process.env) {
  let redisUrl = null;

  try {
    if (environment.UPSTASH_REDIS_REST_URL) {
      redisUrl = normaliseBaseUrl(
        environment.UPSTASH_REDIS_REST_URL,
      );

      const insecureAllowed =
        environment.UPSTASH_ALLOW_INSECURE_HTTP === 'true';

      if (
        redisUrl.protocol !== 'https:' &&
        !(redisUrl.protocol === 'http:' && insecureAllowed)
      ) {
        redisUrl = null;
      }
    }
  } catch {
    redisUrl = null;
  }

  const config = {
    port: parsePort(environment.VISTA_ENTITLEMENT_SERVICE_PORT),
    serviceToken:
      environment.VISTA_ENTITLEMENT_SERVICE_TOKEN?.trim() ?? '',
    redisUrl,
    redisToken:
      environment.UPSTASH_REDIS_REST_TOKEN?.trim() ?? '',
    keyPrefix:
      environment.VISTA_ENTITLEMENT_KEY_PREFIX?.trim() ||
      DEFAULT_KEY_PREFIX,
    auditKey:
      environment.VISTA_ENTITLEMENT_AUDIT_KEY?.trim() ||
      DEFAULT_AUDIT_KEY,
    auditHmacKey:
      environment.VISTA_ENTITLEMENT_AUDIT_HMAC_KEY?.trim() ?? '',
  };

  return {
    ...config,
    configured: Boolean(
      config.serviceToken &&
      config.redisUrl &&
      config.redisToken &&
      config.auditHmacKey,
    ),
  };
}

function secureEquals(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer);
}

function bearerToken(request) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return '';
  }

  return authorization.slice('Bearer '.length).trim();
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
  });

  response.end(body);
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.length;

    if (size > MAX_REQUEST_BYTES) {
      const error = new Error('request body too large');
      error.statusCode = 413;
      throw error;
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    const error = new Error('request body required');
    error.statusCode = 400;
    throw error;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

function asRecord(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value
    : null;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isStringArray(value) {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string');
}

function validPlanLimits(value) {
  if (value === undefined) {
    return true;
  }

  const limits = asRecord(value);

  if (!limits) {
    return false;
  }

  for (const key of [
    'apiRequestsPerDay',
    'apiBurstRequestsPerMinute',
    'mcpCallsPerDay',
    'mcpBurstRequestsPerMinute',
  ]) {
    const entry = limits[key];

    if (
      entry !== undefined &&
      entry !== null &&
      !isNonNegativeInteger(entry)
    ) {
      return false;
    }
  }

  return true;
}

export function validateEntitlementRecord(value) {
  const entitlement = asRecord(value);
  const features = asRecord(entitlement?.features);

  if (!entitlement || !features) {
    return null;
  }

  if (
    typeof entitlement.planKey !== 'string' ||
    entitlement.planKey.length < 1 ||
    entitlement.planKey.length > 128 ||
    !isNonNegativeInteger(features.tier) ||
    features.tier > 100 ||
    typeof features.apiAccess !== 'boolean' ||
    typeof features.apiRateLimit !== 'number' ||
    !Number.isFinite(features.apiRateLimit) ||
    features.apiRateLimit < 0 ||
    !isNonNegativeInteger(features.maxDashboards) ||
    typeof features.prioritySupport !== 'boolean' ||
    !isStringArray(features.exportFormats) ||
    typeof entitlement.validUntil !== 'number' ||
    !Number.isFinite(entitlement.validUntil)
  ) {
    return null;
  }

  for (const key of ['mcpAccess', 'dataExport']) {
    if (
      features[key] !== undefined &&
      typeof features[key] !== 'boolean'
    ) {
      return null;
    }
  }

  if (
    features.apiDailyAllowance !== undefined &&
    !Number.isInteger(features.apiDailyAllowance)
  ) {
    return null;
  }

  if (!validPlanLimits(features.planLimits)) {
    return null;
  }

  return entitlement;
}

function subjectHash(subjectId) {
  return createHash('sha256')
    .update(subjectId)
    .digest('base64url');
}

export function createRedisCommand(config, fetchImplementation = fetch) {
  return async (command) => {
    if (!config.redisUrl || !config.redisToken) {
      throw new Error('Redis REST is not configured');
    }

    const response = await fetchImplementation(config.redisUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(3_000),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.error) {
      throw new Error('Redis REST command failed');
    }

    return payload?.result;
  };
}

async function writeAuditEvent({
  redisCommand,
  config,
  requestId,
  subjectDigest,
  decision,
  planKey,
}) {
  const event = {
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    requestId,
    subjectHash: subjectDigest,
    decision,
    ...(planKey ? { planKey } : {}),
  };

  const canonical = JSON.stringify(event);
  const integrity = createHmac('sha256', config.auditHmacKey)
    .update(canonical)
    .digest('base64url');

  const signedEvent = JSON.stringify({
    ...event,
    integrity: {
      algorithm: 'HMAC-SHA-256',
      value: integrity,
    },
  });

  await redisCommand([
    'RPUSH',
    config.auditKey,
    signedEvent,
  ]);

  await redisCommand([
    'LTRIM',
    config.auditKey,
    String(-MAX_AUDIT_EVENTS),
    '-1',
  ]);
}

export function createEntitlementServer(options = {}) {
  const config =
    options.config ?? readServiceConfig(options.environment);

  const redisCommand =
    options.redisCommand ?? createRedisCommand(config);

  const now = options.now ?? (() => Date.now());

  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const pathname = new URL(
      request.url ?? '/',
      'http://localhost',
    ).pathname;

    if (
      request.method === 'GET' &&
      pathname === '/health/live'
    ) {
      sendJson(response, 200, {
        status: 'live',
        service: 'vista-entitlement-service',
      });
      return;
    }

    if (
      request.method === 'GET' &&
      pathname === '/health/ready'
    ) {
      if (!config.configured) {
        sendJson(response, 503, {
          status: 'not-ready',
          reason: 'configuration',
        });
        return;
      }

      try {
        const pong = await redisCommand(['PING']);

        if (pong !== 'PONG') {
          throw new Error('unexpected Redis response');
        }

        sendJson(response, 200, {
          status: 'ready',
          service: 'vista-entitlement-service',
        });
      } catch {
        sendJson(response, 503, {
          status: 'not-ready',
          reason: 'data-tier',
        });
      }

      return;
    }

    if (
      request.method !== 'POST' ||
      pathname !== '/v1/entitlements/resolve'
    ) {
      sendJson(response, 404, {
        error: 'not_found',
        requestId,
      });
      return;
    }

    if (!config.configured) {
      sendJson(response, 503, {
        error: 'service_unavailable',
        requestId,
      });
      return;
    }

    const suppliedToken = bearerToken(request);

    if (
      !suppliedToken ||
      !secureEquals(suppliedToken, config.serviceToken)
    ) {
      sendJson(response, 401, {
        error: 'unauthorized',
        requestId,
      });
      return;
    }

    if (
      !request.headers['content-type']
        ?.toLowerCase()
        .startsWith('application/json')
    ) {
      sendJson(response, 415, {
        error: 'unsupported_media_type',
        requestId,
      });
      return;
    }

    let body;

    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, error.statusCode ?? 400, {
        error: 'invalid_request',
        requestId,
      });
      return;
    }

    const subjectId =
      typeof body?.subjectId === 'string'
        ? body.subjectId.trim()
        : '';

    if (
      !subjectId ||
      subjectId.length > 256 ||
      /[\u0000-\u001f\u007f]/.test(subjectId)
    ) {
      sendJson(response, 400, {
        error: 'invalid_subject',
        requestId,
      });
      return;
    }

    const digest = subjectHash(subjectId);
    const recordKey = `${config.keyPrefix}:subject:${digest}`;

    try {
      const rawRecord = await redisCommand(['GET', recordKey]);

      if (rawRecord === null || rawRecord === undefined) {
        await writeAuditEvent({
          redisCommand,
          config,
          requestId,
          subjectDigest: digest,
          decision: 'not-found',
        });

        sendJson(response, 404, {
          error: 'entitlement_not_found',
          requestId,
        });
        return;
      }

      let parsed;

      try {
        parsed = JSON.parse(rawRecord);
      } catch {
        throw new Error('invalid entitlement JSON');
      }

      const entitlement = validateEntitlementRecord(parsed);

      if (!entitlement) {
        throw new Error('invalid entitlement record');
      }

      if (entitlement.validUntil <= now()) {
        await writeAuditEvent({
          redisCommand,
          config,
          requestId,
          subjectDigest: digest,
          decision: 'expired',
          planKey: entitlement.planKey,
        });

        sendJson(response, 404, {
          error: 'entitlement_expired',
          requestId,
        });
        return;
      }

      await writeAuditEvent({
        redisCommand,
        config,
        requestId,
        subjectDigest: digest,
        decision: 'allow',
        planKey: entitlement.planKey,
      });

      sendJson(response, 200, {
        entitlements: entitlement,
        requestId,
      });
    } catch {
      sendJson(response, 503, {
        error: 'service_unavailable',
        requestId,
      });
    }
  });
}

export function startEntitlementServer(environment = process.env) {
  const config = readServiceConfig(environment);
  const server = createEntitlementServer({ config });

  server.listen(config.port, '0.0.0.0', () => {
    console.log(JSON.stringify({
      event: 'service_started',
      service: 'vista-entitlement-service',
      port: config.port,
      configured: config.configured,
    }));
  });

  return server;
}

const executedDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  startEntitlementServer();
}
