import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../docker/entrypoint.sh', import.meta.url),
  'utf8',
);

test('entrypoint reconciles canonical API authority after Docker secrets', () => {
  const genericSecretImport =
    source.indexOf('if [ -d /run/secrets ]; then');

  const normalisation =
    source.indexOf('VISTA_POST_SECRET_API_AUTHORITY_NORMALISATION');

  assert.notEqual(genericSecretImport, -1);
  assert.notEqual(normalisation, -1);
  assert.ok(
    normalisation > genericSecretImport,
    'authority normalisation must run after generic Docker secret import',
  );

  assert.match(
    source,
    /WORLDMONITOR_VALID_KEYS="\$\{WORLDMONITOR_API_KEY\},\$\{WORLDMONITOR_VALID_KEYS\}"/,
  );

  assert.match(
    source,
    /export WORLDMONITOR_API_KEY/,
  );

  assert.match(
    source,
    /export WORLDMONITOR_VALID_KEYS/,
  );
});
