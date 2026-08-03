export type AuthProviderMode = 'disabled' | 'clerk' | 'oidc';

export interface VistaAuthRuntimeConfig {
  mode: AuthProviderMode;
  provider: string;
  protocol: 'oidc' | 'clerk' | 'none';
  issuer: string;
  clientId: string;
  loginUrl: string;
  logoutUrl: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: readonly string[];
  registrationEnabled: boolean;
  accountManagementEnabled: boolean;
}

declare global {
  interface Window {
    __VISTA_AUTH_CONFIG__?: Partial<VistaAuthRuntimeConfig>;
  }
}

const DEFAULT_CONFIG: VistaAuthRuntimeConfig = {
  mode: 'disabled',
  provider: 'none',
  protocol: 'none',
  issuer: '',
  clientId: '',
  loginUrl: '',
  logoutUrl: '',
  redirectUri: '',
  postLogoutRedirectUri: '',
  scopes: ['openid', 'profile', 'email', 'groups'],
  registrationEnabled: false,
  accountManagementEnabled: false,
};

function normalizeMode(value: unknown): AuthProviderMode {
  return value === 'clerk' || value === 'oidc' || value === 'disabled'
    ? value
    : 'disabled';
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return DEFAULT_CONFIG.scopes;

  const scopes = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return scopes.length > 0 ? scopes : DEFAULT_CONFIG.scopes;
}

function readRuntimeConfig(): VistaAuthRuntimeConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  const source = window.__VISTA_AUTH_CONFIG__ ?? {};
  const mode = normalizeMode(source.mode);

  return Object.freeze({
    mode,
    provider:
      stringValue(source.provider)
      || (mode === 'oidc' ? 'keycloak' : mode === 'clerk' ? 'clerk' : 'none'),
    protocol:
      mode === 'oidc'
        ? 'oidc'
        : mode === 'clerk'
          ? 'clerk'
          : 'none',
    issuer: stringValue(source.issuer),
    clientId: stringValue(source.clientId),
    loginUrl: stringValue(source.loginUrl),
    logoutUrl: stringValue(source.logoutUrl),
    redirectUri:
      stringValue(source.redirectUri)
      || `${window.location.origin}/auth/callback`,
    postLogoutRedirectUri:
      stringValue(source.postLogoutRedirectUri)
      || `${window.location.origin}/`,
    scopes: stringArray(source.scopes),
    registrationEnabled: booleanValue(
      source.registrationEnabled,
      false,
    ),
    accountManagementEnabled: booleanValue(
      source.accountManagementEnabled,
      false,
    ),
  });
}

let cachedConfig: VistaAuthRuntimeConfig | null = null;

export function getAuthConfig(): VistaAuthRuntimeConfig {
  cachedConfig ??= readRuntimeConfig();
  return cachedConfig;
}

export function getAuthProviderMode(): AuthProviderMode {
  return getAuthConfig().mode;
}

export function isAuthenticationEnabled(): boolean {
  return getAuthProviderMode() !== 'disabled';
}

export function isClerkProvider(): boolean {
  return getAuthProviderMode() === 'clerk';
}

export function isOidcProvider(): boolean {
  return getAuthProviderMode() === 'oidc';
}

export function resetAuthConfigForTests(): void {
  cachedConfig = null;
}
