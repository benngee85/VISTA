import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const gateway = fs.readFileSync(
  new URL('../server/gateway.ts', import.meta.url),
  'utf8',
);

test('cookie-authenticated enterprise credentials bypass endpoint entitlement checks', () => {
  assert.match(
    gateway,
    /const isEnterpriseAuth\s*=\s*keyCheck\.valid\s*&&\s*!isUserApiKey\s*&&\s*keyCheck\.kind === 'enterprise';/s,
  );

  assert.doesNotMatch(
    gateway,
    /const isEnterpriseAuth\s*=\s*keyCheck\.valid\s*&&\s*wmKey\s*&&/,
  );
});

test('enterprise telemetry does not require exposing an HttpOnly cookie as a header', () => {
  assert.match(
    gateway,
    /if \(keyCheck\.valid && !isUserApiKey && keyCheck\.kind === 'enterprise'\)/,
  );

  assert.match(
    gateway,
    /if \(wmKey\) \{\s*usage\.enterpriseApiKey = wmKey;/s,
  );

  assert.doesNotMatch(
    gateway,
    /if \(keyCheck\.valid && wmKey && !isUserApiKey && keyCheck\.kind === 'enterprise'\)/,
  );
});
