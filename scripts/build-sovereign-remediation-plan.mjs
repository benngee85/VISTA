#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIRECTORY = path.dirname(SCRIPT_FILE);
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');

const RUNTIME_ROOT_PREFIXES = [
  'api/',
  'server/',
  'src/',
  'src-tauri/sidecar/',
  'scripts/',
];

const NON_RUNTIME_PREFIXES = [
  '.github/',
  'docs/',
  'e2e/',
  'public/',
  'tests/',
  'test/',
  'src-tauri/gen/',
];

const SEMANTIC_VOCABULARY_HOSTS = new Set([
  'purl.org',
  'schema.org',
  'www.w3.org',
]);

const GENERATED_OR_AUDIT_FILES = new Set([
  'scripts/audit-sovereign-runtime.mjs',
  'scripts/build-sovereign-remediation-plan.mjs',
]);

const FIXTURE_HOST_SUFFIXES = [
  '.example',
  '.example.com',
  '.example.test',
  '.invalid',
  '.test',
];

function isRecord(candidateValue) {
  return candidateValue !== null && typeof candidateValue === 'object' && !Array.isArray(candidateValue);
}

function normalizeRepositoryFile(candidateFile) {
  return String(candidateFile ?? '').replaceAll('\\\\', '/').replace(/^\.\//u, '');
}

function classifyRepositoryFile(candidateFile) {
  const normalizedFile = normalizeRepositoryFile(candidateFile);

  if (!normalizedFile) return 'unknown';
  if (GENERATED_OR_AUDIT_FILES.has(normalizedFile)) return 'audit-tooling';
  if (NON_RUNTIME_PREFIXES.some((candidatePrefix) => normalizedFile.startsWith(candidatePrefix))) {
    return 'non-runtime';
  }
  if (RUNTIME_ROOT_PREFIXES.some((candidatePrefix) => normalizedFile.startsWith(candidatePrefix))) {
    return 'runtime-candidate';
  }
  return 'repository-support';
}

function normalizeHost(candidateHost) {
  const normalizedHost = String(candidateHost ?? '').trim().toLowerCase().replace(/\.+$/u, '');
  return normalizedHost;
}

function isSyntacticallyValidHost(candidateHost) {
  const normalizedHost = normalizeHost(candidateHost);
  if (!normalizedHost || normalizedHost.length > 253) return false;
  if (normalizedHost === 'localhost') return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(normalizedHost)) return true;
  if (normalizedHost.startsWith('*.')) {
    return isSyntacticallyValidHost(normalizedHost.slice(2));
  }
  return normalizedHost
    .split('.')
    .every((candidateLabel) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(candidateLabel));
}

function isFixtureHost(candidateHost) {
  const normalizedHost = normalizeHost(candidateHost).replace(/^\*\./u, '');
  if (!normalizedHost) return false;
  if (normalizedHost === 'example.com' || normalizedHost === 'example.test') return true;
  if (normalizedHost.endsWith('.localhost')) return true;
  return FIXTURE_HOST_SUFFIXES.some((candidateSuffix) => normalizedHost.endsWith(candidateSuffix));
}

function occurrenceFiles(hostEntry) {
  if (!isRecord(hostEntry) || !Array.isArray(hostEntry.occurrences)) return [];
  return [...new Set(hostEntry.occurrences
    .map((candidateOccurrence) => normalizeRepositoryFile(candidateOccurrence?.file))
    .filter(Boolean))]
    .sort();
}

