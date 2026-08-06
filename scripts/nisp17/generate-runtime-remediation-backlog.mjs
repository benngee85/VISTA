import fs from 'node:fs';
import path from 'node:path';

const [planPath, outputDirectory] = process.argv.slice(2);
if (!planPath || !outputDirectory) {
  console.error('Usage: generate-runtime-remediation-backlog.mjs <plan> <output>');
  process.exit(2);
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const runtimeEntries = (plan.evidence?.externalHosts ?? [])
  .filter((entry) => entry.disposition === 'runtime-dependency');

function familyFor(entry) {
  const text = `${entry.host}\n${(entry.files ?? []).join('\n')}`.toLowerCase();
  if (/worldmonitor\.app/.test(text)) return 'vista-first-party';
  if (/github\.com/.test(text)) return 'software-supply-chain';
  if (/news|rss|feed/.test(text)) return 'news-and-rss';
  if (/map|tile|geo|weather|imagery/.test(text)) return 'geospatial-and-imagery';
  if (/market|finance|stock|fred|eia|imf|bank/.test(text)) return 'market-and-economic-data';
  if (/identity|oauth|auth|login/.test(text)) return 'identity-and-access';
  if (/llm|model|openai|anthropic|groq|openrouter/.test(text)) return 'ai-and-model-services';
  if (/video|stream|media|youtube/.test(text)) return 'media-and-streaming';
  return 'authoritative-and-specialist-data';
}

const decisionByFamily = {
  'vista-first-party': 'localise',
  'software-supply-chain': 'mirror',
  'news-and-rss': 'relay',
  'geospatial-and-imagery': 'cache',
  'market-and-economic-data': 'relay',
  'identity-and-access': 'replace',
  'ai-and-model-services': 'localise',
  'media-and-streaming': 'disable',
  'authoritative-and-specialist-data': 'retain'
};

const entries = runtimeEntries.map((entry, index) => {
  const dependencyFamily = familyFor(entry);
  return {
    id: `RUNTIME-${String(index + 1).padStart(4, '0')}`,
    host: entry.host,
    evidencePartition: {
      occurrenceCount: entry.occurrenceCount,
      files: entry.files
    },
    dependencyFamily,
    proposedDecision: decisionByFamily[dependencyFamily],
    decisionStatus: 'proposed',
    nispServiceArea: null,
    deploymentProfiles: [],
    trustBoundary: null,
    freshnessPolicy: null,
    disconnectedBehaviour: null,
    owner: null,
    evidence: [],
    residualRisk: null
  };
});

const familySummary = Object.values(
  entries.reduce((summary, entry) => {
    const key = entry.dependencyFamily;
    summary[key] ??= {
      dependencyFamily: key,
      runtimePartitionCount: 0,
      proposedDecisions: {}
    };
    summary[key].runtimePartitionCount += 1;
    summary[key].proposedDecisions[entry.proposedDecision] =
      (summary[key].proposedDecisions[entry.proposedDecision] ?? 0) + 1;
    return summary;
  }, {}),
).sort((left, right) =>
  left.dependencyFamily.localeCompare(right.dependencyFamily),
);

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, 'runtime-remediation-backlog.json'),
  `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceActionableHostEntries: plan.summary?.actionableHostEntries,
    runtimePartitionCount: entries.length,
    entries
  }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outputDirectory, 'runtime-remediation-family-summary.json'),
  `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    families: familySummary
  }, null, 2)}\n`,
);

const markdown = [
  '# VISTA Runtime Dependency Remediation Backlog',
  '',
  `Runtime evidence partitions: **${entries.length}**`,
  '',
  '| Dependency family | Partitions | Proposed decisions |',
  '|---|---:|---|',
  ...familySummary.map((item) =>
    `| ${item.dependencyFamily} | ${item.runtimePartitionCount} | ${
      Object.entries(item.proposedDecisions)
        .map(([decision, count]) => `${decision}: ${count}`)
        .join(', ')
    } |`
  ),
  '',
  'All decisions are engineering proposals pending architecture, security,',
  'licensing, federation and operational approval.',
  ''
].join('\n');

fs.writeFileSync(
  path.join(outputDirectory, 'runtime-remediation-backlog.md'),
  `${markdown}\n`,
);

console.log(`runtime_partitions=${entries.length}`);
console.log(`dependency_families=${familySummary.length}`);
