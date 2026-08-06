import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRemediationPlan,
  renderMarkdown,
} from '../scripts/build-sovereign-remediation-plan.mjs';

function sampleReport() {
  return {
    generatedAt: '2026-08-06T06:25:40.590Z',
    scannedFileCount: 2038,
    externalHosts: [
      {
        host: "').replace(",
        occurrences: [{ file: 'api/_relay.js', line: 10, url: "http://').replace(/" }],
      },
      {
        host: 'api.worldmonitor.app',
        occurrences: [{ file: 'src/services/cache.ts', line: 20, url: 'https://api.worldmonitor.app' }],
      },
      {
        host: 'evil.example.com',
        occurrences: [{ file: 'tests/relay.test.mjs', line: 10, url: 'https://evil.example.com' }],
      },
      {
        host: 'attack.mitre.org',
        occurrences: [{ file: 'public/data/catalog.json', line: 1, url: 'https://attack.mitre.org' }],
      },
    ],
    directAiProviderReferences: [
      {
        file: 'scripts/audit-sovereign-runtime.mjs',
        line: 62,
        match: 'grok',
        context: '/grok/giu',
      },
      {
        file: 'src/config/ai-datacenters.ts',
        line: 74,
        match: 'xAI',
        context: "name: 'xAI Colossus 2 Memphis Phase 2',",
      },
      {
        file: 'server/inference/provider.ts',
        line: 44,
        match: 'api.x.ai',
        context: "const endpoint = 'https://api.x.ai/v1';",
      },
    ],
  };
}

test('separates scanner artifacts, fixtures, non-runtime data, and runtime hosts', () => {
  const remediationPlan = buildRemediationPlan(sampleReport());
  const dispositionByHost = Object.fromEntries(
    remediationPlan.evidence.externalHosts.map((candidateItem) => [candidateItem.host, candidateItem.disposition]),
  );

  assert.equal(dispositionByHost["').replace("], 'scanner-artifact');
  assert.equal(dispositionByHost['api.worldmonitor.app'], 'runtime-dependency');
  assert.equal(dispositionByHost['evil.example.com'], 'fixture-or-example');
  assert.equal(dispositionByHost['attack.mitre.org'], 'non-runtime-reference');
  assert.equal(remediationPlan.summary.actionableHostEntries, 1);
});

test('separates auditor wording and descriptive xAI data from runtime provider endpoints', () => {
  const remediationPlan = buildRemediationPlan(sampleReport());
  const dispositions = remediationPlan.evidence.directProviderReferences
    .map((candidateItem) => candidateItem.disposition);

  assert.deepEqual(dispositions, [
    'audit-self-reference',
    'descriptive-data',
    'runtime-provider-endpoint',
  ]);
  assert.equal(remediationPlan.summary.actionableDirectProviderEntries, 1);
});


test('classifies Tauri schema, signing timestamp, and embedded media hosts by lifecycle', () => {
  const remediationPlan = buildRemediationPlan({
    externalHosts: [
      {
        host: 'schema.tauri.app',
        occurrences: [{ file: 'src-tauri/tauri.conf.json', line: 2 }],
      },
      {
        host: 'timestamp.digicert.com',
        occurrences: [{ file: 'src-tauri/tauri.conf.json', line: 62 }],
      },
      {
        host: 'www.youtube-nocookie.com',
        occurrences: [{ file: 'src-tauri/tauri.conf.json', line: 32 }],
      },
    ],
    directAiProviderReferences: [],
  });
  const dispositionByHost = Object.fromEntries(
    remediationPlan.evidence.externalHosts.map((candidateItem) => [candidateItem.host, candidateItem.disposition]),
  );

  assert.equal(dispositionByHost['schema.tauri.app'], 'config-schema-reference');
  assert.equal(dispositionByHost['timestamp.digicert.com'], 'build-time-dependency');
  assert.equal(dispositionByHost['www.youtube-nocookie.com'], 'runtime-dependency');
  assert.equal(remediationPlan.summary.actionableHostEntries, 1);
  assert.equal(remediationPlan.summary.hostDispositionCounts['review-required'] ?? 0, 0);
});

test('renders an actionable Markdown plan', () => {
  const markdownOutput = renderMarkdown(buildRemediationPlan(sampleReport()));
  assert.match(markdownOutput, /VISTA Sovereign Runtime Remediation Plan/u);
  assert.match(markdownOutput, /api\.worldmonitor\.app/u);
  assert.match(markdownOutput, /server\/inference\/provider\.ts:44/u);
  assert.doesNotMatch(markdownOutput, /No actionable host entries/u);
});


test('classifies package metadata and semantic vocabulary identifiers outside the runtime queue', () => {
  const sourceReport = {
    generatedAt: '2026-08-06T06:39:40.000Z',
    scannedFileCount: 10,
    externalHosts: [
      {
        host: 'registry.npmjs.org',
        occurrences: [
          { file: 'docker/runtime-package-lock.json', line: 1, url: 'https://registry.npmjs.org/pkg/-/pkg.tgz' },
          { file: 'scripts/package-lock.json', line: 1, url: 'https://registry.npmjs.org/pkg/-/pkg.tgz' },
        ],
      },
      {
        host: 'schema.org',
        occurrences: [
          { file: 'api/_product-catalog.generated.js', line: 1, url: 'https://schema.org/SoftwareApplication' },
        ],
      },
      {
        host: 'www.w3.org',
        occurrences: [
          { file: 'src/components/Map.ts', line: 1, url: 'http://www.w3.org/2000/svg' },
        ],
      },
      {
        host: 'purl.org',
        occurrences: [
          { file: 'src/services/rss.ts', line: 1, url: 'http://purl.org/rss/1.0/modules/content/' },
        ],
      },
      {
        host: 'api.worldmonitor.app',
        occurrences: [
          { file: 'src/services/runtime.ts', line: 1, url: 'https://api.worldmonitor.app' },
        ],
      },
    ],
    directAiProviderReferences: [],
  };

  const plan = buildRemediationPlan(sourceReport);
  const dispositions = Object.fromEntries(
    plan.evidence.externalHosts.map((candidateItem) => [candidateItem.host, candidateItem.disposition]),
  );

  assert.equal(dispositions['registry.npmjs.org'], 'dependency-lock-reference');
  assert.equal(dispositions['schema.org'], 'semantic-vocabulary-reference');
  assert.equal(dispositions['www.w3.org'], 'semantic-vocabulary-reference');
  assert.equal(dispositions['purl.org'], 'semantic-vocabulary-reference');
  assert.equal(dispositions['api.worldmonitor.app'], 'runtime-dependency');
  assert.equal(plan.summary.actionableHostEntries, 1);
});


test('classifies packaged static-data URLs as provenance rather than runtime dependencies', () => {
  const sourceReport = {
    generatedAt: '2026-08-06T06:42:13.000Z',
    scannedFileCount: 10,
    externalHosts: [
      {
        host: 'home.treasury.gov',
        occurrences: [
          { file: 'scripts/data/energy-disruptions.json', line: 1, url: 'https://home.treasury.gov/example' },
          { file: 'scripts/data/pipelines-oil.json', line: 2, url: 'https://home.treasury.gov/example-2' },
        ],
      },
      {
        host: 'apnews.com',
        occurrences: [
          { file: 'scripts/data/fuel-shortages.json', line: 1, url: 'https://apnews.com/example' },
        ],
      },
      {
        host: 'api.worldmonitor.app',
        occurrences: [
          { file: 'src/services/runtime.ts', line: 1, url: 'https://api.worldmonitor.app' },
        ],
      },
      {
        host: 'mixed.example.org',
        occurrences: [
          { file: 'scripts/data/fuel-shortages.json', line: 1, url: 'https://mixed.example.org/source' },
          { file: 'src/services/runtime.ts', line: 2, url: 'https://mixed.example.org/api' },
        ],
      },
    ],
    directAiProviderReferences: [],
  };

  const plan = buildRemediationPlan(sourceReport);
  const dispositions = Object.fromEntries(
    plan.evidence.externalHosts.map((candidateItem) => [candidateItem.host, candidateItem.disposition]),
  );

  assert.equal(dispositions['home.treasury.gov'], 'static-data-provenance-reference');
  assert.equal(dispositions['apnews.com'], 'static-data-provenance-reference');
  assert.equal(dispositions['api.worldmonitor.app'], 'runtime-dependency');
  assert.equal(dispositions['mixed.example.org'], 'runtime-dependency');
  assert.equal(plan.summary.actionableHostEntries, 2);
});


