# Rocky 9 relay trial baseline

## Scope

This profile introduces a parallel Rocky 9 AIS/data relay while retaining the
Alpine relay as rollback. It is a deployment-instance baseline, not yet a
Kubernetes production profile or an accredited security configuration.

## Observed legacy workload

- Approximately 20,000 live vessels.
- Approximately 262–266 MB resident memory.
- Queue depth remained zero.
- Dropped messages remained zero.
- Approximately 1.95 million messages processed before controlled shutdown.

## Trial resource settings

- Memory request: 384 MiB.
- Memory limit: 768 MiB.
- CPU request and limit: deferred pending measurement.

## Data-source remediation backlog

- ACLED HTTP 403: credential, entitlement or API-contract correction.
- Yahoo sector HTTP 401: upstream authentication/contract correction.
- OpenSky HTTP 503: proxy and upstream-availability correction.
- Inside Climate News HTTP 403: source-access correction.
- USNI region warnings: governed geographic terminology mapping.
- Forecast funnel seed error: separate seeder investigation.

Australian and FVEY authoritative alternatives are enhancement candidates.
They complement rather than silently replace the federation semantic baseline.
