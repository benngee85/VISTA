import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const session = fs.readFileSync('src/services/wm-session.ts', 'utf8');
const entitlements = fs.readFileSync('src/services/entitlements.ts', 'utf8');
const widgets = fs.readFileSync('src/services/widget-store.ts', 'utf8');

test('sovereign session capabilities are bounded and fail closed', () => {
  assert.match(session, /SOVEREIGN_SESSION_CAPABILITY_ALLOWLIST/);
  assert.match(session, /data\.premium === true/);
  assert.match(session, /data\.entitlementSource === 'sovereign-local'/);
  assert.match(session, /Array\.isArray\(data\.capabilities\)/);
  assert.match(session, /SOVEREIGN_SESSION_CAPABILITY_ALLOWLIST\.has\(candidate\)/);
});

test('sovereign session updates the reactive entitlement store', () => {
  assert.match(session, /applySovereignSessionEntitlement\(next, data\.exp \* 1000\)/);
  assert.match(entitlements, /planKey: 'sovereign-baseline'/);
  assert.match(entitlements, /notifyListeners\(currentState\)/);
  assert.match(entitlements, /capabilities\.has\('premium-widgets'\)/);
});

test('a stored expiry cannot bypass first-load entitlement hydration', () => {
  assert.match(
    session,
    /isFresh\(cached\) && wmSessionEntitlementHydrated/,
  );
  assert.match(
    session,
    /isFresh\(stored\) && wmSessionEntitlementHydrated/,
  );
  assert.match(session, /applyWmSessionEntitlement\(data\)/);
});

test('premium widget gates consume only the bounded session capability', () => {
  assert.match(
    widgets,
    /hasWmSessionCapability\('premium-widgets'\)/,
  );
});
