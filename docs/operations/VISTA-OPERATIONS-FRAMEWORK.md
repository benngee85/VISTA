# VISTA operations framework

## Control separation

- `vista-doctor.zsh` performs read-only discovery and records all findings.
- `vista-remediate.zsh` changes only explicitly selected, allowlisted findings.
- `vista-validate.zsh` provides quick, static, smoke, dependency and full profiles.
- `vista-housekeeping.zsh` reports by default; deletion requires an explicit mode.
- `vista-compose.zsh` makes `.env` plus `.secrets/runtime.env` authoritative.

Every long-running command uses a 25-second heartbeat and records elapsed time,
return code and captured output. Evidence is checksummed and packaged for review.

## Environment authority

- `.env.example`: tracked variable and documentation contract.
- `.env`: non-secret deployment configuration.
- `.secrets/runtime.env`: mode-600 runtime authentication material.
- `config/operations/network-profiles.env`: declarative transport constraints.
- Platform renderers should consume these sources; they must not become new
  independent authorities.

Production Kubernetes, GKE and k3s deployments should inject secrets through a
CSI driver or an approved external-secret service. Kubernetes Secret manifests
must not become the source of truth. Podman should use Quadlet credentials or
systemd credentials rather than literals in unit files.

## OCI hardening baseline

- Digest-pin base and runtime images.
- Run as a fixed non-root UID.
- Read-only root filesystem and writable named volumes only where required.
- Drop all Linux capabilities and add back only evidenced requirements.
- Apply seccomp, SELinux/AppArmor and `no-new-privileges`.
- Generate SPDX or CycloneDX SBOMs and retain provenance/attestations.
- Scan OS and language dependencies before promotion.
- Sign images and verify signatures at admission.
- Separate web, API, relay, cache and entitlement-service identities.
- Apply default-deny ingress and egress policy.

## npm lifecycle decisions

`package-lock.json` deprecation markers, `npm audit`, `npm outdated`, SBOM
scanners and container scanners provide different evidence and must not be
collapsed into one score.

Prioritise:

1. Unsupported or deprecated direct production dependencies.
2. Known exploitable vulnerabilities reachable from runtime paths.
3. Abandoned transitive dependencies with a direct owner that can be upgraded.
4. Build-only vulnerabilities that can affect generated artifacts.
5. Development-only findings with no production reachability.

Do not run `npm audit fix --force` automatically. Record the owning direct
dependency, replacement candidates, API impact, licensing, maintenance activity,
Node compatibility, test evidence and rollback path.

## SATCOM and constrained links

MTU 1280 is the IPv6 minimum link MTU. An overlay cannot safely consume
encapsulation overhead from an already-constrained 1280-byte underlay while still
presenting a compliant IPv6 1280-byte pod interface. Prefer a higher underlay MTU,
direct routing, or an architecture that avoids nested overlays. Validate PMTUD,
MSS and CNI-specific overhead.

For 350–500 ms RTT, intermittent loss and links below 25 kbit/s:

- pre-position OCI images and dependencies in the operational enclave;
- use local registries, signed release bundles and resumable transfer;
- avoid runtime image pulls and network-dependent package installation;
- use bounded exponential backoff with full jitter for idempotent operations;
- constrain concurrency to one on the narrowband profile;
- compress structured payloads and use conditional/delta retrieval;
- prioritise small control messages over imagery and bulk historical ingest;
- support store-and-forward, stale-while-revalidate and explicit freshness;
- separate request timeout, provider processing timeout and overall job budget;
- retain progress heartbeats without transmitting high-volume logs.

Network-profile variables are declarative until each consumer has tests proving
that it honours them.