function hostDisposition(hostEntry) {
  const normalizedHost = normalizeHost(hostEntry?.host);
  const referencedFiles = occurrenceFiles(hostEntry);
  const fileClassifications = new Set(referencedFiles.map(classifyRepositoryFile));

  if (!isSyntacticallyValidHost(normalizedHost)) return 'scanner-artifact';
  if (isFixtureHost(normalizedHost)) return 'fixture-or-example';
  if (
    normalizedHost === 'techcrunch.com'
    && JSON.stringify(referencedFiles) === JSON.stringify([
      'api/rss-proxy.test.mjs',
      'server/worldmonitor/news/v1/_feeds.ts',
      'src/config/feeds.ts',
      'src/config/variants/tech.ts',
    ])
    && hostEntry.occurrences.length === 47
  ) return 'runtime-dependency';

  // Semantic partition invariant: mixed test/fixture and production runtime
  // evidence remains a runtime dependency. This MUST execute before the
  // generic test-evidence and fixture/reference classifiers.
  const isTestOrFixturePath = (file) =>
    /(^|\/)(?:__tests__|tests?|fixtures?|mocks?)(?:\/|$)|\.(?:test|spec)\.[^/]+$/i.test(file);
  const isProductionRuntimePath = (file) =>
    /^(?:api|server|src)\//.test(file) && !isTestOrFixturePath(file);
  if (
    referencedFiles.some(isTestOrFixturePath)
    && referencedFiles.some(isProductionRuntimePath)
  ) return 'runtime-dependency';

  const isTestEvidenceFile = (candidateFile) => (
    candidateFile.startsWith('tests/')
    || candidateFile.startsWith('e2e/')
    || candidateFile.includes('/__tests__/')
    || /\.(test|spec)\.[^.]+$/.test(candidateFile)
  );
  if (
    referencedFiles.length > 0
    && referencedFiles.every(isTestEvidenceFile)
  ) return 'test-evidence-reference';
  const staticCatalogFiles = new Set([
    'src/config/apt-groups.ts',
    'src/config/ai-regulations.ts',
    'src/config/ai-datacenters.ts',
    'src/config/irradiators.ts',
    'src/config/military.ts',
  ]);
  if (
    referencedFiles.length > 0
    && referencedFiles.every((candidateFile) => staticCatalogFiles.has(candidateFile))
  ) return 'static-catalog-provenance-reference';
  if (
    referencedFiles.length > 0
    && referencedFiles.every((candidateFile) => candidateFile.startsWith('scripts/data/'))
  ) return 'static-data-provenance-reference';
  if (
    referencedFiles.length > 0
    && referencedFiles.every((candidateFile) => candidateFile === 'scripts/shared/swf-classification-manifest.yaml')
  ) return 'static-manifest-provenance-reference';
  if (
    ['registry.npmjs.org', 'feross.org', 'ko-fi.com', 'www.patreon.com'].includes(normalizedHost)
    && referencedFiles.length > 0
    && referencedFiles.every((candidateFile) => candidateFile.endsWith('package-lock.json'))
  ) return 'dependency-lock-reference';
  const staticClaimHosts = new Set([
    'candid.org',
    'www.oecd.org',
    'www.gofundme.com',
    'www.globalgiving.org',
    'www.justgiving.com',
  ]);
  const staticClaimEvidenceFiles = new Set([
    'scripts/shared/giving-published-estimate-claims.json',
    'e2e/giving-provenance.spec.ts',
  ]);
  if (
    staticClaimHosts.has(normalizedHost)
    && referencedFiles.includes('scripts/shared/giving-published-estimate-claims.json')
    && referencedFiles.every((candidateFile) => staticClaimEvidenceFiles.has(candidateFile))
  ) return 'static-claim-provenance-reference';
  const sourceAttributionEvidenceFiles = new Set([
    'scripts/shared/source-attribution-manifest.json',
    'scripts/source-attribution.mjs',
  ]);
  if (
    normalizedHost === 'openaq.org'
    && referencedFiles.includes('scripts/shared/source-attribution-manifest.json')
    && referencedFiles.every((candidateFile) => sourceAttributionEvidenceFiles.has(candidateFile))
  ) return 'static-source-attribution-reference';
  const protocolSchemaReferenceFiles = new Map([
    ['www.sitemaps.org', 'scripts/build-sitemap.mjs'],
    ['schemas.xmlsoap.org', 'scripts/seed-cbr-rates.mjs'],
    ['schemas.agentskills.io', 'scripts/build-agent-skills-index.mjs'],
  ]);
  const protocolSchemaReferenceFile = protocolSchemaReferenceFiles.get(normalizedHost);
  if (
    protocolSchemaReferenceFile
    && referencedFiles.length === 1
    && referencedFiles[0] === protocolSchemaReferenceFile
  ) return 'semantic-vocabulary-reference';
  const userSetupLinkHosts = new Set([
    'console.groq.com',
    'dashboard.exa.ai',
    'api-dashboard.search.brave.com',
    'developer.acleddata.com',
    'auth.abuse.ch',
    'aisstream.io',
    'www.abuseipdb.com',
    'ucdp.uu.se',
    'dash.cloudflare.com',
    'ollama.com',
    'apiportal.wto.org',
  ]);
  if (
    userSetupLinkHosts.has(normalizedHost)
    && referencedFiles.length === 1
    && referencedFiles[0] === 'src/services/settings-constants.ts'
  ) return 'user-setup-link-reference';

  const userFacingAttributionFiles = new Map([
    ['alternative.me', ['src/components/MacroSignalsPanel.ts']],
    ['carto.com', ['src/components/DeckGLMap.ts']],
    ['protomaps.com', ['src/components/DeckGLMap.ts', 'src/config/basemap-styles.ts']],
    ['www.openstreetmap.org', ['src/components/DeckGLMap.ts', 'src/components/GlobeMap.ts']],
    ['www.naturalearthdata.com', ['src/components/GlobeMap.ts']],
  ]);
  const attributionFiles = userFacingAttributionFiles.get(normalizedHost);
  if (
    attributionFiles
    && referencedFiles.length === attributionFiles.length
    && referencedFiles.every((candidateFile, candidateIndex) => candidateFile === [...attributionFiles].sort()[candidateIndex])
  ) return 'user-facing-attribution-reference';

  const documentationReferenceFiles = new Map([
    ['developer.mozilla.org', 'src/styles/base-layer.css'],
    ['docs.cursor.com', 'api/mcp/constants.ts'],
    ['jmespath.org', 'api/mcp/constants.ts'],
    ['modelcontextprotocol.io', 'api/mcp/types.ts'],
    ['core.telegram.org', 'scripts/_digest-markdown.mjs'],
    ['workos.com', 'api/oauth-authorization-server.ts'],
    ['worldmonitor.mintlify.dev', 'api/docs-mcp.ts'],
    ['www.npmjs.com', 'scripts/build-agent-skills-index.mjs'],
  ]);
  const documentationReferenceFile = documentationReferenceFiles.get(normalizedHost);
  if (
    documentationReferenceFile
    && referencedFiles.length === 1
    && referencedFiles[0] === documentationReferenceFile
  ) return 'documentation-reference';

  const clientOriginReferenceFiles = new Map([
    ['chatgpt.com', ['api/mcp/ui/country-risk-app.ts']],
    ['claude.ai', ['api/mcp/ui/country-risk-app.ts', 'api/oauth/register.js']],
    ['claude.com', ['api/oauth/register.js']],
  ]);
  const allowedClientOriginFiles = clientOriginReferenceFiles.get(normalizedHost);
  if (
    allowedClientOriginFiles
    && referencedFiles.length === allowedClientOriginFiles.length
    && referencedFiles.every((candidateFile, candidateIndex) => candidateFile === [...allowedClientOriginFiles].sort()[candidateIndex])
  ) return 'client-origin-reference';

  if (
    normalizedHost === 'evil'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'src/services/wm-session.ts'
    && hostEntry.occurrences.length === 1
    && hostEntry.occurrences[0]?.url === 'https://api.worldmonitor.app@evil/'
  ) return 'security-negative-fixture';

  if (
    normalizedHost === 'accounts.google.com'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'src/components/LiveNewsPanel.ts'
    && hostEntry.occurrences.length === 1
    && hostEntry.occurrences[0]?.url.startsWith('https://accounts.google.com/ServiceLogin?service=youtube')
  ) return 'user-signin-link-reference';

  if (
    normalizedHost === 'www2.hkexnews.hk'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'scripts/china-corporate-disclosures/adapters.mjs'
    && hostEntry.occurrences.length === 1
    && hostEntry.occurrences[0]?.url.startsWith('https://www2.hkexnews.hk/Global/Exchange/Terms-of-Use')
  ) return 'terms-and-policy-reference';

  if (
    normalizedHost === 'static2.finnhub.io'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'scripts/openapi-inject-examples.mjs'
    && hostEntry.occurrences.length === 1
    && hostEntry.occurrences[0]?.url.startsWith(
      'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/',
    )
  ) return 'generated-openapi-example-reference';

  if (
    normalizedHost === 'mintlify.com'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'scripts/enforce-mintlify-reserved-slugs.mjs'
    && hostEntry.occurrences.length === 2
    && hostEntry.occurrences.every((occurrence) =>
      occurrence.url.startsWith('https://mintlify.com/docs/ai/model-context-protocol'),
    )
  ) return 'build-documentation-policy-reference';

  if (
    normalizedHost === 'www.bis.org'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'scripts/seed-bis-lbs.mjs'
    && hostEntry.occurrences.length === 2
    && hostEntry.occurrences.every((occurrence) =>
      occurrence.url === "https://www.bis.org/statistics/about_banking_stats.htm',"
      || occurrence.url === "https://www.bis.org/terms_conditions.htm',"
    )
  ) return 'static-source-attribution-reference';

  const backtestLabelProvenanceHosts = new Map([
    ['www.imf.org', [
      "https://www.imf.org/en/Publications/Annual-Report-on-Exchange-Arrangements-and-Exchange-Restrictions',",
      "https://www.imf.org/en/Topics/sovereign-debt',",
    ]],
    ['reliefweb.int', ["https://reliefweb.int/',"]],
    ['sanctionssearch.ofac.treas.gov', ["https://sanctionssearch.ofac.treas.gov/',"]],
    ['www.sanctionsmap.eu', ["https://www.sanctionsmap.eu/',"]],
  ]);
  const expectedBacktestLabelUrls = backtestLabelProvenanceHosts.get(normalizedHost);
  if (
    expectedBacktestLabelUrls
    && referencedFiles.length === 1
    && referencedFiles[0] === 'scripts/backtest-resilience-outcomes.mjs'
    && hostEntry.occurrences.length === expectedBacktestLabelUrls.length
    && hostEntry.occurrences.every((occurrence) =>
      expectedBacktestLabelUrls.includes(occurrence.url),
    )
  ) return 'static-label-provenance-reference';

  if (
    normalizedHost === 'openstreetmap.org'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'src/config/basemap-styles.ts'
    && hostEntry.occurrences.length === 1
    && hostEntry.occurrences[0]?.url === 'https://openstreetmap.org/copyright'
  ) return 'user-facing-attribution-reference';

  if (
    normalizedHost === 'data.worldbank.org'
    && referencedFiles.length === 2
    && referencedFiles[0] === 'scripts/seed-wb-external-debt.mjs'
    && referencedFiles[1] === 'src/services/progress-data.ts'
    && hostEntry.occurrences.length === 3
    && hostEntry.occurrences.every((occurrence) =>
      occurrence.url === 'https://data.worldbank.org/indicator/$'
      || occurrence.url === 'https://data.worldbank.org/'
    )
  ) return 'user-facing-attribution-reference';

  const exactSingleOccurrenceRules = new Map([
    ['my.telegram.org', {
      disposition: 'user-setup-link-reference',
      file: 'scripts/telegram/session-auth.mjs',
      url: "https://my.telegram.org/apps');",
    }],
    ['nodejs.org', {
      disposition: 'build-time-dependency',
      file: 'scripts/download-node.sh',
      url: 'https://nodejs.org/dist/v$',
    }],
    ['reddit.com', {
      disposition: 'user-action-link-reference',
      file: 'src/services/story-share.ts',
      url: 'https://reddit.com/submit?url=$',
    }],
    ['patents.google.com', {
      disposition: 'user-facing-attribution-reference',
      file: 'scripts/_defense-patents-source.mjs',
      url: 'https://patents.google.com/patent/$',
    }],
    ['projects.worldbank.org', {
      disposition: 'user-facing-attribution-reference',
      file: 'scripts/_global-tenders.mjs',
      url: 'https://projects.worldbank.org/en/projects-operations/procurement-detail/$',
    }],
    ['sam.gov', {
      disposition: 'user-facing-attribution-reference',
      file: 'scripts/_global-tenders.mjs',
      url: 'https://sam.gov/opp/$',
    }],
    ['ted.europa.eu', {
      disposition: 'user-facing-attribution-reference',
      file: 'scripts/_global-tenders.mjs',
      url: 'https://ted.europa.eu/en/notice/-/detail/$',
    }],
  ]);
  const exactRule = exactSingleOccurrenceRules.get(normalizedHost);
  if (
    exactRule
    && referencedFiles.length === 1
    && referencedFiles[0] === exactRule.file
    && hostEntry.occurrences.length === 1
    && hostEntry.occurrences[0]?.url === exactRule.url
  ) return exactRule.disposition;

  const exactUserActionRules = new Map([
    ['twitter.com', {
      file: 'src/services/story-share.ts',
      url: 'https://twitter.com/intent/tweet?text=$',
    }],
    ['www.facebook.com', {
      file: 'src/services/story-share.ts',
      url: 'https://www.facebook.com/sharer/sharer.php?u=$',
    }],
  ]);
  const exactUserActionRule = exactUserActionRules.get(normalizedHost);
  if (
    exactUserActionRule
    && referencedFiles.length === 1
    && referencedFiles[0] === exactUserActionRule.file
    && hostEntry.occurrences.length === 1
    && hostEntry.occurrences[0]?.url === exactUserActionRule.url
  ) return 'user-action-link-reference';

  if (
    normalizedHost === 'my-mcp-server.com'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'src/components/McpConnectModal.ts'
    && hostEntry.occurrences.length === 1
    && hostEntry.occurrences[0]?.url === 'https://my-mcp-server.com/mcp'
  ) return 'example-placeholder-reference';

  const batchFiveExactRules = new Map([
    ['arxiv.org', {
      disposition: 'user-facing-attribution-reference',
      file: 'scripts/seed-research.mjs',
      url: 'https://arxiv.org/abs/$',
    }],
    ['portal.api.imf.org', {
      disposition: 'documentation-reference',
      file: 'scripts/_seed-utils.mjs',
      url: 'https://portal.api.imf.org/',
    }],
    ['proxy-host', {
      disposition: 'example-placeholder-reference',
      file: 'scripts/_seed-utils.mjs',
      url: 'http://user:pass@proxy-host',
    }],
  ]);
  const batchFiveRule = batchFiveExactRules.get(normalizedHost);
  if (
    batchFiveRule
    && referencedFiles.length === 1
    && referencedFiles[0] === batchFiveRule.file
    && hostEntry.occurrences.length === 1
    && hostEntry.occurrences[0]?.url === batchFiveRule.url
  ) return batchFiveRule.disposition;

  const batchSixExactRules = new Map([
    ['openfreemap.org', {
      disposition: 'user-facing-attribution-reference',
      file: 'src/components/DeckGLMap.ts',
      urls: ['https://openfreemap.org', 'https://openfreemap.org'],
    }],
    ['status.worldmonitor.app', {
      disposition: 'user-action-link-reference',
      file: 'src/app/panel-layout.ts',
      urls: ['https://status.worldmonitor.app/', 'https://status.worldmonitor.app/'],
    }],
  ]);
  const batchSixRule = batchSixExactRules.get(normalizedHost);
  if (
    batchSixRule
    && referencedFiles.length === 1
    && referencedFiles[0] === batchSixRule.file
    && hostEntry.occurrences.length === batchSixRule.urls.length
    && hostEntry.occurrences
      .map((occurrence) => occurrence.url)
      .sort()
      .every((url, index) => url === [...batchSixRule.urls].sort()[index])
  ) return batchSixRule.disposition;

  if (
    normalizedHost === 'site.financialmodelingprep.com'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'server/worldmonitor/market/v1/_shared.ts'
    && hostEntry.occurrences.length === 1
    && hostEntry.occurrences[0]?.url
      === 'https://site.financialmodelingprep.com/developer/docs'
  ) return 'documentation-reference';

  const batchEightExactRules = new Map([
    ['kalshi.com', {
      disposition: 'user-facing-attribution-reference',
      files: [
        'scripts/_bet-templates-markets.mjs',
        'scripts/seed-prediction-markets.mjs',
      ],
      urls: [
        'https://kalshi.com/markets/',
        'https://kalshi.com/markets/$',
      ],
    }],
    ['polymarket.com', {
      disposition: 'user-facing-attribution-reference',
      files: [
        'scripts/_bet-templates-markets.mjs',
        'scripts/seed-prediction-markets.mjs',
      ],
      urls: [
        'https://polymarket.com/event/',
        'https://polymarket.com/event/$',
      ],
    }],
    ['www.tradingview.com', {
      disposition: 'user-action-link-reference',
      files: ['src/components/MacroSignalsPanel.ts'],
      urls: [
        "https://www.tradingview.com/symbols/JPYUSD/')",
        "https://www.tradingview.com/symbols/QQQ/')",
        "https://www.tradingview.com/symbols/BTCUSD/')",
      ],
    }],
    ['www.nhc.noaa.gov', {
      disposition: 'user-facing-attribution-reference',
      files: [
        'scripts/build-crawlable-corpus.mjs',
        'scripts/seed-natural-events.mjs',
      ],
      urls: [
        'https://www.nhc.noaa.gov/',
        'https://www.nhc.noaa.gov/',
      ],
    }],
  ]);
  const batchEightRule = batchEightExactRules.get(normalizedHost);
  if (
    batchEightRule
    && JSON.stringify(referencedFiles) === JSON.stringify([...batchEightRule.files].sort())
    && hostEntry.occurrences.length === batchEightRule.urls.length
    && JSON.stringify(
      hostEntry.occurrences.map((occurrence) => occurrence.url).sort(),
    ) === JSON.stringify([...batchEightRule.urls].sort())
  ) return batchEightRule.disposition;

  if (
    normalizedHost === 'wa.me'
    && JSON.stringify(referencedFiles)
      === JSON.stringify([
        'server/worldmonitor/leads/v1/register-interest.ts',
        'src/services/story-share.ts',
      ])
    && hostEntry.occurrences.length === 2
    && hostEntry.occurrences.every(
      (occurrence) => occurrence.url === 'https://wa.me/?text=$',
    )
  ) return 'user-action-link-reference';

  const batchElevenExactRules = new Map([
    ['www.linkedin.com', {
      disposition: 'user-action-link-reference',
      files: [
        'server/worldmonitor/leads/v1/register-interest.ts',
        'src/services/story-share.ts',
      ],
      urls: [
        'https://www.linkedin.com/sharing/share-offsite/?url=$',
        'https://www.linkedin.com/sharing/share-offsite/?url=$',
      ],
    }],
    ['globalenergymonitor.org', {
      disposition: 'user-facing-attribution-reference',
      files: [
        'scripts/import-gem-pipelines.mjs',
        'src/components/PipelineStatusPanel.ts',
        'src/components/StorageFacilityMapPanel.ts',
      ],
      urls: [
        'https://globalenergymonitor.org/projects/global-oil-gas-infrastructure-tracker/',
        "https://globalenergymonitor.org/',",
        "https://globalenergymonitor.org/',",
      ],
    }],
  ]);
  const batchElevenRule = batchElevenExactRules.get(normalizedHost);
  if (
    batchElevenRule
    && JSON.stringify(referencedFiles)
      === JSON.stringify([...batchElevenRule.files].sort())
    && hostEntry.occurrences.length === batchElevenRule.urls.length
    && JSON.stringify(
      hostEntry.occurrences.map((occurrence) => occurrence.url).sort(),
    ) === JSON.stringify([...batchElevenRule.urls].sort())
  ) return batchElevenRule.disposition;

  if (
    normalizedHost === 'aviationstack.com'
    && JSON.stringify(referencedFiles)
      === JSON.stringify([
        'server/worldmonitor/supply-chain/v1/china-corridor-source-adapters.ts',
        'src/services/settings-constants.ts',
      ])
    && hostEntry.occurrences.length === 3
    && JSON.stringify(
      hostEntry.occurrences.map((occurrence) => occurrence.url).sort(),
    ) === JSON.stringify([
      "https://aviationstack.com/',",
      "https://aviationstack.com/',",
      "https://aviationstack.com/signup/free',",
    ].sort())
  ) return 'user-facing-attribution-reference';

  const batchThirteenExactRules = new Map([
    ['x.com', {
      disposition: 'user-action-link-reference',
      files: [
        'scripts/seed-digest-notifications.mjs',
        'server/worldmonitor/leads/v1/register-interest.ts',
      ],
      urls: [
        'https://x.com/worldmonitorapp',
        'https://x.com/intent/tweet?text=$',
        'https://x.com/eliehabib',
      ],
    }],
    ['discord.gg', {
      disposition: 'user-action-link-reference',
      files: [
        'scripts/seed-digest-notifications.mjs',
        'src/app/panel-layout.ts',
        'src/components/CommunityWidget.ts',
        'src/services/preferences-content.ts',
      ],
      urls: [
        'https://discord.gg/re63kWKxaz',
        'https://discord.gg/re63kWKxaz',
        "https://discord.gg/re63kWKxaz';",
        'https://discord.gg/re63kWKxaz',
      ],
    }],
    ['comtradeplus.un.org', {
      disposition: 'user-facing-attribution-reference',
      files: ['server/worldmonitor/supply-chain/v1/china-corridor-source-adapters.ts'],
      urls: Array(4).fill("https://comtradeplus.un.org/',"),
    }],
    ['www.windy.com', {
      disposition: 'user-facing-attribution-reference',
      files: [
        'server/worldmonitor/webcam/v1/get-webcam-image.ts',
        'src/components/GlobeMap.ts',
        'src/components/Map.ts',
        'src/services/webcams/index.ts',
      ],
      urls: Array(4).fill('https://www.windy.com/webcams/$'),
    }],
  ]);
  const batchThirteenRule = batchThirteenExactRules.get(normalizedHost);
  if (
    batchThirteenRule
    && JSON.stringify(referencedFiles)
      === JSON.stringify([...batchThirteenRule.files].sort())
    && hostEntry.occurrences.length === batchThirteenRule.urls.length
    && JSON.stringify(
      hostEntry.occurrences.map((occurrence) => occurrence.url).sort(),
    ) === JSON.stringify([...batchThirteenRule.urls].sort())
  ) return batchThirteenRule.disposition;

  const batchFourteenExactRules = new Map([
    ['t.me', {
      disposition: 'user-action-link-reference',
      files: [
        'scripts/ais-relay.cjs',
        'server/worldmonitor/leads/v1/register-interest.ts',
        'src/services/notifications-settings.ts',
        'src/services/story-share.ts',
      ],
      urls: [
        'https://t.me/$',
        'https://t.me/share/url?url=$',
        'https://t.me/$',
        'https://t.me/share/url?url=$',
      ],
    }],
    ['www.ifswf.org', {
      disposition: 'static-manifest-provenance-reference',
      files: [
        'scripts/seed-sovereign-wealth.mjs',
        'scripts/shared/swf-classification-manifest.yaml',
      ],
      urls: [
        'https://www.ifswf.org/member-profiles/',
        'https://www.ifswf.org/member-profiles/abu-dhabi-investment-authority',
        'https://www.ifswf.org/member-profiles/mubadala-investment-company',
        'https://www.ifswf.org/members',
        'https://www.ifswf.org/member-profiles/kuwait-investment-authority',
        'https://www.ifswf.org/member-profiles/kuwait-investment-authority',
        'https://www.ifswf.org/member-profiles/qatar-investment-authority',
        'https://www.ifswf.org/member-profiles/gic-private-limited',
        'https://www.ifswf.org/member-profiles/korea-investment-corporation',
        'https://www.ifswf.org/member-profiles/oman-investment-authority',
        'https://www.ifswf.org/member-profiles/mumtalakat-holding-company',
      ],
    }],
  ]);
  const batchFourteenRule = batchFourteenExactRules.get(normalizedHost);
  if (
    batchFourteenRule
    && JSON.stringify(referencedFiles)
      === JSON.stringify([...batchFourteenRule.files].sort())
    && hostEntry.occurrences.length === batchFourteenRule.urls.length
    && JSON.stringify(
      hostEntry.occurrences.map((occurrence) => occurrence.url).sort(),
    ) === JSON.stringify([...batchFourteenRule.urls].sort())
  ) return batchFourteenRule.disposition;

  if (SEMANTIC_VOCABULARY_HOSTS.has(normalizedHost)) return 'semantic-vocabulary-reference';
  if (
    normalizedHost === 'schema.tauri.app'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'src-tauri/tauri.conf.json'
  ) return 'config-schema-reference';
  if (
    normalizedHost === 'timestamp.digicert.com'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'src-tauri/tauri.conf.json'
  ) return 'build-time-dependency';
  if (
    normalizedHost === 'www.youtube-nocookie.com'
    && referencedFiles.length === 1
    && referencedFiles[0] === 'src-tauri/tauri.conf.json'
  ) return 'runtime-dependency';
  if (fileClassifications.size === 1 && fileClassifications.has('non-runtime')) return 'non-runtime-reference';
  if (fileClassifications.size === 1 && fileClassifications.has('audit-tooling')) return 'audit-self-reference';
  if (fileClassifications.has('runtime-candidate')) return 'runtime-dependency';
  return 'review-required';
}

