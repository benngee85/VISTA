# VISTA configuration authority

`compose.yaml` is the sole portable base Compose model. Docker Compose loads
`compose.override.yaml` as the sovereign-node extension. The Rocky Linux 9
model is an explicitly selected platform alternative and is never implicit.

Run Compose through `scripts/vista-compose.zsh`. It loads interpolation files
in this order, with later files taking precedence:

1. `.env` — non-secret fleet or information-environment policy.
2. `.env.node` — non-secret node, site, federation, and COI identity.
3. `.env.local` — non-secret local Compose-instance settings.
4. `.secrets/runtime.env` — transitional protected interpolation values. This final layer is required until every consumer uses a dedicated file-backed secret.

Credentials, bearer tokens, passwords, private keys, and signing keys do not
belong in any `.env*` layer. They are mounted as one-file-per-secret objects
under `.secrets/` and made available only to services that require them.

The migration is deliberately staged: legacy secret values that applications
still consume from `.env` remain a recorded remediation item until each
consumer supports a dedicated file-backed secret. They must not be copied into
`.env.node` or `.env.local`.

Future signing and encryption are outside this increment. A future
configuration controller should validate schema and ownership, stage changes,
run Compose and contract checks, apply atomically, verify health, and retain an
auditable rollback record. Node-RED may orchestrate that controller but should
not receive unrestricted direct write access to the repository or Docker
socket.
