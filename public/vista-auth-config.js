/*
 * VISTA browser authentication configuration.
 *
 * Current sovereign-local mode:
 *   authentication disabled;
 *   no Clerk SDK initialisation;
 *   no public sign-in or registration controls.
 *
 * Future target:
 *   FreeIPA -> Keycloak -> VISTA OIDC backend-for-frontend.
 *
 * This file is browser-visible. Never place client secrets, passwords,
 * Kerberos keytabs or LDAP bind credentials here.
 */
window.__VISTA_AUTH_CONFIG__ = Object.freeze({
  mode: "disabled",

  provider: "keycloak",
  protocol: "oidc",

  issuer: "https://sso.example.invalid/realms/vista",
  clientId: "vista-web",

  /*
   * Future same-origin backend-for-frontend endpoints. The VISTA server will
   * own PKCE, state, nonce, code exchange and callback validation.
   */
  loginUrl: "/auth/login",
  logoutUrl: "/auth/logout",
  redirectUri: window.location.origin + "/auth/callback",
  postLogoutRedirectUri: window.location.origin + "/",

  scopes: ["openid", "profile", "email", "groups"],

  /*
   * FreeIPA remains authoritative for identity creation and lifecycle.
   * Public self-registration remains prohibited.
   */
  registrationEnabled: false,
  accountManagementEnabled: false
});
