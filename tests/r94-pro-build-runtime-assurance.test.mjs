import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(
  fs.readFileSync(
    new URL(
      '../package.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

const buildGuard = fs.readFileSync(
  new URL(
    '../scripts/check-pro-build-cleanliness.mjs',
    import.meta.url,
  ),
  'utf8',
);

const runtimeSmoke = fs.readFileSync(
  new URL(
    '../scripts/runtime-smoke.mjs',
    import.meta.url,
  ),
  'utf8',
);

test(
  'package scripts expose PRO build assurance',
  () => {
    assert.equal(
      packageJson.scripts['build:pro:clean-check'],
      'node scripts/check-pro-build-cleanliness.mjs',
    );

    assert.equal(
      packageJson.scripts['smoke:runtime'],
      'node scripts/runtime-smoke.mjs',
    );
  },
);

test(
  'cleanliness guard executes build:pro',
  () => {
    assert.match(
      buildGuard,
      /'build:pro'/u,
    );

    assert.doesNotMatch(
      buildGuard,
      /\[\s*'run',\s*'build'\s*\]/u,
    );

    assert.match(
      buildGuard,
      /--untracked-files=no/u,
    );

    assert.match(
      buildGuard,
      /modified tracked repository files/u,
    );
  },
);

test(
  'runtime smoke validates protected endpoints',
  () => {
    assert.match(
      runtimeSmoke,
      /\/api\/health/u,
    );

    assert.match(
      runtimeSmoke,
      /\/api\/seed-health/u,
    );

    assert.match(
      runtimeSmoke,
      /response\.status !== 401/u,
    );

    assert.match(
      runtimeSmoke,
      /response\.status !== 403/u,
    );
  },
);

test(
  'runtime smoke validates Docker health and restarts',
  () => {
    assert.match(
      runtimeSmoke,
      /docker[\s\S]*compose[\s\S]*ps/u,
    );

    assert.match(
      runtimeSmoke,
      /health !== 'healthy'/u,
    );

    assert.match(
      runtimeSmoke,
      /restartCount !== 0/u,
    );
  },
);