test('classifies packaged static catalog URLs as provenance metadata', () => {
  const sourceReport = {
    generatedAt: '2026-08-06T06:45:00.000Z',
    scannedFileCount: 8,
    externalHosts: [
      {
        host: 'attack.mitre.org',
        occurrences: [
          { file: 'src/config/apt-groups.ts', line: 1, url: 'https://attack.mitre.org/groups/G0001/' },
        ],
      },
      {
        host: 'gdpr.eu',
        occurrences: [
          { file: 'src/config/ai-regulations.ts', line: 2, url: 'https://gdpr.eu/' },
        ],
      },
      {
        host: 'mixed.example.org',
        occurrences: [
          { file: 'src/config/apt-groups.ts', line: 3, url: 'https://mixed.example.org/reference' },
          { file: 'src/services/runtime.ts', line: 4, url: 'https://mixed.example.org/api' },
        ],
      },
      {
        host: 'tiles.openfreemap.org',
        occurrences: [
          { file: 'src/config/basemap.ts', line: 5, url: 'https://tiles.openfreemap.org/styles/liberty' },
        ],
      },
    ],
    directAiProviderReferences: [],
  };

  const plan = buildRemediationPlan(sourceReport);
  const dispositions = Object.fromEntries(
    plan.evidence.externalHosts.map((candidateItem) => [candidateItem.host, candidateItem.disposition]),
  );

  assert.equal(dispositions['attack.mitre.org'], 'static-catalog-provenance-reference');
  assert.equal(dispositions['gdpr.eu'], 'static-catalog-provenance-reference');
  assert.equal(dispositions['mixed.example.org'], 'runtime-dependency');
  assert.equal(dispositions['tiles.openfreemap.org'], 'runtime-dependency');
  assert.equal(plan.summary.actionableHostEntries, 2);
});


test('classifies test-only hosts as non-runtime evidence while preserving mixed-use hosts', () => {
  const sourceReport = {
    generatedAt: '2026-08-06T06:50:00.000Z', scannedFileCount: 4,
    externalHosts: [
      { host: 'rss.cnn.com', occurrences: [{ file: 'api/rss-proxy.test.mjs', line: 1, url: 'https://rss.cnn.com/rss/test.rss' }] },
      { host: 'example.ingest.sentry.io', occurrences: [{ file: 'api/_sentry-common.test.mjs', line: 2, url: 'https://example.ingest.sentry.io/api/1' }] },
      { host: 'mixed.example.org', occurrences: [
        { file: 'api/runtime.test.mjs', line: 3, url: 'https://mixed.example.org/test' },
        { file: 'src/services/runtime.ts', line: 4, url: 'https://mixed.example.org/api' },
      ] },
    ], directAiProviderReferences: [],
  };
  const plan = buildRemediationPlan(sourceReport);
  const dispositions = Object.fromEntries(plan.evidence.externalHosts.map((item) => [item.host, item.disposition]));
  assert.equal(dispositions['rss.cnn.com'], 'test-evidence-reference');
  assert.equal(dispositions['example.ingest.sentry.io'], 'test-evidence-reference');
  assert.equal(dispositions['mixed.example.org'], 'runtime-dependency');
  assert.equal(plan.summary.actionableHostEntries, 1);
});

test('classifies lockfile registry and funding metadata outside the runtime queue', () => {
  const sourceReport = {
    generatedAt: '2026-08-06T07:05:00.000Z',
    scannedFileCount: 2,
    externalHosts: [
      ...[
        'registry.npmjs.org',
        'feross.org',
        'ko-fi.com',
        'www.patreon.com',
      ].map((host) => ({
        host,
        occurrences: [
          { file: 'scripts/package-lock.json', line: 1, url: `https://${host}/metadata` },
        ],
      })),
      {
        host: 'mixed.example.org',
        occurrences: [
          { file: 'scripts/package-lock.json', line: 2, url: 'https://mixed.example.org/funding' },
          { file: 'src/services/runtime-client.ts', line: 3, url: 'https://mixed.example.org/api' },
        ],
      },
    ],
    directAiProviderReferences: [],
  };

  const plan = buildRemediationPlan(sourceReport);
  const dispositions = Object.fromEntries(
    plan.evidence.externalHosts.map((item) => [item.host, item.disposition]),
  );

  assert.equal(dispositions['registry.npmjs.org'], 'dependency-lock-reference');
  assert.equal(dispositions['feross.org'], 'dependency-lock-reference');
  assert.equal(dispositions['ko-fi.com'], 'dependency-lock-reference');
  assert.equal(dispositions['www.patreon.com'], 'dependency-lock-reference');
  assert.equal(dispositions['mixed.example.org'], 'runtime-dependency');
  assert.equal(plan.summary.hostDispositionCounts['dependency-lock-reference'], 4);
  assert.equal(plan.summary.actionableHostEntries, 1);
});


test('classifies static manifest source citations outside the runtime queue', () => {
  const sourceReport = {
    generatedAt: '2026-08-06T00:00:00.000Z',
    scannedFileCount: 2,
    externalHosts: [
      { host: 'www.futurefund.gov.au', occurrences: [{ file: 'scripts/shared/swf-classification-manifest.yaml', line: 1 }] },
      { host: 'www.nbim.no', occurrences: [{ file: 'scripts/shared/swf-classification-manifest.yaml', line: 2 }] },
      { host: 'www.futurefund.gov.au', occurrences: [
        { file: 'scripts/shared/swf-classification-manifest.yaml', line: 3 },
        { file: 'scripts/seed-sovereign-wealth.mjs', line: 4 },
      ] },
    ],
    directProviderReferences: [],
  };
  const plan = buildRemediationPlan(sourceReport);
  const dispositions = new Map(plan.evidence.externalHosts.map((item) => [item.host + ':' + item.files.join(','), item.disposition]));
  assert.equal(dispositions.get('www.nbim.no:scripts/shared/swf-classification-manifest.yaml'), 'static-manifest-provenance-reference');
  assert.equal(dispositions.get('www.futurefund.gov.au:scripts/seed-sovereign-wealth.mjs,scripts/shared/swf-classification-manifest.yaml'), 'runtime-dependency');
});