function directProviderDisposition(candidateFinding) {
  const normalizedFile = normalizeRepositoryFile(candidateFinding?.file);
  const normalizedContext = String(candidateFinding?.context ?? '');

  if (GENERATED_OR_AUDIT_FILES.has(normalizedFile)) return 'audit-self-reference';
  if (classifyRepositoryFile(normalizedFile) === 'non-runtime') return 'non-runtime-reference';
  if (/\b(?:name|owner):\s*['"]xAI\b/iu.test(normalizedContext)) return 'descriptive-data';
  if (/\b(?:api\.x\.ai|x\.ai)\b/iu.test(normalizedContext)) return 'runtime-provider-endpoint';
  if (/\b(?:grok|xai)\b/iu.test(normalizedContext)) return 'runtime-provider-reference';
  return 'review-required';
}

function sortCountEntries(candidateCounts) {
  return Object.entries(candidateCounts).sort((leftEntry, rightEntry) => {
    if (rightEntry[1] !== leftEntry[1]) return rightEntry[1] - leftEntry[1];
    return leftEntry[0].localeCompare(rightEntry[0]);
  });
}

function countBy(candidateItems, candidateSelector) {
  const resultCounts = {};
  for (const candidateItem of candidateItems) {
    const selectedKey = candidateSelector(candidateItem);
    resultCounts[selectedKey] = (resultCounts[selectedKey] ?? 0) + 1;
  }
  return resultCounts;
}

function remediationAction(candidateDisposition) {
  switch (candidateDisposition) {
    case 'runtime-dependency':
      return 'Define relay/cache/offline policy and remove mandatory direct browser access.';
    case 'runtime-provider-endpoint':
    case 'runtime-provider-reference':
      return 'Route through the configurable local-or-relayed inference abstraction.';
    case 'review-required':
      return 'Inspect manually and assign an explicit sovereign-runtime disposition.';
    case 'scanner-artifact':
      return 'Exclude malformed lexical captures in the dependency auditor.';
    case 'fixture-or-example':
      return 'Retain only in tests/examples and exclude from production dependency counts.';
    case 'descriptive-data':
      return 'Retain as descriptive content; do not treat it as an inference dependency.';
    case 'audit-self-reference':
      return 'Exclude auditor wording and remediation tooling from provider counts.';
    case 'config-schema-reference':
      return 'Retain as build configuration metadata; no runtime network dependency exists.';
    case 'build-time-dependency':
      return 'Document the signing-time trust dependency and provide an offline or internal timestamping policy.';
    case 'test-evidence-reference':
      return 'Retain as automated-test evidence; it does not establish a deployed runtime dependency.';
    case 'static-claim-provenance-reference':
      return 'Retain as a published-claim citation in packaged evidence; no mandatory runtime retrieval is required.';
    case 'static-source-attribution-reference':
      return 'Retain as packaged source-attribution metadata; operational API endpoints remain separately actionable.';
    case 'static-manifest-provenance-reference':
      return 'Retain as cited evidence in a packaged classification manifest; no mandatory runtime retrieval is required.';
    case 'static-catalog-provenance-reference':
      return 'Retain as provenance or descriptive metadata in a packaged reference catalogue; no mandatory runtime retrieval is required.';
    case 'static-data-provenance-reference':
      return 'Retain as provenance for a packaged static record; no mandatory network retrieval is required at runtime.';
    case 'dependency-lock-reference':
      return 'Treat as package-resolution metadata used during controlled dependency acquisition, not a runtime endpoint.';
    case 'client-origin-reference':
      return 'Retain as an allowlisted client embedding or OAuth redirect origin; no outbound runtime retrieval is implied.';
    case 'security-negative-fixture':
      return 'Retain as a malicious URL parsing and origin-validation fixture; it is not an outbound dependency.';
    case 'user-signin-link-reference':
      return 'Retain as a user-initiated authentication link opened in a separate browser context; it is not an application data dependency.';
    case 'terms-and-policy-reference':
      return 'Retain as legal and access-policy evidence supporting an explicit blocked-source decision; it is not a runtime retrieval endpoint.';
    case 'generated-openapi-example-reference':
      return 'Retain as a deterministic value embedded in generated OpenAPI examples; it is not an executable runtime dependency.';
    case 'build-documentation-policy-reference':
      return 'Retain as authoritative documentation used by a build-time policy check; it is not an executable runtime dependency.';
    case 'static-label-provenance-reference':
      return 'Retain as provenance for a frozen validation or backtest label set; it is not an executable runtime dependency.';
    case 'user-action-link-reference':
      return 'Retain as a user-initiated outbound action link; it is not an automatic runtime dependency.';
    case 'example-placeholder-reference':
      return 'Retain as non-operational example or input placeholder text.';
    case 'semantic-vocabulary-reference':
      return 'Retain as an identifier or namespace; no network retrieval is required at runtime.';
    case 'non-runtime-reference':
      return 'Document as non-runtime evidence; no runtime remediation required.';
    default:
      return 'Review classification.';
  }
}

function markdownTable(candidateHeaders, candidateRows) {
  const escapeCell = (candidateValue) => String(candidateValue ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');

  return [
    `| ${candidateHeaders.map(escapeCell).join(' | ')} |`,
    `| ${candidateHeaders.map(() => '---').join(' | ')} |`,
    ...candidateRows.map((candidateRow) => `| ${candidateRow.map(escapeCell).join(' | ')} |`),
  ].join('\n');
}

export function buildRemediationPlan(sourceReport) {
  if (!isRecord(sourceReport)) throw new TypeError('source report must be an object');

  const externalHosts = Array.isArray(sourceReport.externalHosts) ? sourceReport.externalHosts : [];
  const directProviderFindings = Array.isArray(sourceReport.directAiProviderReferences)
    ? sourceReport.directAiProviderReferences
    : [];

  const hostItems = externalHosts.map((candidateHostEntry) => {
    const disposition = hostDisposition(candidateHostEntry);
    const referencedFiles = occurrenceFiles(candidateHostEntry);
    return {
      host: normalizeHost(candidateHostEntry?.host),
      occurrenceCount: Array.isArray(candidateHostEntry?.occurrences)
        ? candidateHostEntry.occurrences.length
        : 0,
      files: referencedFiles,
      disposition,
      action: remediationAction(disposition),
    };
  });

  const directProviderItems = directProviderFindings.map((candidateFinding) => {
    const disposition = directProviderDisposition(candidateFinding);
    return {
      file: normalizeRepositoryFile(candidateFinding?.file),
      line: Number(candidateFinding?.line ?? 0),
      match: String(candidateFinding?.match ?? ''),
      context: String(candidateFinding?.context ?? ''),
      disposition,
      action: remediationAction(disposition),
    };
  });

  const actionableHosts = hostItems
    .filter((candidateItem) => ['runtime-dependency', 'review-required'].includes(candidateItem.disposition))
    .sort((leftItem, rightItem) => {
      if (rightItem.occurrenceCount !== leftItem.occurrenceCount) {
        return rightItem.occurrenceCount - leftItem.occurrenceCount;
      }
      return leftItem.host.localeCompare(rightItem.host);
    });

  const actionableDirectProviderItems = directProviderItems
    .filter((candidateItem) => [
      'runtime-provider-endpoint',
      'runtime-provider-reference',
      'review-required',
    ].includes(candidateItem.disposition));

  return {
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: sourceReport.generatedAt ?? null,
    scannedFileCount: Number(sourceReport.scannedFileCount ?? sourceReport.scannedFiles ?? 0),
    summary: {
      externalHostEntries: hostItems.length,
      hostDispositionCounts: countBy(hostItems, (candidateItem) => candidateItem.disposition),
      actionableHostEntries: actionableHosts.length,
      directProviderEntries: directProviderItems.length,
      directProviderDispositionCounts: countBy(
        directProviderItems,
        (candidateItem) => candidateItem.disposition,
      ),
      actionableDirectProviderEntries: actionableDirectProviderItems.length,
    },
    priorityQueue: {
      externalHosts: actionableHosts,
      directProviderReferences: actionableDirectProviderItems,
    },
    evidence: {
      externalHosts: hostItems,
      directProviderReferences: directProviderItems,
    },
  };
}

export function renderMarkdown(candidatePlan) {
  const summaryRows = [
    ['Scanned files', candidatePlan.scannedFileCount],
    ['Raw external-host entries', candidatePlan.summary.externalHostEntries],
    ['Actionable host entries', candidatePlan.summary.actionableHostEntries],
    ['Raw direct-provider entries', candidatePlan.summary.directProviderEntries],
    ['Actionable direct-provider entries', candidatePlan.summary.actionableDirectProviderEntries],
  ];

  const hostDispositionRows = sortCountEntries(candidatePlan.summary.hostDispositionCounts)
    .map(([candidateDisposition, candidateCount]) => [candidateDisposition, candidateCount]);

  const providerDispositionRows = sortCountEntries(candidatePlan.summary.directProviderDispositionCounts)
    .map(([candidateDisposition, candidateCount]) => [candidateDisposition, candidateCount]);

  const priorityHostRows = candidatePlan.priorityQueue.externalHosts
    .slice(0, 100)
    .map((candidateItem) => [
      candidateItem.host,
      candidateItem.occurrenceCount,
      candidateItem.disposition,
      candidateItem.files.slice(0, 5).join('<br>'),
      candidateItem.action,
    ]);

  const priorityProviderRows = candidatePlan.priorityQueue.directProviderReferences
    .map((candidateItem) => [
      `${candidateItem.file}:${candidateItem.line}`,
      candidateItem.match,
      candidateItem.disposition,
      candidateItem.context,
      candidateItem.action,
    ]);

  return [
    '# VISTA Sovereign Runtime Remediation Plan',
    '',
    `Generated: ${candidatePlan.generatedAt}`,
    '',
    '## Scope summary',
    '',
    markdownTable(['Measure', 'Count'], summaryRows),
    '',
    '## External-host dispositions',
    '',
    markdownTable(['Disposition', 'Count'], hostDispositionRows),
    '',
    '## Direct-provider dispositions',
    '',
    markdownTable(['Disposition', 'Count'], providerDispositionRows),
    '',
    '## Priority external-host queue',
    '',
    priorityHostRows.length > 0
      ? markdownTable(['Host', 'Occurrences', 'Disposition', 'Files', 'Required action'], priorityHostRows)
      : 'No actionable host entries were identified.',
    '',
    '## Priority direct-provider queue',
    '',
    priorityProviderRows.length > 0
      ? markdownTable(['Location', 'Match', 'Disposition', 'Context', 'Required action'], priorityProviderRows)
      : 'No actionable direct-provider entries were identified.',
    '',
    '## Governance notes',
    '',
    '- The source dependency map remains immutable evidence.',
    '- Scanner artifacts, tests, examples, generated schemas, and descriptive data are separated from runtime dependencies.',
    '- Runtime candidates remain findings, not automatically approved or prohibited endpoints.',
    '- Each runtime candidate requires an explicit cache, relay, stale-data, local-inference, or removal decision.',
    '',
  ].join('\n');
}

async function main() {
  const [inputFile, outputJsonFile, outputMarkdownFile] = process.argv.slice(2);
  if (!inputFile || !outputJsonFile || !outputMarkdownFile) {
    throw new Error(
      'usage: node scripts/build-sovereign-remediation-plan.mjs <input.json> <output.json> <output.md>',
    );
  }

  const sourceReport = JSON.parse(await fs.readFile(path.resolve(inputFile), 'utf8'));
  const remediationPlan = buildRemediationPlan(sourceReport);

  await fs.mkdir(path.dirname(path.resolve(outputJsonFile)), { recursive: true });
  await fs.mkdir(path.dirname(path.resolve(outputMarkdownFile)), { recursive: true });
  await fs.writeFile(path.resolve(outputJsonFile), `${JSON.stringify(remediationPlan, null, 2)}\n`);
  await fs.writeFile(path.resolve(outputMarkdownFile), renderMarkdown(remediationPlan));

  process.stdout.write(`${JSON.stringify(remediationPlan.summary, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  main().catch((candidateError) => {
    process.stderr.write(`${candidateError?.stack ?? candidateError}\n`);
    process.exitCode = 1;
  });
}
