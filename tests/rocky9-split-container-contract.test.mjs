import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const api = readFileSync('docker/Dockerfile.rocky9-api', 'utf8');
const web = readFileSync('docker/Dockerfile.rocky9-web', 'utf8');
const relay = readFileSync('docker/Dockerfile.rocky9-relay', 'utf8');
const entitlements = readFileSync('docker/Dockerfile.rocky9-entitlements', 'utf8');
const nginx = readFileSync('docker/nginx-rocky9.conf.template', 'utf8');
const entrypoint = readFileSync('docker/rocky9-web-entrypoint.sh', 'utf8');
const compose = readFileSync('docker-compose.rocky9.yml', 'utf8');
const sidecar = readFileSync('src-tauri/sidecar/local-api-server.mjs', 'utf8');
const cors = readFileSync('api/_cors.js', 'utf8');

const pinnedRocky =
  /quay\.io\/rockylinux\/rockylinux:9\.8-minimal@sha256:e1d0a9f5ed99d52e7faf03afe7ee32e48b231c4dd9586808b3d1aedf894dff04/;

test('Rocky runtime images use the reviewed multi-arch 9.8 manifest', () => {
  assert.match(api, pinnedRocky);
  assert.match(web, pinnedRocky);
  assert.match(relay, pinnedRocky);
  assert.match(entitlements, pinnedRocky);
  assert.match(api, /microdnf -y update/);
  assert.match(web, /microdnf -y update/);
});

test('images receive the build revision externally and retain the sitemap contract', () => {
  assert.match(api, /ARG VCS_REF=unknown/);
  assert.match(web, /ARG VCS_REF=unknown/);
  assert.match(relay, /ARG VCS_REF=unknown/);
  assert.match(entitlements, /ARG VCS_REF=unknown/);
  assert.equal(
    (compose.match(/VCS_REF: "\$\{VCS_REF:-unknown\}"/g) || []).length,
    4,
  );
  assert.match(web, /npm run build:sitemap/);
  assert.doesNotMatch(web, /npm run build:content-corpus/);
});

test('web runtime reuses Rocky curl without installing conflicting curl-minimal', () => {
  assert.match(web, /microdnf -y install nginx gettext ca-certificates/);
  assert.doesNotMatch(web, /curl-minimal/);
});

test('API and web run as separate direct PID 1 processes', () => {
  assert.match(api, /CMD \["node", "\/app\/local-api-server\.mjs"\]/);
  assert.match(web, /ENTRYPOINT \["\/app\/rocky9-web-entrypoint\.sh"\]/);
  assert.match(entrypoint, /exec \/usr\/sbin\/nginx -e \/dev\/stderr/);
  assert.doesNotMatch(api + web + entrypoint, /supervisor/i);
});

test('Docker split API bind is explicit while desktop remains loopback-only', () => {
  assert.match(compose, /LOCAL_API_BIND_HOST: "0\.0\.0\.0"/);
  assert.match(
    sidecar,
    /context\.mode === 'docker' && process\.env\.LOCAL_API_BIND_HOST === '0\.0\.0\.0'/,
  );
  assert.match(sidecar, /server\.listen\(port, bindHost\)/);
  assert.match(sidecar, /: '127\.0\.0\.1';/);
  assert.doesNotMatch(sidecar, /server\.listen\(port, '127\.0\.0\.1'\)/);
});

test('web proxy uses one configurable service upstream', () => {
  assert.match(nginx, /proxy_pass \$\{API_UPSTREAM\};/);
  assert.doesNotMatch(
    nginx,
    /proxy_pass http:\/\/127\.0\.0\.1:\$\{LOCAL_API_PORT\}/,
  );
  assert.match(entrypoint, /envsubst '\$API_UPSTREAM \$LOCAL_API_TOKEN'/);
});

test('runtime images support Kubernetes arbitrary UID and read-only roots', () => {
  assert.match(api, /USER 10001:0/);
  assert.match(web, /USER 10001:0/);
  assert.match(relay, /USER 10001:0/);
  assert.match(entitlements, /USER 10001:0/);
  assert.equal(
    (compose.match(/user: "1000710000:0"/g) || []).length,
    4,
  );
  assert.equal((compose.match(/read_only: true/g) || []).length, 4);
  assert.equal((compose.match(/no-new-privileges:true/g) || []).length, 4);
  assert.equal((compose.match(/- ALL/g) || []).length, 4);
  assert.equal(
    (compose.match(/\/tmp:rw,noexec,nosuid,nodev,mode=1777/g) || []).length,
    4,
  );
});

test('API final image removes package-management tooling', () => {
  assert.match(api, /microdnf -y install nodejs npm ca-certificates/);
  assert.match(api, /! command -v npm/);
  assert.match(api, /! command -v npx/);
  assert.match(api, /! command -v corepack/);
});

test('parallel profile preserves the current combined service as rollback', () => {
  assert.match(compose, /profiles: \["rocky9-split"\]/);
  assert.match(compose, /worldmonitor-api-rocky9:/);
  assert.match(compose, /worldmonitor-web-rocky9:/);
  assert.doesNotMatch(compose, /^\s{2}worldmonitor:\s*$/m);
});

test('shared Valkey REST dependency has an authenticated readiness contract', () => {
  assert.match(compose, /^\s{2}valkey-rest:\s*$/m);
  assert.match(compose, /http:\/\/127\.0\.0\.1:8080\/ping/);
  assert.match(compose, /process\.env\.SRH_TOKEN/);
  assert.match(
    compose,
    /depends_on:[\s\S]*valkey-rest:\n\s+condition: service_healthy/,
  );
});


test('self-hosted origin policy is explicit and preserves the caller origin', () => {
  assert.match(
    compose,
    /SELF_HOSTED_ALLOWED_ORIGINS: "http:\/\/127\.0\.0\.1:\$\{WM_ROCKY9_PORT:-3001\},http:\/\/localhost:\$\{WM_ROCKY9_PORT:-3001\}"/,
  );
  assert.match(nginx, /proxy_set_header Origin \$http_origin;/);
  assert.doesNotMatch(nginx, /proxy_set_header Origin http:\/\/localhost;/);
  assert.match(cors, /process\.env\.SELF_HOSTED_ALLOWED_ORIGINS/);
  assert.match(cors, /CONFIGURED_ALLOWED_ORIGINS\.has\(origin\)/);
  assert.match(cors, /parsed\.origin !== candidate/);
});


test('Docker sidecar preserves the authenticated proxy caller origin for handler policy', () => {
  assert.match(sidecar, /context\.mode === 'docker' && incomingOrigin/);
  assert.match(sidecar, /hdrs\.set\('Origin', incomingOrigin\)/);
  assert.match(
    sidecar,
    /else \{[\s\S]*hdrs\.set\('Origin', \`http:\/\/127\.0\.0\.1:\$\{context\.port\}\`\)/,
    'desktop mode must retain its loopback-origin normalization',
  );
});
