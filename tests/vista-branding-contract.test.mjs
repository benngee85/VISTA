import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

function trackedComposeFiles() {
  return execFileSync(
    'git',
    ['ls-files', 'docker-compose*.yml'],
    { encoding: 'utf8' },
  )
    .split(/\r?\n/)
    .filter(Boolean);
}

test('Compose runtime containers and locally-built images use VISTA names', () => {
  const files = trackedComposeFiles();

  assert.ok(files.length > 0, 'at least one Compose file must be tracked');

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');

    assert.doesNotMatch(
      source,
      /container_name:\s*["']?worldmonitor(?:[-"'\s]|$)/,
      `${file} must not retain a worldmonitor runtime container name`,
    );

    assert.doesNotMatch(
      source,
      /image:\s*["']?worldmonitor(?:[-:"'\s]|$)/,
      `${file} must not retain a locally-built worldmonitor image name`,
    );
  }
});

test('primary UI metadata identifies VISTA and MercuryLink Concepts', () => {
  const html = fs.readFileSync('index.html', 'utf8');

  assert.match(html, /<title>VISTA\b/);
  assert.match(html, /name="application-name"\s+content="VISTA"/);
  assert.match(
    html,
    /name="author"\s+content="MercuryLink Concepts"/,
  );
  assert.match(html, /"name": "VISTA"/);
  assert.match(html, /"name": "MercuryLink Concepts"/);
});

test('upstream copyright and provenance remain preserved', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  const notice = fs.readFileSync('NOTICE-VISTA.md', 'utf8');

  assert.match(
    readme,
    /Copyright \(C\) 2024-2026 Elie Habib/,
  );

  assert.match(
    notice,
    /Based on World Monitor/,
  );

  assert.match(
    notice,
    /Original author: Elie Habib/,
  );

  assert.match(
    notice,
    /GNU Affero General Public License v3\.0 only/,
  );
});

test('technical compatibility namespaces remain available', () => {
  const html = fs.readFileSync('index.html', 'utf8');

  assert.match(html, /worldmonitor-theme/);
  assert.match(html, /worldmonitor-variant/);
  assert.match(html, /https:\/\/github\.com\/koala73\/worldmonitor/);
});
