#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const baseUrl = (
  process.env.VISTA_SMOKE_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/u, '');

const timeoutMs = Number(
  process.env.VISTA_SMOKE_TIMEOUT_MS ||
  '15000',
);

if (
  !Number.isSafeInteger(timeoutMs) ||
  timeoutMs < 1
) {
  throw new Error(
    'VISTA_SMOKE_TIMEOUT_MS must be a positive integer',
  );
}

async function fetchWithTimeout(path) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    return await fetch(
      `${baseUrl}${path}`,
      {
        redirect: 'follow',
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function inspectContainers() {
  const compose = spawnSync(
    'docker',
    [
      'compose',
      'ps',
      '-q',
    ],
    {
      encoding: 'utf8',
    },
  );

  if (compose.error) {
    throw compose.error;
  }

  if (compose.status !== 0) {
    throw new Error(
      compose.stderr ||
      'docker compose ps failed',
    );
  }

  const ids = compose.stdout
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error(
      'docker compose returned no running containers',
    );
  }

  const failures = [];

  for (const id of ids) {
    const inspect = spawnSync(
      'docker',
      [
        'inspect',
        '--format',
        '{{.Name}}\t{{.State.Status}}\t{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}\t{{.RestartCount}}',
        id,
      ],
      {
        encoding: 'utf8',
      },
    );

    if (inspect.status !== 0) {
      failures.push(
        inspect.stderr ||
        `could not inspect ${id}`,
      );
      continue;
    }

    const [
      rawName,
      state,
      health,
      restartText,
    ] = inspect.stdout
      .trim()
      .split('\t');

    const name = rawName.replace(/^\//u, '');
    const restartCount = Number(restartText);

    console.log(
      `${name}: state=${state}, health=${health}, restarts=${restartCount}`,
    );

    if (state !== 'running') {
      failures.push(
        `${name}: state=${state}`,
      );
    }

    if (
      health !== 'healthy' &&
      health !== 'none'
    ) {
      failures.push(
        `${name}: health=${health}`,
      );
    }

    if (
      !Number.isSafeInteger(restartCount) ||
      restartCount !== 0
    ) {
      failures.push(
        `${name}: restarts=${restartText}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      [
        'runtime container validation failed:',
        ...failures,
      ].join('\n'),
    );
  }
}

async function main() {
  const root = await fetchWithTimeout('/');

  if (root.status !== 200) {
    throw new Error(
      `root endpoint returned HTTP ${root.status}`,
    );
  }

  console.log(
    'root endpoint: HTTP 200',
  );

  for (const path of [
    '/api/health',
    '/api/seed-health',
  ]) {
    const response = await fetchWithTimeout(path);

    if (
      response.status !== 401 &&
      response.status !== 403
    ) {
      throw new Error(
        `${path} returned HTTP ${response.status}; expected protected response 401 or 403`,
      );
    }

    console.log(
      `${path}: protected HTTP ${response.status}`,
    );
  }

  inspectContainers();

  console.log(
    'runtime-smoke: PASS',
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.stack || error.message
      : String(error),
  );

  process.exitCode = 1;
});
