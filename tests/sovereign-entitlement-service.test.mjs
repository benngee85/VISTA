import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import {
  createEntitlementServer,
  readServiceConfig,
  validateEntitlementRecord,
} from '../services/sovereign-entitlements/server.mjs';

function configuredService() {
  return {
    port: 0,
    serviceToken: 'service-test-token',
    redisUrl: new URL('http://redis-rest:8080'),
    redisToken: 'redis-test-token',
    keyPrefix: 'vista:entitlements:test',
    auditKey: 'vista:audit:test',
    auditHmacKey: 'audit-test-key',
    configured: true,
  };
}

async function withServer(redisCommand, callback) {
  const server = createEntitlementServer({
    config: configuredService(),
    redisCommand,
    now: () => 1_000,
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

function entitlement(overrides = {}) {
  return {
    planKey: 'sovereign-analyst',
    features: {
      tier: 1,
      apiAccess: true,
      apiRateLimit: 60,
      maxDashboards: 25,
      prioritySupport: false,
      exportFormats: ['csv', 'json'],
      mcpAccess: true,
      dataExport: true,
      planLimits: {
        apiRequestsPerDay: null,
        apiBurstRequestsPerMinute: 300,
        mcpCallsPerDay: null,
        mcpBurstRequestsPerMinute: 120,
      },
    },
    validUntil: 10_000,
    ...overrides,
  };
}

function resolveRequest(baseUrl, body, token = 'service-test-token') {
  return fetch(`${baseUrl}/v1/entitlements/resolve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

test('live health does not disclose configuration', async () => {
  const config = readServiceConfig({});
  const server = createEntitlementServer({
    config,
    redisCommand: async () => {
      throw new Error('must not be called');
    },
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/health/live`,
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'live');
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('readiness fails closed when configuration is absent', async () => {
  const config = readServiceConfig({});
  const server = createEntitlementServer({
    config,
    redisCommand: async () => 'PONG',
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/health/ready`,
    );

    assert.equal(response.status, 503);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('resolve endpoint requires the service bearer token', async () => {
  await withServer(async () => null, async (baseUrl) => {
    const response = await resolveRequest(
      baseUrl,
      { subjectId: 'subject-1' },
      'wrong-token',
    );

    assert.equal(response.status, 401);
  });
});

test('unknown subject returns a confirmed 404 and audit event', async () => {
  const commands = [];

  await withServer(async (command) => {
    commands.push(command);

    if (command[0] === 'GET') {
      return null;
    }

    return 1;
  }, async (baseUrl) => {
    const response = await resolveRequest(baseUrl, {
      subjectId: 'subject-unknown',
    });

    assert.equal(response.status, 404);
  });

  assert.equal(commands[0][0], 'GET');
  assert.equal(commands[1][0], 'RPUSH');
  assert.equal(commands[2][0], 'LTRIM');
  assert.doesNotMatch(commands[1][2], /subject-unknown/);
});

test('valid sovereign entitlement is returned', async () => {
  const record = entitlement();

  await withServer(async (command) => {
    if (command[0] === 'GET') {
      return JSON.stringify(record);
    }

    return 1;
  }, async (baseUrl) => {
    const response = await resolveRequest(baseUrl, {
      subjectId: 'subject-1',
    });

    assert.equal(response.status, 200);

    const payload = await response.json();

    assert.equal(
      payload.entitlements.planKey,
      'sovereign-analyst',
    );
  });
});

test('expired entitlement fails closed as not found', async () => {
  const record = entitlement({ validUntil: 999 });

  await withServer(async (command) => {
    if (command[0] === 'GET') {
      return JSON.stringify(record);
    }

    return 1;
  }, async (baseUrl) => {
    const response = await resolveRequest(baseUrl, {
      subjectId: 'subject-1',
    });

    assert.equal(response.status, 404);
  });
});

test('malformed stored entitlement returns service unavailable', async () => {
  await withServer(async (command) => {
    if (command[0] === 'GET') {
      return JSON.stringify({
        planKey: 'invalid',
        features: {
          tier: 'enterprise',
        },
      });
    }

    return 1;
  }, async (baseUrl) => {
    const response = await resolveRequest(baseUrl, {
      subjectId: 'subject-1',
    });

    assert.equal(response.status, 503);
  });
});

test('record validation rejects unbounded feature shapes', () => {
  assert.equal(
    validateEntitlementRecord(
      entitlement({
        features: {
          tier: 1,
          apiAccess: true,
          apiRateLimit: 60,
          maxDashboards: 25,
          prioritySupport: false,
          exportFormats: 'all',
        },
      }),
    ),
    null,
  );
});