test('classifies packaged published-claim citations outside the runtime queue', () => {
  const sourceReport = {
    generatedAt: '2026-08-06T07:12:00.000Z',
    scannedFileCount: 2,
    externalHosts: [
      { host: 'candid.org', occurrences: [{ file: 'scripts/shared/giving-published-estimate-claims.json', line: 1 }] },
      { host: 'www.oecd.org', occurrences: [{ file: 'scripts/shared/giving-published-estimate-claims.json', line: 2 }] },
      { host: 'candid.org', occurrences: [
        { file: 'scripts/shared/giving-published-estimate-claims.json', line: 3 },
        { file: 'src/services/giving-client.ts', line: 4 },
      ] },
      { host: 'upload.wikimedia.org', occurrences: [{ file: 'src/data/conservation-wins.json', line: 5 }] },
    ],
    directAiProviderReferences: [],
  };
  const plan = buildRemediationPlan(sourceReport);
  const pureCandid = plan.evidence.externalHosts.find((item) => item.host === 'candid.org' && item.files.length === 1);
  const mixedCandid = plan.evidence.externalHosts.find((item) => item.host === 'candid.org' && item.files.includes('src/services/giving-client.ts'));
  assert.equal(pureCandid?.disposition, 'static-claim-provenance-reference');
  assert.equal(plan.evidence.externalHosts.find((item) => item.host === 'www.oecd.org')?.disposition, 'static-claim-provenance-reference');
  assert.equal(mixedCandid?.disposition, 'runtime-dependency');
  assert.equal(plan.evidence.externalHosts.find((item) => item.host === 'upload.wikimedia.org')?.disposition, 'runtime-dependency');
  assert.equal(plan.summary.actionableHostEntries, 2);
});


test('classifies platform claim citations and provenance assertions outside the runtime queue', () => {
  const sourceReport = {
    generatedAt: '2026-08-06T07:20:00.000Z',
    scannedFileCount: 3,
    externalHosts: [
      ...['www.gofundme.com', 'www.globalgiving.org', 'www.justgiving.com'].map((host) => ({
        host,
        occurrences: [
          { file: 'scripts/shared/giving-published-estimate-claims.json', line: 1 },
          { file: 'e2e/giving-provenance.spec.ts', line: 2 },
        ],
      })),
      { host: 'www.gofundme.com', occurrences: [
        { file: 'scripts/shared/giving-published-estimate-claims.json', line: 3 },
        { file: 'src/services/giving-client.ts', line: 4 },
      ] },
    ],
    directAiProviderReferences: [],
  };
  const plan = buildRemediationPlan(sourceReport);
  const pureEntries = plan.evidence.externalHosts.filter((item) => item.files.every((file) => file !== 'src/services/giving-client.ts'));
  for (const item of pureEntries) assert.equal(item.disposition, 'static-claim-provenance-reference');
  const mixedEntry = plan.evidence.externalHosts.find((item) => item.files.includes('src/services/giving-client.ts'));
  assert.equal(mixedEntry?.disposition, 'runtime-dependency');
  assert.equal(plan.summary.hostDispositionCounts['static-claim-provenance-reference'], 3);
  assert.equal(plan.summary.actionableHostEntries, 1);
});


test('classifies packaged source-attribution metadata outside the runtime queue', () => {
  const sourceReport = {
    generatedAt: '2026-08-06T07:25:00.000Z',
    scannedFileCount: 3,
    externalHosts: [
      { host: 'openaq.org', occurrences: [
        { file: 'scripts/shared/source-attribution-manifest.json', line: 1 },
        { file: 'scripts/source-attribution.mjs', line: 2 },
      ] },
      { host: 'openaq.org', occurrences: [
        { file: 'scripts/shared/source-attribution-manifest.json', line: 3 },
        { file: 'src/services/air-quality-client.ts', line: 4 },
      ] },
      { host: 'api.openaq.org', occurrences: [
        { file: 'scripts/seed-health-air-quality.mjs', line: 5 },
      ] },
    ],
    directAiProviderReferences: [],
  };
  const plan = buildRemediationPlan(sourceReport);
  const pureEntry = plan.evidence.externalHosts.find((item) => item.host === 'openaq.org' && item.files.every((file) => file !== 'src/services/air-quality-client.ts'));
  const mixedEntry = plan.evidence.externalHosts.find((item) => item.host === 'openaq.org' && item.files.includes('src/services/air-quality-client.ts'));
  const apiEntry = plan.evidence.externalHosts.find((item) => item.host === 'api.openaq.org');
  assert.equal(pureEntry?.disposition, 'static-source-attribution-reference');
  assert.equal(mixedEntry?.disposition, 'runtime-dependency');
  assert.equal(apiEntry?.disposition, 'runtime-dependency');
  assert.equal(plan.summary.hostDispositionCounts['static-source-attribution-reference'], 1);
  assert.equal(plan.summary.actionableHostEntries, 2);
});

test('classifies protocol and schema identifiers outside the runtime queue', () => {
  const sourceReport = {
    generatedAt: '2026-08-06T07:30:00.000Z',
    scannedFileCount: 4,
    externalHosts: [
      { host: 'www.sitemaps.org', occurrences: [{ file: 'scripts/build-sitemap.mjs', line: 1 }] },
      { host: 'schemas.xmlsoap.org', occurrences: [{ file: 'scripts/seed-cbr-rates.mjs', line: 2 }] },
      { host: 'schemas.agentskills.io', occurrences: [{ file: 'scripts/build-agent-skills-index.mjs', line: 3 }] },
      { host: 'schemas.agentskills.io', occurrences: [{ file: 'src/services/schema-client.ts', line: 4 }] },
    ],
    directAiProviderReferences: [],
  };
  const plan = buildRemediationPlan(sourceReport);
  const entries = plan.evidence.externalHosts;
  assert.equal(entries.find((item) => item.host === 'www.sitemaps.org')?.disposition, 'semantic-vocabulary-reference');
  assert.equal(entries.find((item) => item.host === 'schemas.xmlsoap.org')?.disposition, 'semantic-vocabulary-reference');
  const skillEntries = entries.filter((item) => item.host === 'schemas.agentskills.io');
  assert.equal(skillEntries.find((item) => item.files.includes('scripts/build-agent-skills-index.mjs'))?.disposition, 'semantic-vocabulary-reference');
  assert.equal(skillEntries.find((item) => item.files.includes('src/services/schema-client.ts'))?.disposition, 'runtime-dependency');
  assert.equal(plan.summary.hostDispositionCounts['semantic-vocabulary-reference'], 3);
  assert.equal(plan.summary.actionableHostEntries, 1);
});


test('classifies user setup links outside the runtime queue while preserving operational endpoints', () => {
  const report = {
    externalHosts: [
      { host: 'console.groq.com', occurrences: [{ file: 'src/services/settings-constants.ts' }] },
      { host: 'console.groq.com', occurrences: [{ file: 'src/services/settings-constants.ts' }, { file: 'src/services/runtime-client.ts' }] },
      { host: 'api.groq.com', occurrences: [{ file: 'src/services/runtime-client.ts' }] },
    ],
    directProviderReferences: [],
  };
  const plan = buildRemediationPlan(report);
  const dispositions = new Map(plan.evidence.externalHosts.map((entry) => [
    `${entry.host}:${entry.files.join(",")}`,
    entry.disposition,
  ]));
  assert.equal(dispositions.get('console.groq.com:src/services/settings-constants.ts'), 'user-setup-link-reference');
  assert.equal(dispositions.get('console.groq.com:src/services/runtime-client.ts,src/services/settings-constants.ts'), 'runtime-dependency');
  assert.equal(dispositions.get('api.groq.com:src/services/runtime-client.ts'), 'runtime-dependency');
});


test('classifies documentation-only references outside the runtime queue', () => {
  const report = {
    externalHosts: [
      { host: 'developer.mozilla.org', occurrences: [{ file: 'src/styles/base-layer.css' }] },
      { host: 'docs.cursor.com', occurrences: [{ file: 'api/mcp/constants.ts' }] },
      { host: 'jmespath.org', occurrences: [{ file: 'api/mcp/constants.ts' }] },
      { host: 'modelcontextprotocol.io', occurrences: [{ file: 'api/mcp/types.ts' }] },
      { host: 'docs.cursor.com', occurrences: [
        { file: 'api/mcp/constants.ts' },
        { file: 'src/services/runtime-client.ts' },
      ] },
    ],
    directProviderReferences: [],
  };
  const plan = buildRemediationPlan(report);
  const entries = plan.evidence.externalHosts;
  for (const host of ['developer.mozilla.org', 'jmespath.org', 'modelcontextprotocol.io']) {
    assert.equal(entries.find((item) => item.host === host)?.disposition, 'documentation-reference');
  }
  const cursorEntries = entries.filter((item) => item.host === 'docs.cursor.com');
  assert.equal(cursorEntries.find((item) => item.files.length === 1)?.disposition, 'documentation-reference');
  assert.equal(cursorEntries.find((item) => item.files.includes('src/services/runtime-client.ts'))?.disposition, 'runtime-dependency');
  assert.equal(plan.summary.hostDispositionCounts['documentation-reference'], 4);
  assert.equal(plan.summary.actionableHostEntries, 1);
});


