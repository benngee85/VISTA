import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dockerfiles = [
  'Dockerfile',
  'Dockerfile.relay',
  'docker/Dockerfile.redis-rest',
];

test('application runtime images remove the complete Corepack installation', () => {
  for (const file of dockerfiles) {
    const source = readFileSync(file, 'utf8');

    assert.match(
      source,
      /\/usr\/local\/lib\/node_modules\/corepack/,
      `${file} must remove the Corepack package directory`,
    );

    assert.match(
      source,
      /\/usr\/local\/bin\/corepack/,
      `${file} must remove the Corepack executable link`,
    );
  }
});

test('relay runtime removes build and TypeScript execution tooling', () => {
  const source = readFileSync('Dockerfile.relay', 'utf8');

  assert.match(
    source,
    /npm uninstall --prefix scripts[^\n]*exceljs tsx/,
    'relay image must uninstall exceljs and tsx after resolving runtime dependencies',
  );

  assert.match(
    source,
    /test ! -d \/app\/scripts\/node_modules\/tsx/,
    'relay build must fail if tsx remains in the runtime dependency tree',
  );

  assert.doesNotMatch(
    source,
    /(?:CMD|ENTRYPOINT)[^\n]*(?:tsx|npm|npx|corepack)/,
    'relay runtime command must execute directly with Node',
  );
});

test('scripts toolchain uses the maintained tsx registerHooks line', () => {
  const manifest = JSON.parse(readFileSync('scripts/package.json', 'utf8'));
  assert.equal(manifest.dependencies?.tsx, '^4.23.1');
});
