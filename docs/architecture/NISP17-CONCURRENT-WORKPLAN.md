# VISTA NISP 17 and Runtime Remediation Concurrent Workplan

## Decision

VISTA standardises interfaces and assurance contracts while runtime dependencies
are remediated through controlled service boundaries.

## Sequence

1. Integrate and validate the latest upstream baseline.
2. Establish the selected NISP 17 applicability profile.
3. Group runtime evidence partitions into remediation families.
4. Standardise HTTP, JSON, OpenAPI, URI, identity, DNS and time contracts.
5. Extract the controlled acquisition gateway.
6. Introduce identity and policy-enforcement boundaries.
7. Deploy semantic, geospatial, observability and AI service planes.
8. Validate each increment against deployment profiles.

## Upstream policy

VISTA-authored identity, sovereign configuration and security policy remain
authoritative where upstream changes conflict. Upstream functional changes are
retained where they merge cleanly. Generated artefacts are regenerated from the
resolved source tree rather than manually reconciled.

## First extraction

The controlled acquisition gateway is the first target service boundary. New
external provider integrations are prohibited outside this boundary after its
interface and policy profile are approved.