test('classifies user-facing documentation and package links outside the runtime queue', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 4,
    directAiProviderReferences: [],
    externalHosts: [
      { host: 'core.telegram.org', occurrences: [{ file: 'scripts/_digest-markdown.mjs', line: 82, url: 'https://core.telegram.org/bots/api#html-style' }] },
      { host: 'workos.com', occurrences: [
        { file: 'api/oauth-authorization-server.ts', line: 21, url: 'https://workos.com/auth-md' },
        { file: 'server/auth/runtime-client.ts', line: 1, url: 'https://workos.com/api/runtime' },
      ] },
      { host: 'worldmonitor.mintlify.dev', occurrences: [{ file: 'api/docs-mcp.ts', line: 20, url: 'https://worldmonitor.mintlify.dev/docs/mcp' }] },
      { host: 'www.npmjs.com', occurrences: [{ file: 'scripts/build-agent-skills-index.mjs', line: 75, url: 'https://www.npmjs.com/package/worldmonitor' }] },
    ],
  });
  const byKey = new Map(plan.evidence.externalHosts.map((entry) => [
    `${entry.host}:${entry.files.join(",")}`,
    entry.disposition,
  ]));
  assert.equal(byKey.get('core.telegram.org:scripts/_digest-markdown.mjs'), 'documentation-reference');
  assert.equal(byKey.get('worldmonitor.mintlify.dev:api/docs-mcp.ts'), 'documentation-reference');
  assert.equal(byKey.get('www.npmjs.com:scripts/build-agent-skills-index.mjs'), 'documentation-reference');
  assert.equal(byKey.get('workos.com:api/oauth-authorization-server.ts,server/auth/runtime-client.ts'), 'runtime-dependency');
});


test('classifies user-facing source and map attribution links outside the runtime queue', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 6,
    directAiProviderReferences: [],
    externalHosts: [
      { host: 'alternative.me', occurrences: [{ file: 'src/components/MacroSignalsPanel.ts', line: 255, url: 'https://alternative.me/crypto/fear-and-greed-index/' }] },
      { host: 'carto.com', occurrences: [{ file: 'src/components/DeckGLMap.ts', line: 1014, url: 'https://carto.com/attributions' }] },
      { host: 'protomaps.com', occurrences: [{ file: 'src/components/DeckGLMap.ts', line: 1015, url: 'https://protomaps.com' }, { file: 'src/config/basemap-styles.ts', line: 53, url: 'https://protomaps.com' }] },
      { host: 'www.openstreetmap.org', occurrences: [{ file: 'src/components/DeckGLMap.ts', line: 1014, url: 'https://www.openstreetmap.org/copyright' }, { file: 'src/components/GlobeMap.ts', line: 747, url: 'https://www.openstreetmap.org/copyright' }] },
      { host: 'www.naturalearthdata.com', occurrences: [{ file: 'src/components/GlobeMap.ts', line: 747, url: 'https://www.naturalearthdata.com' }] },
      { host: 'carto.com', occurrences: [{ file: 'src/services/map-runtime.ts', line: 1, url: 'https://carto.com/api/runtime' }] },
    ],
  });
  const byHost = new Map(plan.evidence.externalHosts.map((entry) => [entry.host, entry.disposition]));
  assert.equal(byHost.get('alternative.me'), 'user-facing-attribution-reference');
  assert.equal(byHost.get('protomaps.com'), 'user-facing-attribution-reference');
  assert.equal(byHost.get('www.openstreetmap.org'), 'user-facing-attribution-reference');
  assert.equal(byHost.get('www.naturalearthdata.com'), 'user-facing-attribution-reference');
  assert.equal(byHost.get('carto.com'), 'runtime-dependency');
});


test('classifies allowlisted client origins outside the runtime queue while preserving mixed-use hosts', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 3,
    directAiProviderReferences: [],
    externalHosts: [
      { host: 'chatgpt.com', occurrences: [{ file: 'api/mcp/ui/country-risk-app.ts', line: 51, url: 'https://chatgpt.com' }] },
      { host: 'claude.ai', occurrences: [
        { file: 'api/mcp/ui/country-risk-app.ts', line: 51, url: 'https://claude.ai' },
        { file: 'api/oauth/register.js', line: 16, url: 'https://claude.ai/api/mcp/auth_callback' },
      ] },
      { host: 'claude.com', occurrences: [
        { file: 'api/oauth/register.js', line: 17, url: 'https://claude.com/api/mcp/auth_callback' },
        { file: 'server/runtime-client.ts', line: 1, url: 'https://claude.com/api/runtime' },
      ] },
    ],
  });
  const byHost = new Map(plan.evidence.externalHosts.map((entry) => [entry.host, entry.disposition]));
  assert.equal(byHost.get('chatgpt.com'), 'client-origin-reference');
  assert.equal(byHost.get('claude.ai'), 'client-origin-reference');
  assert.equal(byHost.get('claude.com'), 'runtime-dependency');
});


test('classifies a malicious userinfo URL as a security-negative fixture', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'evil',
        occurrences: [
          {
            file: 'src/services/wm-session.ts',
            line: 695,
            url: 'https://api.worldmonitor.app@evil/',
          },
        ],
      },
      {
        host: 'evil',
        occurrences: [
          {
            file: 'server/runtime-client.ts',
            line: 1,
            url: 'https://evil/api/runtime',
          },
        ],
      },
    ],
  });
  const dispositions = plan.evidence.externalHosts.map((entry) => entry.disposition);
  assert.equal(dispositions[0], 'security-negative-fixture');
  assert.equal(dispositions[1], 'runtime-dependency');
});


