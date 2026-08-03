import { enqueueSentryCall } from '@/bootstrap/sentry-defer';
import { getAuthProviderMode } from './auth-config';
import {
  getCurrentProviderUserSync,
  initializeAuthProvider,
  subscribeAuthProvider,
} from './auth-provider';

/** Minimal user profile exposed to UI components. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: 'free' | 'pro';
}

/** Simplified auth session state for UI consumption. */
export interface AuthSession {
  user: AuthUser | null;
  isPending: boolean;
}

let _currentSession: AuthSession = {
  user: null,
  isPending: getAuthProviderMode() === 'clerk',
};

function snapshotSession(): AuthSession {
  const providerUser = getCurrentProviderUserSync();

  if (!providerUser) {
    enqueueSentryCall((s) => s.setUser(null));
    return { user: null, isPending: false };
  }

  enqueueSentryCall((s) => s.setUser({ id: providerUser.id }));

  return {
    user: {
      id: providerUser.id,
      name: providerUser.name,
      email: providerUser.email,
      image: providerUser.image,
      role: providerUser.plan,
    },
    isPending: false,
  };
}

/**
 * Initialise the selected authentication provider.
 *
 * Disabled and OIDC-placeholder modes settle anonymously without importing
 * Clerk. Clerk is dynamically loaded only when the runtime provider is
 * explicitly set to "clerk".
 */
export async function initAuthState(): Promise<void> {
  const mode = getAuthProviderMode();

  if (mode !== 'clerk') {
    _currentSession = { user: null, isPending: false };
    enqueueSentryCall((s) => s.setUser(null));
    return;
  }

  await initializeAuthProvider();
}

/**
 * Subscribe to reactive authentication state changes.
 */
export function subscribeAuthState(
  callback: (state: AuthSession) => void,
): () => void {
  callback(_currentSession);

  if (getAuthProviderMode() !== 'clerk') {
    return () => {};
  }

  return subscribeAuthProvider(() => {
    _currentSession = snapshotSession();
    callback(_currentSession);
  });
}

/** Synchronous snapshot of current authentication state. */
export function getAuthState(): AuthSession {
  return _currentSession;
}
