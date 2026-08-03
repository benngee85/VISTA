import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('runtime auth defaults to disabled and forbids browser secrets', () => {
  const source = fs.readFileSync(
    new URL('../public/vista-auth-config.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /mode:\s*"disabled"/);
  assert.match(source, /registrationEnabled:\s*false/);
  assert.doesNotMatch(
    source,
    /(clientSecret|bindPassword|ldapPassword|keytab)\s*:/i,
  );
});

test('header renders nothing when authentication is disabled', () => {
  const source = fs.readFileSync(
    new URL('../src/components/AuthHeaderWidget.ts', import.meta.url),
    'utf8',
  );

  assert.match(
    source,
    /getAuthProviderMode\(\)\s*===\s*'disabled'/,
  );
  assert.match(source, /this\.container\.hidden\s*=\s*true/);
  assert.match(
    source,
    /Sign in with organisational account/,
  );
});

test('authentication state no longer statically imports Clerk', () => {
  const source = fs.readFileSync(
    new URL('../src/services/auth-state.ts', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(
    source,
    /from\s+['"]\.\/clerk['"]/,
  );
});

test('provider dynamically imports Clerk only for Clerk mode', () => {
  const source = fs.readFileSync(
    new URL('../src/services/auth-provider.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /import\('\.\/clerk'\)/);
  assert.match(source, /mode\s*!==\s*'clerk'/);
});