test('classifies a user-initiated YouTube sign-in link outside the runtime queue', () => {
  const purePlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 1,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'accounts.google.com',
        occurrences: [
          {
            file: 'src/components/LiveNewsPanel.ts',
            line: 1687,
            url: "https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com/';",
          },
        ],
      },
    ],
  });
  assert.equal(
    purePlan.evidence.externalHosts[0]?.disposition,
    'user-signin-link-reference',
  );

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'accounts.google.com',
        occurrences: [
          {
            file: 'src/components/LiveNewsPanel.ts',
            line: 1687,
            url: "https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com/';",
          },
          {
            file: 'server/runtime-client.ts',
            line: 1,
            url: 'https://accounts.google.com/runtime',
          },
        ],
      },
    ],
  });
  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies an HKEX terms-of-use URL as policy evidence', () => {
  const purePlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 1,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'www2.hkexnews.hk',
        occurrences: [
          {
            file: 'scripts/china-corporate-disclosures/adapters.mjs',
            line: 146,
            url: "https://www2.hkexnews.hk/Global/Exchange/Terms-of-Use?sc_lang=en',",
          },
        ],
      },
    ],
  });
  assert.equal(
    purePlan.evidence.externalHosts[0]?.disposition,
    'terms-and-policy-reference',
  );

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'www2.hkexnews.hk',
        occurrences: [
          {
            file: 'scripts/china-corporate-disclosures/adapters.mjs',
            line: 146,
            url: "https://www2.hkexnews.hk/Global/Exchange/Terms-of-Use?sc_lang=en',",
          },
          {
            file: 'server/runtime-client.ts',
            line: 1,
            url: 'https://www2.hkexnews.hk/runtime',
          },
        ],
      },
    ],
  });
  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies generated OpenAPI example media outside the runtime queue', () => {
  const purePlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 1,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'static2.finnhub.io',
        occurrences: [
          {
            file: 'scripts/openapi-inject-examples.mjs',
            line: 1,
            url: "https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png',",
          },
        ],
      },
    ],
  });
  assert.equal(
    purePlan.evidence.externalHosts[0]?.disposition,
    'generated-openapi-example-reference',
  );

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'static2.finnhub.io',
        occurrences: [
          {
            file: 'scripts/openapi-inject-examples.mjs',
            line: 1,
            url: "https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png',",
          },
          {
            file: 'server/runtime-client.ts',
            line: 1,
            url: 'https://static2.finnhub.io/runtime/logo.png',
          },
        ],
      },
    ],
  });
  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies build-time documentation policy links outside the runtime queue', () => {
  const purePlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 1,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'mintlify.com',
        occurrences: [
          {
            file: 'scripts/enforce-mintlify-reserved-slugs.mjs',
            line: 7,
            url: 'https://mintlify.com/docs/ai/model-context-protocol',
          },
          {
            file: 'scripts/enforce-mintlify-reserved-slugs.mjs',
            line: 43,
            url: 'https://mintlify.com/docs/ai/model-context-protocol',
          },
        ],
      },
    ],
  });
  assert.equal(
    purePlan.evidence.externalHosts[0]?.disposition,
    'build-documentation-policy-reference',
  );

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'mintlify.com',
        occurrences: [
          {
            file: 'scripts/enforce-mintlify-reserved-slugs.mjs',
            line: 7,
            url: 'https://mintlify.com/docs/ai/model-context-protocol',
          },
          {
            file: 'server/runtime-client.ts',
            line: 1,
            url: 'https://mintlify.com/runtime',
          },
        ],
      },
    ],
  });
  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies BIS background and terms links as static source attribution', () => {
  const purePlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 1,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'www.bis.org',
        occurrences: [
          {
            file: 'scripts/seed-bis-lbs.mjs',
            line: 345,
            url: "https://www.bis.org/statistics/about_banking_stats.htm',",
          },
          {
            file: 'scripts/seed-bis-lbs.mjs',
            line: 346,
            url: "https://www.bis.org/terms_conditions.htm',",
          },
        ],
      },
    ],
  });
  assert.equal(
    purePlan.evidence.externalHosts[0]?.disposition,
    'static-source-attribution-reference',
  );

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'www.bis.org',
        occurrences: [
          {
            file: 'scripts/seed-bis-lbs.mjs',
            line: 345,
            url: "https://www.bis.org/statistics/about_banking_stats.htm',",
          },
          {
            file: 'server/runtime-client.ts',
            line: 1,
            url: 'https://www.bis.org/runtime',
          },
        ],
      },
    ],
  });
  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies frozen backtest label sources as provenance while preserving mixed-use hosts', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 3,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'www.imf.org',
        occurrences: [
          {
            file: 'scripts/backtest-resilience-outcomes.mjs',
            line: 1,
            url: "https://www.imf.org/en/Publications/Annual-Report-on-Exchange-Arrangements-and-Exchange-Restrictions',",
          },
          {
            file: 'scripts/backtest-resilience-outcomes.mjs',
            line: 2,
            url: "https://www.imf.org/en/Topics/sovereign-debt',",
          },
        ],
      },
      {
        host: 'reliefweb.int',
        occurrences: [
          {
            file: 'scripts/backtest-resilience-outcomes.mjs',
            line: 3,
            url: "https://reliefweb.int/',",
          },
        ],
      },
      {
        host: 'www.iea.org',
        occurrences: [
          {
            file: 'scripts/backtest-resilience-outcomes.mjs',
            line: 4,
            url: "https://www.iea.org/reports/electricity-2025',",
          },
          {
            file: 'scripts/seed-energy-intelligence.mjs',
            line: 5,
            url: 'https://www.iea.org/rss/*.xml',
          },
        ],
      },
    ],
  });

  const byHost = new Map(
    plan.evidence.externalHosts.map((entry) => [entry.host, entry.disposition]),
  );
  assert.equal(byHost.get('www.imf.org'), 'static-label-provenance-reference');
  assert.equal(byHost.get('reliefweb.int'), 'static-label-provenance-reference');
  assert.equal(byHost.get('www.iea.org'), 'runtime-dependency');
});


test('classifies the PMTiles OpenStreetMap copyright link as user-facing attribution', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'openstreetmap.org',
        occurrences: [
          {
            file: 'src/config/basemap-styles.ts',
            line: 49,
            url: 'https://openstreetmap.org/copyright',
          },
        ],
      },
      {
        host: 'example.org',
        occurrences: [
          {
            file: 'server/runtime-client.ts',
            line: 1,
            url: 'https://example.org/runtime',
          },
        ],
      },
    ],
  });
  const byHost = new Map(plan.evidence.externalHosts.map((entry) => [entry.host, entry.disposition]));
  assert.equal(byHost.get('openstreetmap.org'), 'user-facing-attribution-reference');
  assert.equal(byHost.get('example.org'), 'runtime-dependency');
});


test('classifies World Bank indicator and progress links as user-facing attribution', () => {
  const purePlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'data.worldbank.org',
        occurrences: [
          {
            file: 'scripts/seed-wb-external-debt.mjs',
            line: 150,
            url: 'https://data.worldbank.org/indicator/$',
          },
          {
            file: 'scripts/seed-wb-external-debt.mjs',
            line: 151,
            url: 'https://data.worldbank.org/indicator/$',
          },
          {
            file: 'src/services/progress-data.ts',
            line: 214,
            url: 'https://data.worldbank.org/',
          },
        ],
      },
    ],
  });
  assert.equal(
    purePlan.evidence.externalHosts[0]?.disposition,
    'user-facing-attribution-reference',
  );

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 3,
    directAiProviderReferences: [],
    externalHosts: [
      {
        host: 'data.worldbank.org',
        occurrences: [
          {
            file: 'scripts/seed-wb-external-debt.mjs',
            line: 150,
            url: 'https://data.worldbank.org/indicator/$',
          },
          {
            file: 'src/services/progress-data.ts',
            line: 214,
            url: 'https://data.worldbank.org/',
          },
          {
            file: 'server/runtime-client.ts',
            line: 1,
            url: 'https://data.worldbank.org/runtime',
          },
        ],
      },
    ],
  });
  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies batch-002 setup, build, user-action, and generated source links', () => {
  const fixtures = [
    ['my.telegram.org', 'scripts/telegram/session-auth.mjs', "https://my.telegram.org/apps');", 'user-setup-link-reference'],
    ['nodejs.org', 'scripts/download-node.sh', 'https://nodejs.org/dist/v$', 'build-time-dependency'],
    ['reddit.com', 'src/services/story-share.ts', 'https://reddit.com/submit?url=$', 'user-action-link-reference'],
    ['patents.google.com', 'scripts/_defense-patents-source.mjs', 'https://patents.google.com/patent/$', 'user-facing-attribution-reference'],
    ['projects.worldbank.org', 'scripts/_global-tenders.mjs', 'https://projects.worldbank.org/en/projects-operations/procurement-detail/$', 'user-facing-attribution-reference'],
    ['sam.gov', 'scripts/_global-tenders.mjs', 'https://sam.gov/opp/$', 'user-facing-attribution-reference'],
    ['ted.europa.eu', 'scripts/_global-tenders.mjs', 'https://ted.europa.eu/en/notice/-/detail/$', 'user-facing-attribution-reference'],
  ];

  for (const [host, sourceFile, url, expected] of fixtures) {
    const plan = buildRemediationPlan({
      generatedAt: '2026-08-06T00:00:00Z',
      scannedFileCount: 1,
      directAiProviderReferences: [],
      externalHosts: [{
        host,
        occurrences: [{ file: sourceFile, line: 1, url }],
      }],
    });
    assert.equal(plan.evidence.externalHosts[0]?.disposition, expected);
  }

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'reddit.com',
      occurrences: [
        { file: 'src/services/story-share.ts', line: 1, url: 'https://reddit.com/submit?url=$' },
        { file: 'server/runtime-client.ts', line: 1, url: 'https://reddit.com/runtime' },
      ],
    }],
  });
  assert.equal(mixedPlan.evidence.externalHosts[0]?.disposition, 'runtime-dependency');
});


