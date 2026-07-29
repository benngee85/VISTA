import { readFileSync } from 'node:fs';

const parseDotEnv = (path = '.env') => {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/u)
        .filter((line) => line && !line.trimStart().startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          return [
            line.slice(0, index).trim().replace(/^export\s+/u, ''),
            line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, ''),
          ];
        }),
    );
  } catch {
    return {};
  }
};

const dotenv = parseDotEnv();
const value = (name, fallback) =>
  String(process.env[name] || dotenv[name] || fallback).trim() || fallback;

export const VISTA_PRODUCT_IDENTITY = Object.freeze({
  name: value('VISTA_PRODUCT_NAME', value('VITE_PRODUCT_NAME', 'VISTA')),
  shortName: value('VITE_PRODUCT_SHORT_NAME', 'VISTA'),
  vendor: value('VISTA_PRODUCT_VENDOR', value('VITE_PRODUCT_VENDOR', 'MercuryLink Concepts')),
  vendorShort: value('VITE_PRODUCT_VENDOR_SHORT', 'MercuryLink'),
  repositoryUrl: value(
    'VITE_PRODUCT_REPOSITORY_URL',
    'https://github.com/benngee85/VISTA',
  ),
  xUrl: value('VITE_PRODUCT_X_URL', ''),
  xHandle: value('VITE_PRODUCT_X_HANDLE', ''),
  websiteUrl: value('VITE_PRODUCT_WEBSITE_URL', 'http://localhost:3000'),
});

export const VISTA_NODE_IDENTITY = Object.freeze({
  nodeId: value('VISTA_NODE_ID', 'vista-node-unknown'),
  nodeName: value('VISTA_NODE_NAME', 'vista-local'),
  nodeRole: value('VISTA_NODE_ROLE', 'integrated'),
  siteId: value('VISTA_SITE_ID', 'development-lab'),
  deploymentId: value('VISTA_DEPLOYMENT_ID', 'vista-development'),
  environment: value('VISTA_ENVIRONMENT', 'development'),
  instanceUrn: value(
    'VISTA_INSTANCE_URN',
    'urn:mercurylink:vista:deployment:vista-development:node:vista-node-unknown',
  ),
  fmnSpiral: value('VISTA_FMN_SPIRAL', '5'),
  federationId: value('VISTA_FEDERATION_ID', 'standalone'),
  coiId: value('VISTA_COI_ID', 'general-situational-awareness'),
});
