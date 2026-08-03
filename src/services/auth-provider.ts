import {
  getAuthConfig,
  getAuthProviderMode,
  type AuthProviderMode,
} from './auth-config';

export interface ProviderUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  plan: 'free' | 'pro';
}

interface UserButtonOptions {
  onBillingClick?: () => void;
  onSettingsClick?: () => void;
}

type ClerkModule = typeof import('./clerk');

let clerkModule: ClerkModule | null = null;
let clerkLoadPromise: Promise<ClerkModule> | null = null;

function loadClerk(): Promise<ClerkModule> {
  if (clerkModule) return Promise.resolve(clerkModule);

  clerkLoadPromise ??= import('./clerk').then((module) => {
    clerkModule = module;
    return module;
  });

  return clerkLoadPromise;
}

function resolveOidcLoginUrl(): string {
  const config = getAuthConfig();

  if (config.loginUrl) return config.loginUrl;

  /*
   * Prefer a same-origin backend-for-frontend route. This avoids exposing
   * client secrets and leaves PKCE, state, nonce and callback validation to
   * the future VISTA OIDC adapter.
   */
  return '/auth/login';
}

export function getProviderMode(): AuthProviderMode {
  return getAuthProviderMode();
}

export async function initializeAuthProvider(): Promise<void> {
  const mode = getProviderMode();

  if (mode !== 'clerk') return;

  const clerk = await loadClerk();

  if (!clerk.isClerkAuthEnabled()) return;

  clerk.scheduleClerkLoad();
}

export async function getCurrentProviderUser(): Promise<ProviderUser | null> {
  if (getProviderMode() !== 'clerk') return null;

  const clerk = await loadClerk();
  return clerk.getCurrentClerkUser();
}

export function getCurrentProviderUserSync(): ProviderUser | null {
  if (getProviderMode() !== 'clerk' || !clerkModule) return null;
  return clerkModule.getCurrentClerkUser();
}

export function subscribeAuthProvider(
  callback: () => void,
): () => void {
  let active = true;
  let unsubscribe: (() => void) | null = null;

  if (getProviderMode() !== 'clerk') {
    return () => {
      active = false;
    };
  }

  void loadClerk()
    .then((clerk) => {
      if (!active) return;
      unsubscribe = clerk.subscribeClerk(callback);
      callback();
    })
    .catch((error) => {
      console.error('[auth-provider] Clerk subscription failed:', error);
      if (active) callback();
    });

  return () => {
    active = false;
    unsubscribe?.();
    unsubscribe = null;
  };
}

export async function openProviderSignIn(): Promise<void> {
  const mode = getProviderMode();

  if (mode === 'disabled') return;

  if (mode === 'oidc') {
    window.location.assign(resolveOidcLoginUrl());
    return;
  }

  const clerk = await loadClerk();
  clerk.openSignIn();
}

export async function openProviderRegistration(): Promise<void> {
  const mode = getProviderMode();
  const config = getAuthConfig();

  if (mode === 'disabled') return;

  if (mode === 'oidc') {
    /*
     * Organisational identity lifecycle remains in FreeIPA. Public account
     * registration is intentionally unavailable.
     */
    if (!config.registrationEnabled) {
      window.location.assign(resolveOidcLoginUrl());
      return;
    }

    window.location.assign(
      config.loginUrl
        ? `${config.loginUrl}${config.loginUrl.includes('?') ? '&' : '?'}screen_hint=signup`
        : '/auth/login?screen_hint=signup',
    );
    return;
  }

  const clerk = await loadClerk();
  clerk.openSignUp();
}

export function mountProviderUserButton(
  element: HTMLDivElement,
  options: UserButtonOptions = {},
): () => void {
  const mode = getProviderMode();

  if (mode !== 'clerk') return () => {};

  let active = true;
  let unmount: (() => void) | null = null;

  void loadClerk()
    .then((clerk) => {
      if (!active) return;
      unmount = clerk.mountUserButton(element, options);
    })
    .catch((error) => {
      console.error('[auth-provider] User button mount failed:', error);
    });

  return () => {
    active = false;
    unmount?.();
    unmount = null;
  };
}