test('classifies Twitter and Facebook sharing links as user-initiated actions', () => {
  const fixtures = [
    ['twitter.com', 'https://twitter.com/intent/tweet?text=$'],
    ['www.facebook.com', 'https://www.facebook.com/sharer/sharer.php?u=$'],
  ];

  for (const [host, url] of fixtures) {
    const plan = buildRemediationPlan({
      generatedAt: '2026-08-06T00:00:00Z',
      scannedFileCount: 1,
      directAiProviderReferences: [],
      externalHosts: [{
        host,
        occurrences: [{
          file: 'src/services/story-share.ts',
          line: 1,
          url,
        }],
      }],
    });
    assert.equal(
      plan.evidence.externalHosts[0]?.disposition,
      'user-action-link-reference',
    );
  }

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'twitter.com',
      occurrences: [
        {
          file: 'src/services/story-share.ts',
          line: 1,
          url: 'https://twitter.com/intent/tweet?text=$',
        },
        {
          file: 'server/runtime-client.ts',
          line: 1,
          url: 'https://twitter.com/runtime',
        },
      ],
    }],
  });
  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies the MCP server URL placeholder outside the runtime queue', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 1,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'my-mcp-server.com',
      occurrences: [{
        file: 'src/components/McpConnectModal.ts',
        line: 1,
        url: 'https://my-mcp-server.com/mcp',
      }],
    }],
  });
  assert.equal(plan.evidence.externalHosts[0]?.disposition, 'example-placeholder-reference');

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'my-mcp-server.com',
      occurrences: [
        { file: 'src/components/McpConnectModal.ts', line: 1, url: 'https://my-mcp-server.com/mcp' },
        { file: 'server/runtime-client.ts', line: 1, url: 'https://my-mcp-server.com/runtime' },
      ],
    }],
  });
  assert.equal(mixedPlan.evidence.externalHosts[0]?.disposition, 'runtime-dependency');
});


test('classifies batch-005 article, documentation, and proxy placeholder links', () => {
  const fixtures = [
    ['arxiv.org', 'scripts/seed-research.mjs', 'https://arxiv.org/abs/$', 'user-facing-attribution-reference'],
    ['portal.api.imf.org', 'scripts/_seed-utils.mjs', 'https://portal.api.imf.org/', 'documentation-reference'],
    ['proxy-host', 'scripts/_seed-utils.mjs', 'http://user:pass@proxy-host', 'example-placeholder-reference'],
  ];

  for (const [host, sourceFile, url, expected] of fixtures) {
    const plan = buildRemediationPlan({
      generatedAt: '2026-08-06T00:00:00Z',
      scannedFileCount: 1,
      directAiProviderReferences: [],
      externalHosts: [{
        host,
        occurrences: [{ file: sourceFile, line: 1, url }],
      }],
    });
    assert.equal(plan.evidence.externalHosts[0]?.disposition, expected);
  }

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'arxiv.org',
      occurrences: [
        { file: 'scripts/seed-research.mjs', line: 1, url: 'https://arxiv.org/abs/$' },
        { file: 'server/runtime-client.ts', line: 1, url: 'https://arxiv.org/runtime' },
      ],
    }],
  });
  assert.equal(mixedPlan.evidence.externalHosts[0]?.disposition, 'runtime-dependency');
});


test('classifies OpenFreeMap attribution and application status links outside the runtime queue', () => {
  const fixtures = [
    ['openfreemap.org', 'src/components/DeckGLMap.ts', 'https://openfreemap.org', 'user-facing-attribution-reference'],
    ['status.worldmonitor.app', 'src/app/panel-layout.ts', 'https://status.worldmonitor.app/', 'user-action-link-reference'],
  ];

  for (const [host, sourceFile, url, expected] of fixtures) {
    const plan = buildRemediationPlan({
      generatedAt: '2026-08-06T00:00:00Z',
      scannedFileCount: 1,
      directAiProviderReferences: [],
      externalHosts: [{
        host,
        occurrences: [
          { file: sourceFile, line: 1, url },
          { file: sourceFile, line: 2, url },
        ],
      }],
    });
    assert.equal(plan.evidence.externalHosts[0]?.disposition, expected);
  }

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'openfreemap.org',
      occurrences: [
        { file: 'src/components/DeckGLMap.ts', line: 1, url: 'https://openfreemap.org' },
        { file: 'server/runtime-client.ts', line: 1, url: 'https://openfreemap.org/runtime' },
      ],
    }],
  });
  assert.equal(mixedPlan.evidence.externalHosts[0]?.disposition, 'runtime-dependency');
});


