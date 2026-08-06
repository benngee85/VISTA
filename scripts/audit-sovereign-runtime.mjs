import fs from 'node:fs';
import path from 'node:path';

const [
  repositoryRoot,
  jsonFileName,
  markdownFileName,
] = process.argv.slice(2);

if (
  !repositoryRoot ||
  !jsonFileName ||
  !markdownFileName
) {
  throw new Error(
    'Usage: audit-sovereign-runtime.mjs <repo> <json> <markdown>',
  );
}

const includedExtensions =
  new Set(
    [
      '.cjs',
      '.css',
      '.html',
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.mts',
      '.sh',
      '.ts',
      '.tsx',
      '.yaml',
      '.yml',
    ],
  );

const excludedDirectories =
  new Set(
    [
      '.git',
      'blog-site',
      'dist',
      'node_modules',
      'public',
      'target',
    ],
  );

const runtimeRoots = [
  'api',
  'docker',
  'e2e',
  'scripts',
  'server',
  'src',
  'src-tauri',
];

const directAiPattern =
  /\b(?:grok|xai|x\.ai|api\.x\.ai)\b/giu;

const externalUrlPattern =
  /https?:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+/gu;

const energyPattern =
  /\b(?:energy\s*(?:&|and)\s*resources?|energy resources?|EIA|oil|gas|coal|uranium|electricity|commodity)\b/giu;

const unavailablePattern =
  /\b(?:unavailable|failed to load|not configured|no data|initiali[sz](?:e|ing)|offline)\b/giu;

const relayPattern =
  /\b(?:relay|peer|mesh|gossip|sync|replication|store-and-forward|cache|valkey|redis-rest|sidecar)\b/giu;

const exportPattern =
  /\b(?:export|screenshot|watermark|html2canvas|toDataURL|download|pdf|png)\b/giu;

const storyPattern =
  /\b(?:country intelligence|story|read more|full report|sourceUrl|articleUrl)\b/giu;

function walk(
  directoryName,
) {
  const entries = [];

  if (
    !fs.existsSync(
      directoryName,
    )
  ) {
    return entries;
  }

  for (
    const directoryEntry of fs.readdirSync(
      directoryName,
      {
        withFileTypes: true,
      },
    )
  ) {
    if (
      directoryEntry.isDirectory() &&
      excludedDirectories.has(
        directoryEntry.name,
      )
    ) {
      continue;
    }

    const fullName =
      path.join(
        directoryName,
        directoryEntry.name,
      );

    if (
      directoryEntry.isDirectory()
    ) {
      entries.push(
        ...walk(
          fullName,
        ),
      );

      continue;
    }

    if (
      !directoryEntry.isFile() ||
      !includedExtensions.has(
        path.extname(
          directoryEntry.name,
        ),
      )
    ) {
      continue;
    }

    entries.push(
      fullName,
    );
  }

  return entries;
}

function lineNumber(
  text,
  characterIndex,
) {
  return (
    text
      .slice(
        0,
        characterIndex,
      )
      .split('\n')
      .length
  );
}

function collectMatches(
  relativeName,
  text,
  pattern,
  category,
) {
  const matches = [];

  pattern.lastIndex = 0;

  for (
    const match of text.matchAll(
      pattern,
    )
  ) {
    const matchIndex =
      match.index ?? 0;

    const lineStart =
      text.lastIndexOf(
        '\n',
        matchIndex,
      ) + 1;

    const lineEndCandidate =
      text.indexOf(
        '\n',
        matchIndex,
      );

    const lineEnd =
      lineEndCandidate < 0
        ? text.length
        : lineEndCandidate;

    matches.push(
      {
        category,
        file:
          relativeName,
        line:
          lineNumber(
            text,
            matchIndex,
          ),
        match:
          match[0],
        context:
          text
            .slice(
              lineStart,
              lineEnd,
            )
            .trim()
            .slice(
              0,
              600,
            ),
      },
    );
  }

  return matches;
}

const files =
  runtimeRoots.flatMap(
    (runtimeRoot) =>
      walk(
        path.join(
          repositoryRoot,
          runtimeRoot,
        ),
      ),
  );

const findings = [];
const hosts = new Map();

