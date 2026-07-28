/**
 * Sovereign entitlement-provider transport.
 *
 * This module does not grant capabilities itself. It resolves entitlement
 * assertions from an independently operated sovereign service and validates
 * their shape before returning them to the canonical gateway gates.
 *
 * Hosted deployments retain the existing Redis/Convex path. Sovereign
 * deployments fail closed when this provider is absent, misconfigured,
 * unreachable, or returns an invalid assertion.
 */

import type { CachedEntitlements } from './entitlement-check';

export type EntitlementProviderMode =
  | 'hosted'
  | 'sovereign-http'
  | 'misconfigured';

export type SovereignEntitlementLookupResult =
  | {
      kind: 'found';
      entitlements: CachedEntitlements;
    }
  | {
      kind: 'not-found';
    }
  | {
      kind: 'unavailable';
    }
  | {
      kind: 'misconfigured';
    };

interface SovereignProviderConfig {
  endpoint: URL;
  token: string;
  timeoutMs: number;
}

const MAX_RESPONSE_BYTES = 65_536;
const DEFAULT_TIMEOUT_MS = 3_000;
const MIN_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 10_000;

function normalizedEnvironmentValue(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function getEntitlementProviderMode(): EntitlementProviderMode {
  const profile = normalizedEnvironmentValue(
    process.env.VISTA_DEPLOYMENT_PROFILE,
  );
  const provider = normalizedEnvironmentValue(
    process.env.VISTA_ENTITLEMENT_PROVIDER,
  );

  if (!profile || profile === 'hosted') {
    return !provider || provider === 'hosted'
      ? 'hosted'
      : 'misconfigured';
  }

  if (profile !== 'sovereign') {
    return 'misconfigured';
  }

  return provider === 'sovereign-http'
    ? 'sovereign-http'
    : 'misconfigured';
}

function parseTimeoutMs(raw: string | undefined): number {
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.max(
    MIN_TIMEOUT_MS,
    Math.min(MAX_TIMEOUT_MS, Math.trunc(parsed)),
  );
}

function getProviderConfig(): SovereignProviderConfig | null {
  if (getEntitlementProviderMode() !== 'sovereign-http') {
    return null;
  }

  const rawUrl = process.env.VISTA_ENTITLEMENT_PROVIDER_URL?.trim() ?? '';
  const token = process.env.VISTA_ENTITLEMENT_PROVIDER_TOKEN?.trim() ?? '';

  if (!rawUrl || !token) {
    return null;
  }

  let baseUrl: URL;

  try {
    baseUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  if (baseUrl.username || baseUrl.password || baseUrl.hash) {
    return null;
  }

  const allowInsecureHttp =
    process.env.VISTA_ENTITLEMENT_ALLOW_INSECURE_HTTP === 'true';

  if (
    baseUrl.protocol !== 'https:' &&
    !(baseUrl.protocol === 'http:' && allowInsecureHttp)
  ) {
    return null;
  }

  const basePath = baseUrl.pathname.endsWith('/')
    ? baseUrl.pathname
    : `${baseUrl.pathname}/`;

  baseUrl.pathname = basePath;

  return {
    endpoint: new URL('v1/entitlements/resolve', baseUrl),
    token,
    timeoutMs: parseTimeoutMs(
      process.env.VISTA_ENTITLEMENT_PROVIDER_TIMEOUT_MS,
    ),
  };
}

export function isSovereignEntitlementProviderConfigured(): boolean {
  return getProviderConfig() !== null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string');
}

function hasValidPlanLimits(value: unknown): boolean {
  if (value === undefined) return true;

  const limits = asRecord(value);
  if (!limits) return false;

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

function parseEntitlements(value: unknown): CachedEntitlements | null {
  const entitlement = asRecord(value);
  const features = asRecord(entitlement?.features);

  if (!entitlement || !features) return null;

  if (
    typeof entitlement.planKey !== 'string' ||
    entitlement.planKey.length < 1 ||
    entitlement.planKey.length > 128
  ) {
    return null;
  }

  if (
    !isNonNegativeInteger(features.tier) ||
    Number(features.tier) > 100 ||
    !isBoolean(features.apiAccess) ||
    !isFiniteNumber(features.apiRateLimit) ||
    Number(features.apiRateLimit) < 0 ||
    !isNonNegativeInteger(features.maxDashboards) ||
    !isBoolean(features.prioritySupport) ||
    !isStringArray(features.exportFormats) ||
    !isFiniteNumber(entitlement.validUntil)
  ) {
    return null;
  }

  for (const key of ['mcpAccess', 'dataExport']) {
    if (
      features[key] !== undefined &&
      !isBoolean(features[key])
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

  if (!hasValidPlanLimits(features.planLimits)) {
    return null;
  }

  const billingStatus = entitlement.billingStatus;

  if (
    billingStatus !== undefined &&
    billingStatus !== 'subscription_lapsed' &&
    billingStatus !== 'renewal_verification_pending' &&
    billingStatus !== 'renewal_verification_failed'
  ) {
    return null;
  }

  return entitlement as unknown as CachedEntitlements;
}

export async function resolveSovereignEntitlements(
  subjectId: string,
): Promise<SovereignEntitlementLookupResult> {
  const config = getProviderConfig();

  if (!config || !subjectId.trim()) {
    return { kind: 'misconfigured' };
  }

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'vista-sovereign-gateway/1.0',
      },
      body: JSON.stringify({
        subjectId,
        requestedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (response.status === 404) {
      return { kind: 'not-found' };
    }

    if (
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      return { kind: 'unavailable' };
    }

    if (!response.ok) {
      return { kind: 'misconfigured' };
    }

    const text = await response.text();

    if (text.length > MAX_RESPONSE_BYTES) {
      return { kind: 'misconfigured' };
    }

    let payload: unknown;

    try {
      payload = JSON.parse(text);
    } catch {
      return { kind: 'misconfigured' };
    }

    const envelope = asRecord(payload);
    const entitlements = parseEntitlements(
      envelope?.entitlements ?? payload,
    );

    return entitlements
      ? { kind: 'found', entitlements }
      : { kind: 'misconfigured' };
  } catch {
    return { kind: 'unavailable' };
  }
}