test('classifies Financial Modeling Prep developer documentation outside the runtime queue', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 1,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'site.financialmodelingprep.com',
      occurrences: [{
        file: 'server/worldmonitor/market/v1/_shared.ts',
        line: 1,
        url: 'https://site.financialmodelingprep.com/developer/docs',
      }],
    }],
  });
  assert.equal(
    plan.evidence.externalHosts[0]?.disposition,
    'documentation-reference',
  );

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'site.financialmodelingprep.com',
      occurrences: [
        {
          file: 'server/worldmonitor/market/v1/_shared.ts',
          line: 1,
          url: 'https://site.financialmodelingprep.com/developer/docs',
        },
        {
          file: 'server/runtime-client.ts',
          line: 1,
          url: 'https://site.financialmodelingprep.com/runtime',
        },
      ],
    }],
  });
  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies batch-008 market, symbol, and NHC source links outside the runtime queue', () => {
  const fixtures = [
    {
      host: 'kalshi.com',
      expected: 'user-facing-attribution-reference',
      occurrences: [
        { file: 'scripts/_bet-templates-markets.mjs', line: 1, url: 'https://kalshi.com/markets/' },
        { file: 'scripts/seed-prediction-markets.mjs', line: 2, url: 'https://kalshi.com/markets/$' },
      ],
    },
    {
      host: 'polymarket.com',
      expected: 'user-facing-attribution-reference',
      occurrences: [
        { file: 'scripts/_bet-templates-markets.mjs', line: 1, url: 'https://polymarket.com/event/' },
        { file: 'scripts/seed-prediction-markets.mjs', line: 2, url: 'https://polymarket.com/event/$' },
      ],
    },
    {
      host: 'www.tradingview.com',
      expected: 'user-action-link-reference',
      occurrences: [
        { file: 'src/components/MacroSignalsPanel.ts', line: 1, url: "https://www.tradingview.com/symbols/JPYUSD/')" },
        { file: 'src/components/MacroSignalsPanel.ts', line: 2, url: "https://www.tradingview.com/symbols/QQQ/')" },
        { file: 'src/components/MacroSignalsPanel.ts', line: 3, url: "https://www.tradingview.com/symbols/BTCUSD/')" },
      ],
    },
    {
      host: 'www.nhc.noaa.gov',
      expected: 'user-facing-attribution-reference',
      occurrences: [
        { file: 'scripts/build-crawlable-corpus.mjs', line: 1, url: 'https://www.nhc.noaa.gov/' },
        { file: 'scripts/seed-natural-events.mjs', line: 2, url: 'https://www.nhc.noaa.gov/' },
      ],
    },
  ];

  for (const fixture of fixtures) {
    const plan = buildRemediationPlan({
      generatedAt: '2026-08-06T00:00:00Z',
      scannedFileCount: fixture.occurrences.length,
      directAiProviderReferences: [],
      externalHosts: [{
        host: fixture.host,
        occurrences: fixture.occurrences,
      }],
    });
    assert.equal(
      plan.evidence.externalHosts[0]?.disposition,
      fixture.expected,
    );
  }

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 3,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'kalshi.com',
      occurrences: [
        { file: 'scripts/_bet-templates-markets.mjs', line: 1, url: 'https://kalshi.com/markets/' },
        { file: 'scripts/seed-prediction-markets.mjs', line: 2, url: 'https://kalshi.com/markets/$' },
        { file: 'server/runtime-client.ts', line: 3, url: 'https://kalshi.com/runtime' },
      ],
    }],
  });
  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies WhatsApp confirmation and story share links as user-initiated actions', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'wa.me',
      occurrences: [
        {
          file: 'server/worldmonitor/leads/v1/register-interest.ts',
          line: 1,
          url: 'https://wa.me/?text=$',
        },
        {
          file: 'src/services/story-share.ts',
          line: 2,
          url: 'https://wa.me/?text=$',
        },
      ],
    }],
  });

  assert.equal(
    plan.evidence.externalHosts[0]?.disposition,
    'user-action-link-reference',
  );

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 3,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'wa.me',
      occurrences: [
        {
          file: 'server/worldmonitor/leads/v1/register-interest.ts',
          line: 1,
          url: 'https://wa.me/?text=$',
        },
        {
          file: 'src/services/story-share.ts',
          line: 2,
          url: 'https://wa.me/?text=$',
        },
        {
          file: 'server/runtime-client.ts',
          line: 3,
          url: 'https://wa.me/runtime',
        },
      ],
    }],
  });

  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies Batch 011 LinkedIn actions and GEM attribution outside the runtime queue', () => {
  const fixtures = [
    {
      host: 'www.linkedin.com',
      expected: 'user-action-link-reference',
      occurrences: [
        {
          file: 'server/worldmonitor/leads/v1/register-interest.ts',
          line: 1,
          url: 'https://www.linkedin.com/sharing/share-offsite/?url=$',
        },
        {
          file: 'src/services/story-share.ts',
          line: 2,
          url: 'https://www.linkedin.com/sharing/share-offsite/?url=$',
        },
      ],
    },
    {
      host: 'globalenergymonitor.org',
      expected: 'user-facing-attribution-reference',
      occurrences: [
        {
          file: 'scripts/import-gem-pipelines.mjs',
          line: 1,
          url: 'https://globalenergymonitor.org/projects/global-oil-gas-infrastructure-tracker/',
        },
        {
          file: 'src/components/PipelineStatusPanel.ts',
          line: 2,
          url: "https://globalenergymonitor.org/',",
        },
        {
          file: 'src/components/StorageFacilityMapPanel.ts',
          line: 3,
          url: "https://globalenergymonitor.org/',",
        },
      ],
    },
  ];

  for (const fixture of fixtures) {
    const plan = buildRemediationPlan({
      generatedAt: '2026-08-06T00:00:00Z',
      scannedFileCount: fixture.occurrences.length,
      directAiProviderReferences: [],
      externalHosts: [{
        host: fixture.host,
        occurrences: fixture.occurrences,
      }],
    });

    assert.equal(
      plan.evidence.externalHosts[0]?.disposition,
      fixture.expected,
    );
  }

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 4,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'globalenergymonitor.org',
      occurrences: [
        {
          file: 'scripts/import-gem-pipelines.mjs',
          line: 1,
          url: 'https://globalenergymonitor.org/projects/global-oil-gas-infrastructure-tracker/',
        },
        {
          file: 'src/components/PipelineStatusPanel.ts',
          line: 2,
          url: "https://globalenergymonitor.org/',",
        },
        {
          file: 'src/components/StorageFacilityMapPanel.ts',
          line: 3,
          url: "https://globalenergymonitor.org/',",
        },
        {
          file: 'server/runtime-client.ts',
          line: 4,
          url: 'https://globalenergymonitor.org/runtime',
        },
      ],
    }],
  });

  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies AviationStack attribution and signup links outside the runtime queue', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'aviationstack.com',
      occurrences: [
        {
          file: 'server/worldmonitor/supply-chain/v1/china-corridor-source-adapters.ts',
          line: 1,
          url: "https://aviationstack.com/',",
        },
        {
          file: 'server/worldmonitor/supply-chain/v1/china-corridor-source-adapters.ts',
          line: 2,
          url: "https://aviationstack.com/',",
        },
        {
          file: 'src/services/settings-constants.ts',
          line: 3,
          url: "https://aviationstack.com/signup/free',",
        },
      ],
    }],
  });
  assert.equal(
    plan.evidence.externalHosts[0]?.disposition,
    'user-facing-attribution-reference',
  );

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 3,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'aviationstack.com',
      occurrences: [
        {
          file: 'server/worldmonitor/supply-chain/v1/china-corridor-source-adapters.ts',
          line: 1,
          url: "https://aviationstack.com/',",
        },
        {
          file: 'server/worldmonitor/supply-chain/v1/china-corridor-source-adapters.ts',
          line: 2,
          url: "https://aviationstack.com/',",
        },
        {
          file: 'src/services/settings-constants.ts',
          line: 3,
          url: "https://aviationstack.com/signup/free',",
        },
        {
          file: 'server/runtime-client.ts',
          line: 4,
          url: 'https://aviationstack.com/runtime',
        },
      ],
    }],
  });
  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('classifies Batch 013 share, community, trade-source, and webcam links outside runtime', () => {
  const fixtures = [
    {
      host: 'x.com', expected: 'user-action-link-reference',
      occurrences: [
        { file: 'scripts/seed-digest-notifications.mjs', line: 1, url: 'https://x.com/worldmonitorapp' },
        { file: 'server/worldmonitor/leads/v1/register-interest.ts', line: 2, url: 'https://x.com/intent/tweet?text=$' },
        { file: 'server/worldmonitor/leads/v1/register-interest.ts', line: 3, url: 'https://x.com/eliehabib' },
      ],
    },
    {
      host: 'discord.gg', expected: 'user-action-link-reference',
      occurrences: [
        { file: 'scripts/seed-digest-notifications.mjs', line: 1, url: 'https://discord.gg/re63kWKxaz' },
        { file: 'src/app/panel-layout.ts', line: 2, url: 'https://discord.gg/re63kWKxaz' },
        { file: 'src/components/CommunityWidget.ts', line: 3, url: "https://discord.gg/re63kWKxaz';" },
        { file: 'src/services/preferences-content.ts', line: 4, url: 'https://discord.gg/re63kWKxaz' },
      ],
    },
    {
      host: 'comtradeplus.un.org', expected: 'user-facing-attribution-reference',
      occurrences: [1,2,3,4].map((line) => ({
        file: 'server/worldmonitor/supply-chain/v1/china-corridor-source-adapters.ts',
        line, url: "https://comtradeplus.un.org/',",
      })),
    },
    {
      host: 'www.windy.com', expected: 'user-facing-attribution-reference',
      occurrences: [
        { file: 'server/worldmonitor/webcam/v1/get-webcam-image.ts', line: 1, url: 'https://www.windy.com/webcams/$' },
        { file: 'src/components/GlobeMap.ts', line: 2, url: 'https://www.windy.com/webcams/$' },
        { file: 'src/components/Map.ts', line: 3, url: 'https://www.windy.com/webcams/$' },
        { file: 'src/services/webcams/index.ts', line: 4, url: 'https://www.windy.com/webcams/$' },
      ],
    },
  ];
  for (const fixture of fixtures) {
    const plan = buildRemediationPlan({
      generatedAt: '2026-08-06T00:00:00Z',
      scannedFileCount: fixture.occurrences.length,
      directAiProviderReferences: [],
      externalHosts: [{ host: fixture.host, occurrences: fixture.occurrences }],
    });
    assert.equal(plan.evidence.externalHosts[0]?.disposition, fixture.expected);
  }

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z', scannedFileCount: 5,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'www.windy.com',
      occurrences: [
        { file: 'server/worldmonitor/webcam/v1/get-webcam-image.ts', line: 1, url: 'https://www.windy.com/webcams/$' },
        { file: 'src/components/GlobeMap.ts', line: 2, url: 'https://www.windy.com/webcams/$' },
        { file: 'src/components/Map.ts', line: 3, url: 'https://www.windy.com/webcams/$' },
        { file: 'src/services/webcams/index.ts', line: 4, url: 'https://www.windy.com/webcams/$' },
        { file: 'server/runtime-client.ts', line: 5, url: 'https://www.windy.com/runtime' },
      ],
    }],
  });
  assert.equal(mixedPlan.evidence.externalHosts[0]?.disposition, 'runtime-dependency');
});


