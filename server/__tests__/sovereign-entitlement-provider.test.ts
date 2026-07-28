// @vitest-environment node

import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  getEntitlementProviderMode,
  isSovereignEntitlementProviderConfigured,
  resolveSovereignEntitlements,
} from '../_shared/sovereign-entitlement-provider';

const ENVIRONMENT_KEYS = [
  'VISTA_DEPLOYMENT_PROFILE',
  'VISTA_ENTITLEMENT_PROVIDER',
  'VISTA_ENTITLEMENT_PROVIDER_URL',
  'VISTA_ENTITLEMENT_PROVIDER_TOKEN',
  'VISTA_ENTITLEMENT_PROVIDER_TIMEOUT_MS',
  'VISTA_ENTITLEMENT_ALLOW_INSECURE_HTTP',
] as const;

const originalEnvironment = new Map(
  ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
);

function configureSovereignProvider(): void {
  process.env.VISTA_DEPLOYMENT_PROFILE = 'sovereign';
  process.env.VISTA_ENTITLEMENT_PROVIDER = 'sovereign-http';
  process.env.VISTA_ENTITLEMENT_PROVIDER_URL =
    'https://entitlements.internal.example/';
  process.env.VISTA_ENTITLEMENT_PROVIDER_TOKEN = 'test-token';
}

function validEntitlements() {
  return {
    planKey: 'sovereign-analyst',
    features: {
      tier: 1,
      apiAccess: true,
      apiRateLimit: 60,
      maxDashboards: 25,
      prioritySupport: false,
      exportFormats: ['csv', 'json', 'pdf'],
      mcpAccess: true,
      dataExport: true,
      planLimits: {
        apiRequestsPerDay: null,
        apiBurstRequestsPerMinute: 300,
        mcpCallsPerDay: null,
        mcpBurstRequestsPerMinute: 120,
      },
    },
    validUntil: Date.now() + 60_000,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();

  for (const key of ENVIRONMENT_KEYS) {
    const value = originalEnvironment.get(key);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('sovereign entitlement provider configuration', () => {
  test('preserves hosted mode by default', () => {
    for (const key of ENVIRONMENT_KEYS) {
      delete process.env[key];
    }

    expect(getEntitlementProviderMode()).toBe('hosted');
  });

  test('requires an explicit sovereign provider', () => {
    process.env.VISTA_DEPLOYMENT_PROFILE = 'sovereign';
    delete process.env.VISTA_ENTITLEMENT_PROVIDER;

    expect(getEntitlementProviderMode()).toBe('misconfigured');
  });

  test('rejects insecure HTTP unless explicitly enabled', () => {
    configureSovereignProvider();
    process.env.VISTA_ENTITLEMENT_PROVIDER_URL =
      'http://vista-entitlements:8080/';

    expect(isSovereignEntitlementProviderConfigured()).toBe(false);

    process.env.VISTA_ENTITLEMENT_ALLOW_INSECURE_HTTP = 'true';

    expect(isSovereignEntitlementProviderConfigured()).toBe(true);
  });
});

describe('sovereign entitlement lookup', () => {
  test('returns a validated entitlement assertion', async () => {
    configureSovereignProvider();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            entitlements: validEntitlements(),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      ),
    );

    const result = await resolveSovereignEntitlements('subject-1');

    expect(result.kind).toBe('found');

    if (result.kind === 'found') {
      expect(result.entitlements.planKey).toBe('sovereign-analyst');
      expect(result.entitlements.features.tier).toBe(1);
    }

    const request = vi.mocked(fetch).mock.calls[0];

    expect(request?.[0].toString()).toBe(
      'https://entitlements.internal.example/v1/entitlements/resolve',
    );

    const headers = new Headers(request?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-token');
  });

  test('treats an unknown subject as a confirmed absence', async () => {
    configureSovereignProvider();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, { status: 404 }),
      ),
    );

    await expect(
      resolveSovereignEntitlements('unknown-subject'),
    ).resolves.toEqual({ kind: 'not-found' });
  });

  test('treats provider failure as transient unavailability', async () => {
    configureSovereignProvider();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, { status: 503 }),
      ),
    );

    await expect(
      resolveSovereignEntitlements('subject-1'),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  test('rejects malformed capability assertions', async () => {
    configureSovereignProvider();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            entitlements: {
              ...validEntitlements(),
              features: {
                ...validEntitlements().features,
                tier: 'enterprise',
              },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      resolveSovereignEntitlements('subject-1'),
    ).resolves.toEqual({ kind: 'misconfigured' });
  });
});
