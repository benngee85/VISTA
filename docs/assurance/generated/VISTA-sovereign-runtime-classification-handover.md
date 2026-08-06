# VISTA Sovereign Runtime Classification — Handover and Decision Record

**Status:** Classification closure complete  
**Closure archive:** `vista-sovereign-classification-closure-236-20260806T142159Z.zip`  
**Repository:** `benngee85/VISTA`  
**Working branch:** `fix/sovereign-completion-20260806T053100Z`  
**Baseline commit:** `af180143daa7ccd7a301d08f02f798085ca082fc`  
**Generated:** 2026-08-07 Australia/Brisbane

## 1. Purpose

This record preserves the decisions, evidence rules, failure lessons, and closure state from the VISTA sovereign-runtime dependency classification activity. It is intended to prevent repeated rediscovery or re-explanation of the work.

The activity classified externally referenced hosts without deleting source URLs, removing data sources, changing Docker volumes, committing, pushing, or publishing changes.

## 2. Final outcome

| Measure | Result |
| --- | ---: |
| Scanned files | 2,038 |
| Raw external-host entries | 1,020 |
| Actionable runtime host entries | 632 |
| Raw direct-provider entries | 20 |
| Actionable direct-provider entries | 0 |
| Classification batches reviewed | 15 |
| Remaining unreviewed actionable hosts | 0 |
| Test suite | 43 passed |

The direct AI-provider references were classified as:

- 12 descriptive-data references;
- 8 audit-self-references;
- 0 actionable direct-provider dependencies.

## 3. Final closure hosts

The final five previously unreviewed hosts were retained as runtime dependencies:

1. `api.worldmonitor.app`
2. `github.com`
3. `news.google.com`
4. `worldmonitor.app`
5. `www.worldmonitor.app`

These are operational, deployment, update, feed, repository, identity, or canonical application dependencies. They were not removed or reclassified as non-runtime references.

## 4. Governing semantic rules

### 4.1 Preserve evidence partitions

A normalized hostname may have multiple evidence records where the occurrences belong to different semantic partitions. The planner therefore permits duplicate normalized hosts when the records retain distinct provenance or lifecycle meaning.

Example: `techcrunch.com` has two retained evidence partitions:

| Partition | Occurrences | Disposition |
| --- | ---: | --- |
| Mixed test and production feed references | 47 | `runtime-dependency` |
| Separate test-only trailing-dot reference | 1 | `test-evidence-reference` |

The planner must not collapse these partitions merely because the normalized host strings are equal.

### 4.2 Closure aggregation precedence

When a host-level closure decision is required across multiple evidence partitions, apply this precedence:

1. `runtime-dependency`
2. `review-required`
3. a unique non-runtime disposition
4. otherwise `partitioned-non-runtime`

This is an aggregation rule for reporting and closure. It does not modify or collapse the underlying evidence partitions.

### 4.3 Mixed-use hosts remain runtime

A host with both runtime and non-runtime evidence remains actionable as a runtime dependency. Test, fixture, documentation, attribution, or provenance occurrences do not negate production runtime evidence.

### 4.4 Test evidence requires partition confinement

A record may be classified as `test-evidence-reference` only when all occurrences in that evidence partition are test or fixture evidence. Production runtime paths in the same partition take precedence.

### 4.5 Foundation principle

Classification must preserve source, provenance, lifecycle, and operational context. Hostname equality alone is insufficient justification for semantic collapse.

## 5. Disposition inventory

The completed remediation plan reports the following external-host dispositions:

| Disposition | Count |
| --- | ---: |
| `runtime-dependency` | 632 |
| `scanner-artifact` | 137 |
| `static-data-provenance-reference` | 92 |
| `static-manifest-provenance-reference` | 22 |
| `test-evidence-reference` | 21 |
| `user-facing-attribution-reference` | 20 |
| `fixture-or-example` | 18 |
| `user-setup-link-reference` | 12 |
| `documentation-reference` | 10 |
| `user-action-link-reference` | 10 |
| `static-catalog-provenance-reference` | 8 |
| `semantic-vocabulary-reference` | 6 |
| `static-claim-provenance-reference` | 5 |
| `dependency-lock-reference` | 4 |
| `non-runtime-reference` | 4 |
| `static-label-provenance-reference` | 4 |
| `client-origin-reference` | 3 |
| `build-time-dependency` | 2 |
| `example-placeholder-reference` | 2 |
| `static-source-attribution-reference` | 2 |
| `build-documentation-policy-reference` | 1 |
| `config-schema-reference` | 1 |
| `generated-openapi-example-reference` | 1 |
| `security-negative-fixture` | 1 |
| `terms-and-policy-reference` | 1 |
| `user-signin-link-reference` | 1 |

## 6. Safe reclassifications established during the batches

Representative confirmed non-runtime classifications include:

