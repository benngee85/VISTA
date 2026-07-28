# Rocky Linux 9 split-container baseline

Status: parallel validation gate; the existing combined Alpine deployment is
retained as the rollback path.

## Architecture

- `worldmonitor-web-rocky9`: nginx, static assets and the public reverse proxy.
- `worldmonitor-api-rocky9`: direct Node API process on port 46123.
- Shared transport authentication remains `LOCAL_API_TOKEN`.
- The web-to-API destination is the single `API_UPSTREAM` variable.
- `LOCAL_API_BIND_HOST=0.0.0.0` is accepted only when
  `LOCAL_API_MODE=docker`; desktop and other modes remain loopback-only.
- Redis REST remains shared during this gate and now has an authenticated
  readiness probe. Redis and relay image migration remain separate gates.

## Security controls

- Rocky Linux 9.8 minimal is pinned by multi-architecture manifest digest.
- Images carry the reviewed source revision as OCI provenance metadata.
- Package updates are applied during each build.
- Both services run as non-root with group 0 compatibility for arbitrary
  Kubernetes/OpenShift UIDs.
- Root filesystems are read-only; only a hardened `/tmp` tmpfs is writable.
- All Linux capabilities are dropped, privilege escalation is disabled, and
  package-manager executables are absent from the API runtime.
- nginx and Node run directly as PID 1; Supervisor is not used.

FIPS-capable packages do not by themselves establish FIPS compliance. Kernel
mode, crypto policy, validated module boundaries and operational evidence remain
future accreditation gates.

The build stages remain Alpine-based in this first runtime gate. Moving builders
to an approved build environment, mirroring packages and images, signing
artifacts, and enforcing admission policy remain supply-chain gates.

## Rollout

Run the parallel profile on localhost port 3001, validate routing and shutdown,
then review its evidence bundle before changing the production service.

Australian and FVEY data-source additions, NISP profiles, FMN COI swimlanes and
symbology standardisation remain explicitly separate semantic workstreams. This
container gate does not claim conformance for them.

Kubernetes manifests are intentionally deferred until Compose parity is proven.
The next gate will translate these validated security contexts, health probes,
configuration boundaries and separate services into Kubernetes resources.


## Self-hosted browser-origin boundary

- `SELF_HOSTED_ALLOWED_ORIGINS` is a comma-separated exact-origin allowlist.
- Entries must be canonical HTTP(S) origins without credentials, paths or wildcards.
- nginx forwards the caller's actual `Origin`; it does not manufacture a trusted origin.
- `LOCAL_API_TOKEN` remains a separate transport-authentication control.
- Kubernetes ingress origins must be added explicitly during the deployment-profile gate.


## Rocky relay trial profile

The parallel Rocky relay preserves the Alpine relay as rollback. Its initial
memory request (384 MiB) and limit (768 MiB) are engineering trial values based
on an observed 262–266 MB RSS range. CPU requests remain deferred until CPU,
event-loop delay and throttling are captured under representative load.

Application data health is governed separately from container liveness.
Credential, entitlement and upstream-source failures must not be represented as
Rocky runtime failures.