test('classifies Batch 014 Telegram actions and IFSWF provenance outside runtime', () => {
  const fixtures = [
    {
      host: 't.me',
      expected: 'user-action-link-reference',
      occurrences: [
        { file: 'scripts/ais-relay.cjs', line: 1, url: 'https://t.me/$' },
        {
          file: 'server/worldmonitor/leads/v1/register-interest.ts',
          line: 2,
          url: 'https://t.me/share/url?url=$',
        },
        {
          file: 'src/services/notifications-settings.ts',
          line: 3,
          url: 'https://t.me/$',
        },
        {
          file: 'src/services/story-share.ts',
          line: 4,
          url: 'https://t.me/share/url?url=$',
        },
      ],
    },
    {
      host: 'www.ifswf.org',
      expected: 'static-manifest-provenance-reference',
      occurrences: [
        {
          file: 'scripts/seed-sovereign-wealth.mjs',
          line: 1,
          url: 'https://www.ifswf.org/member-profiles/',
        },
        {
          file: 'scripts/shared/swf-classification-manifest.yaml',
          line: 2,
          url: 'https://www.ifswf.org/member-profiles/abu-dhabi-investment-authority',
        },
        {
          file: 'scripts/shared/swf-classification-manifest.yaml',
          line: 3,
          url: 'https://www.ifswf.org/member-profiles/mubadala-investment-company',
        },
        {
          file: 'scripts/shared/swf-classification-manifest.yaml',
          line: 4,
          url: 'https://www.ifswf.org/members',
        },
        {
          file: 'scripts/shared/swf-classification-manifest.yaml',
          line: 5,
          url: 'https://www.ifswf.org/member-profiles/kuwait-investment-authority',
        },
        {
          file: 'scripts/shared/swf-classification-manifest.yaml',
          line: 6,
          url: 'https://www.ifswf.org/member-profiles/kuwait-investment-authority',
        },
        {
          file: 'scripts/shared/swf-classification-manifest.yaml',
          line: 7,
          url: 'https://www.ifswf.org/member-profiles/qatar-investment-authority',
        },
        {
          file: 'scripts/shared/swf-classification-manifest.yaml',
          line: 8,
          url: 'https://www.ifswf.org/member-profiles/gic-private-limited',
        },
        {
          file: 'scripts/shared/swf-classification-manifest.yaml',
          line: 9,
          url: 'https://www.ifswf.org/member-profiles/korea-investment-corporation',
        },
        {
          file: 'scripts/shared/swf-classification-manifest.yaml',
          line: 10,
          url: 'https://www.ifswf.org/member-profiles/oman-investment-authority',
        },
        {
          file: 'scripts/shared/swf-classification-manifest.yaml',
          line: 11,
          url: 'https://www.ifswf.org/member-profiles/mumtalakat-holding-company',
        },
      ],
    },
  ];

  for (const fixture of fixtures) {
    const plan = buildRemediationPlan({
      generatedAt: '2026-08-06T00:00:00Z',
      scannedFileCount: fixture.occurrences.length,
      directAiProviderReferences: [],
      externalHosts: [{
        host: fixture.host,
        occurrences: fixture.occurrences,
      }],
    });

    assert.equal(
      plan.evidence.externalHosts[0]?.disposition,
      fixture.expected,
    );
  }

  const mixedPlan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 5,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 't.me',
      occurrences: [
        { file: 'scripts/ais-relay.cjs', line: 1, url: 'https://t.me/$' },
        {
          file: 'server/worldmonitor/leads/v1/register-interest.ts',
          line: 2,
          url: 'https://t.me/share/url?url=$',
        },
        {
          file: 'src/services/notifications-settings.ts',
          line: 3,
          url: 'https://t.me/$',
        },
        {
          file: 'src/services/story-share.ts',
          line: 4,
          url: 'https://t.me/share/url?url=$',
        },
        {
          file: 'server/runtime-client.ts',
          line: 5,
          url: 'https://t.me/runtime',
        },
      ],
    }],
  });

  assert.equal(
    mixedPlan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('preserves TechCrunch as runtime when test and production feed references coexist', () => {
  const productionFiles = [
    'server/worldmonitor/news/v1/_feeds.ts',
    'src/config/feeds.ts',
    'src/config/variants/tech.ts',
  ];
  const occurrences = Array.from({ length: 47 }, (_, index) => ({
    file: index < 34
      ? 'api/rss-proxy.test.mjs'
      : productionFiles[(index - 34) % productionFiles.length],
    line: index + 1,
    url: 'https://techcrunch.com/feed',
  }));
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: occurrences.length,
    directAiProviderReferences: [],
    externalHosts: [{ host: 'techcrunch.com', occurrences }],
  });
  assert.equal(
    plan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('requires all host occurrences to be test evidence before removing runtime', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 2,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'mixed-test-runtime.net',
      occurrences: [
        {
          file: 'api/example.test.mjs',
          line: 1,
          url: 'https://mixed-test-runtime.net/feed',
        },
        {
          file: 'src/config/feeds.ts',
          line: 2,
          url: 'https://mixed-test-runtime.net/feed',
        },
      ],
    }],
  });

  assert.equal(
    plan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});


test('production runtime evidence takes precedence over test and fixture evidence', () => {
  const plan = buildRemediationPlan({
    generatedAt: '2026-08-06T00:00:00Z',
    scannedFileCount: 4,
    directAiProviderReferences: [],
    externalHosts: [{
      host: 'mixed-use-feed.net',
      occurrences: [
        {
          file: 'api/rss-proxy.test.mjs',
          line: 1,
          url: 'https://mixed-use-feed.net/feed',
        },
        {
          file: 'tests/fixtures/rss-feed.ts',
          line: 2,
          url: 'https://mixed-use-feed.net/feed',
        },
        {
          file: 'server/worldmonitor/news/v1/rss.ts',
          line: 3,
          url: 'https://mixed-use-feed.net/feed',
        },
        {
          file: 'src/config/news-sources.ts',
          line: 4,
          url: 'https://mixed-use-feed.net/feed',
        },
      ],
    }],
  });

  assert.equal(
    plan.evidence.externalHosts[0]?.disposition,
    'runtime-dependency',
  );
});