- user actions and sharing: LinkedIn, WhatsApp, X/Twitter, Facebook, Telegram, Discord;
- user setup or sign-in: Telegram setup, Google/YouTube sign-in;
- attribution: AviationStack, Global Energy Monitor, OpenFreeMap, Kalshi, Polymarket, NHC, UN Comtrade, Windy;
- documentation: Financial Modeling Prep developer site, IMF developer portal;
- static provenance: IFSWF manifests, packaged source and claim references;
- build-time or lock metadata: Node.js, npm registry, funding links;
- semantic vocabularies: Schema.org, W3C, PURL and protocol/schema identifiers;
- fixtures and examples: MCP placeholders, proxy placeholders, malicious-userinfo security fixture.

Exact classifications remain encoded in `scripts/build-sovereign-remediation-plan.mjs`, its test suite, batch ledgers, and the final remediation-plan JSON.

## 7. Important defects and lessons

### 7.1 Exact URL punctuation is scanner evidence

The scanner may retain source punctuation in URL strings, such as a trailing quote or semicolon. Exact-evidence guards must compare against the scanner output, not a cleaned human interpretation.

### 7.2 Do not infer host-level meaning from one record lookup

Using `.find()` returns the first matching evidence partition. Converting records to a simple `Map<host, entry>` retains the last partition. Neither is a valid host-level aggregation mechanism where duplicate normalized hosts are permitted.

### 7.3 Do not merge evidence partitions globally

A broad merge-by-normalized-host patch caused seven test regressions by collapsing intentionally separate provenance, documentation, semantic-vocabulary, setup, security-fixture, and runtime partitions.

### 7.4 Synthetic tests must exercise the intended rule branch

A synthetic hostname ending in `.example` triggered the fixture classifier before reaching the mixed-use/test rule. Test fixtures must avoid special lexical forms unless that classifier is the intended subject.

### 7.5 One authoritative plan per closure run

Closure validation, reviewed ledgers, candidate selection, and reporting should use the same in-memory plan instance. Rebuilding or re-reading intermediate plan files can introduce stale-state divergence.

### 7.6 Prefer invariants over host-specific exceptions

Host-specific rules remain appropriate for exact, evidence-constrained safe reclassifications. Cross-cutting behaviour—mixed-use precedence, test confinement, and partition aggregation—must be implemented as general invariants.

## 8. Batch closure summary

The classification progressed through 15 batches. Batch 14 safely reclassified:

- `t.me` → `user-action-link-reference`;
- `www.ifswf.org` → `static-manifest-provenance-reference`.

Batch 14 retained 48 runtime or mixed-use records. Batch 15 reviewed and retained the final five runtime hosts. No unresolved actionable hosts remain.

## 9. Repository state at closure

The working tree was intentionally not committed. Recorded state included:

- modified: `scripts/run-seeders.sh`;
- untracked: `scripts/audit-sovereign-runtime.mjs`;
- untracked: `scripts/build-sovereign-remediation-plan.mjs`;
- untracked: `scripts/seeder-outcome-classifier.sh`;
- untracked: `tests/run-seeders-summary-classification.test.mjs`;
- untracked: `tests/sovereign-remediation-plan.test.mjs`.

Because these files are untracked, they are not available from the published GitHub commit and must not be assumed to be documented by repository Markdown.

## 10. Authoritative retained artefacts

The final closure archive contains:

- `after/sovereign-remediation-plan.md`;
- `after/sovereign-remediation-plan.json`;
- `after/classification-closure.json`;
- `after/batch-014-reviewed.json`;
- `after/batch-014-failure-ledger.json`;
- `after/batch-015-reviewed.json`;
- `after/batch-015-failure-ledger.json`;
- `after/reviewed-host-registry.json`;
- the exact classifier and regression test source;
- Git status and diff-stat evidence.

The generated remediation plan is an operational queue and disposition report. This handover is the narrative architecture and decision record that was previously missing.

## 11. Recommended repository documentation placement

Recommended target path:

```text
docs/assurance/sovereign-runtime-classification.md
```

Recommended supporting machine-readable artefacts:

```text
docs/assurance/generated/sovereign-remediation-plan.json
docs/assurance/generated/classification-closure.json
docs/assurance/generated/reviewed-host-registry.json
```

The generated files should be reproducible outputs, while this Markdown record should remain the governed explanatory document.

## 12. Next engineering phase

Classification is complete; remediation is not.

The next phase should evaluate the 632 runtime entries and assign an implementation pattern such as:

- sovereign relay or egress broker;
- controlled cache or mirror;
- scheduled ingestion and local persistence;
- packaged static snapshot;
- operator-configured endpoint;
- optional degraded-mode dependency;
- deployment-specific allowlist;
- unavoidable external dependency with documented residual risk.

The remediation phase should preserve the existing evidence partitions and should not remove sources merely to reduce the runtime count.

## 13. Safety and assurance statement

During classification closure:

- no data sources were removed;
- no source URLs were removed;
- no commit was performed;
- no push was performed;
- no publication was performed;
- no Docker volume was modified.

