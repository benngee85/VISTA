#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function gitOutput(args) {
  const result = run('git', args, {
    capture: true,
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || '');
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

function trackedStatus() {
  return gitOutput([
    'status',
    '--porcelain',
    '--untracked-files=no',
  ]).trim();
}

const initialStatus = trackedStatus();

if (initialStatus) {
  console.error(
    'Refusing PRO build cleanliness check because tracked files are already modified.',
  );
  console.error(initialStatus);
  process.exit(1);
}

const build = run(
  'npm',
  [
    'run',
    'build:pro',
  ],
);

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const finalStatus = trackedStatus();

if (finalStatus) {
  console.error(
    'npm run build:pro modified tracked repository files.',
  );
  console.error(finalStatus);

  const diff = gitOutput([
    'diff',
    '--',
  ]);

  if (diff) {
    console.error(diff);
  }

  process.exit(1);
}

console.log(
  'build:pro cleanliness: PASS - tracked repository files unchanged.',
);
