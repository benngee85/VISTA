import { subscribeAuthState, type AuthSession } from '@/services/auth-state';
import {
  getAuthProviderMode,
  getAuthConfig,
} from '@/services/auth-config';
import {
  mountProviderUserButton,
  openProviderRegistration,
  openProviderSignIn,
} from '@/services/auth-provider';
import { t } from '@/services/i18n';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';

export class AuthHeaderWidget {
  private container: HTMLElement;
  private unsubscribeAuth: (() => void) | null = null;
  private unmountUserButton: (() => void) | null = null;
  private onSignInClick?: () => void;
  private onSettingsClick?: () => void;
  private onBillingClick?: () => void;

  constructor(
    onSignInClick?: () => void,
    onSettingsClick?: () => void,
    onBillingClick?: () => void,
  ) {
    this.onSignInClick = onSignInClick;
    this.onSettingsClick = onSettingsClick;
    this.onBillingClick = onBillingClick;
    this.container = document.createElement('div');
    this.container.className = 'auth-header-widget';

    if (getAuthProviderMode() === 'disabled') {
      this.renderDisabled();
      return;
    }

    this.unsubscribeAuth = subscribeAuthState((state: AuthSession) => {
      if (state.isPending) {
        this.renderPending();
        return;
      }

      this.render(state);
    });
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public destroy(): void {
    this.unmountUserButton?.();
    this.unmountUserButton = null;

    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
  }

  private clear(): void {
    this.unmountUserButton?.();
    this.unmountUserButton = null;
    this.container.classList.remove('auth-header-widget-pending');
    this.container.removeAttribute('aria-busy');
    setTrustedHtml(
      this.container,
      trustedHtml('', 'authentication header rerender'),
    );
  }

  private renderDisabled(): void {
    this.clear();
    this.container.hidden = true;
    this.container.setAttribute('aria-hidden', 'true');
    this.container.dataset.authProvider = 'disabled';
  }

  private render(state: AuthSession): void {
    this.clear();
    this.container.hidden = false;
    this.container.removeAttribute('aria-hidden');
    this.container.dataset.authProvider = getAuthProviderMode();

    if (!state.user) {
      this.renderSignedOut();
      return;
    }

    this.renderSignedIn();
  }

  private renderPending(): void {
    this.clear();
    this.container.hidden = false;
    this.container.classList.add('auth-header-widget-pending');
    this.container.setAttribute('aria-busy', 'true');

    const signInSkeleton = document.createElement('span');
    signInSkeleton.className =
      'auth-header-skeleton auth-header-skeleton-signin';
    signInSkeleton.setAttribute('aria-hidden', 'true');
    this.container.appendChild(signInSkeleton);
  }

  private renderSignedOut(): void {
    const mode = getAuthProviderMode();

    const signInButton = document.createElement('button');
    signInButton.className = 'auth-signin-btn';

    signInButton.textContent =
      mode === 'oidc'
        ? 'Sign in with organisational account'
        : t('auth.signIn');

    signInButton.addEventListener('click', () => {
      if (this.onSignInClick && mode === 'clerk') {
        this.onSignInClick();
        return;
      }

      void openProviderSignIn();
    });

    this.container.appendChild(signInButton);

    const config = getAuthConfig();

    /*
     * FreeIPA controls account lifecycle. Do not present public registration
     * unless the selected provider explicitly enables it.
     */
    if (
      mode === 'clerk'
      || (mode === 'oidc' && config.registrationEnabled)
    ) {
      const registrationButton = document.createElement('button');
      registrationButton.className = 'auth-signup-link';
      registrationButton.textContent =
        mode === 'oidc'
          ? 'Request account'
          : t('auth.createAccount');

      registrationButton.addEventListener('click', () => {
        void openProviderRegistration();
      });

      this.container.appendChild(registrationButton);
    }
  }

  private renderSignedIn(): void {
    if (getAuthProviderMode() !== 'clerk') return;

    const userButtonElement = document.createElement('div');
    userButtonElement.className = 'auth-clerk-user-button';
    this.container.appendChild(userButtonElement);

    this.unmountUserButton = mountProviderUserButton(
      userButtonElement,
      {
        onBillingClick: this.onBillingClick,
        onSettingsClick: this.onSettingsClick,
      },
    );
  }
}