for (
  const fileName of files
) {
  const relativeName =
    path.relative(
      repositoryRoot,
      fileName,
    );

  const text =
    fs.readFileSync(
      fileName,
      'utf8',
    );

  findings.push(
    ...collectMatches(
      relativeName,
      text,
      directAiPattern,
      'direct-ai-provider',
    ),
    ...collectMatches(
      relativeName,
      text,
      energyPattern,
      'energy-resources',
    ),
    ...collectMatches(
      relativeName,
      text,
      unavailablePattern,
      'unavailable-state',
    ),
    ...collectMatches(
      relativeName,
      text,
      relayPattern,
      'relay-capability',
    ),
    ...collectMatches(
      relativeName,
      text,
      exportPattern,
      'export',
    ),
    ...collectMatches(
      relativeName,
      text,
      storyPattern,
      'country-story',
    ),
  );

  externalUrlPattern.lastIndex = 0;

  for (
    const urlMatch of text.matchAll(
      externalUrlPattern,
    )
  ) {
    let parsedUrl;

    try {
      parsedUrl =
        new URL(
          urlMatch[0],
        );
    } catch {
      continue;
    }

    const hostName =
      parsedUrl.hostname.toLowerCase();

    if (
      hostName === 'localhost' ||
      hostName === '127.0.0.1' ||
      hostName === '0.0.0.0' ||
      hostName.endsWith(
        '.local',
      )
    ) {
      continue;
    }

    const hostRecord =
      hosts.get(
        hostName,
      ) ?? {
        host:
          hostName,
        occurrences: [],
      };

    hostRecord.occurrences.push(
      {
        file:
          relativeName,
        line:
          lineNumber(
            text,
            urlMatch.index ?? 0,
          ),
        url:
          urlMatch[0].slice(
            0,
            500,
          ),
      },
    );

    hosts.set(
      hostName,
      hostRecord,
    );
  }
}

const directAiFindings =
  findings.filter(
    (finding) =>
      finding.category ===
      'direct-ai-provider',
  );

const report = {
  generatedAt:
    new Date().toISOString(),
  scannedFileCount:
    files.length,
  directAiProviderReferences:
    directAiFindings,
  externalHosts:
    [...hosts.values()].sort(
      (
        left,
        right,
      ) =>
        left.host.localeCompare(
          right.host,
        ),
    ),
  findings,
  requiredArchitecture: {
    localInference:
      [
        'OpenAI-compatible local endpoint',
        'Ollama-compatible local endpoint',
        'Anthropic-compatible relay endpoint',
      ],
    transport:
      [
        'store-and-forward node relay',
        'signed data envelopes',
        'deduplication identifiers',
        'bounded retry queues',
        'peer health and staleness metadata',
      ],
    offlineBehavior:
      [
        'last-known-good cache',
        'explicit stale timestamps',
        'no indefinite loading state',
        'no mandatory direct Grok/xAI call',
        'export without watermark or viewport-only capture',
      ],
  },
};

fs.writeFileSync(
  jsonFileName,
  `${JSON.stringify(
    report,
    null,
    2,
  )}\n`,
);

const grouped =
  new Map();

for (
  const finding of findings
) {
  const values =
    grouped.get(
      finding.category,
    ) ?? [];

  values.push(
    finding,
  );

  grouped.set(
    finding.category,
    values,
  );
}

const markdownLines = [
  '# VISTA Sovereign and Darknet Dependency Map',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  `Scanned files: ${report.scannedFileCount}`,
  `External hosts: ${report.externalHosts.length}`,
  `Direct Grok/xAI references: ${directAiFindings.length}`,
  '',
  '## Required operating contract',
  '',
  '- No widget may remain indefinitely loading or merely report unavailable.',
  '- Every internet-backed widget requires cached, relayed, or explicitly stale offline data.',
  '- AI features must target configurable local or relayed inference endpoints.',
  '- Direct Grok/xAI calls are prohibited in sovereign runtime paths.',
  '- Country-story controls must resolve to an internal cached record or an approved external reference.',
  '- Export must produce a complete artifact, not a viewport-only watermarked capture.',
  '',
  '## External hosts',
  '',
];

for (
  const hostRecord of report.externalHosts
) {
  markdownLines.push(
    `- \`${hostRecord.host}\` — ${hostRecord.occurrences.length} occurrence(s)`,
  );
}

markdownLines.push('');

for (
  const [
    category,
    categoryFindings,
  ] of grouped
) {
  markdownLines.push(
    `## ${category}`,
    '',
  );

  for (
    const finding of categoryFindings.slice(
      0,
      300,
    )
  ) {
    markdownLines.push(
      `- \`${finding.file}:${finding.line}\` — ${finding.context}`,
    );
  }

  if (
    categoryFindings.length > 300
  ) {
    markdownLines.push(
      `- ${categoryFindings.length - 300} additional occurrence(s) are retained in the JSON report.`,
    );
  }

  markdownLines.push('');
}

fs.writeFileSync(
  markdownFileName,
  `${markdownLines.join('\n')}\n`,
);

console.log(
  JSON.stringify(
    {
      scannedFiles:
        report.scannedFileCount,
      externalHosts:
        report.externalHosts.length,
      directAiProviderReferences:
        directAiFindings.length,
      findings:
        findings.length,
    },
    null,
    2,
  ),
);
