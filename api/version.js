import { fetchLatestRelease } from './_github-release.js';
import { jsonResponse } from './_json-response.js';

export const config = { runtime: 'edge' };

const LOCAL_DEFAULT_VERSION = '1.0.0';
const LOCAL_DEFAULT_BASE_PATH = '/downloads';

function readEnv(name) {
  return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

function useLocalDistribution(url) {
  const mode = String(readEnv('VISTA_DESKTOP_DOWNLOAD_MODE') || '').toLowerCase();
  if (mode === 'local') return true;
  if (mode === 'upstream') return false;
  return !(
    url.hostname === 'worldmonitor.app'
    || url.hostname === 'www.worldmonitor.app'
    || url.hostname === 'api.worldmonitor.app'
    || url.hostname.endsWith('.worldmonitor.app')
  );
}

function localVersion() {
  const configured = String(readEnv('VISTA_RELEASE_VERSION') || LOCAL_DEFAULT_VERSION);
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(configured)
    ? configured
    : LOCAL_DEFAULT_VERSION;
}

function localDownloadPath() {
  const configured = String(
    readEnv('VISTA_DESKTOP_DOWNLOAD_BASE_PATH') || LOCAL_DEFAULT_BASE_PATH
  );
  if (
    !configured.startsWith('/')
    || configured.includes('..')
    || !/^\/[0-9A-Za-z/_-]*$/.test(configured)
  ) {
    return LOCAL_DEFAULT_BASE_PATH;
  }
  return configured.replace(/\/+$/, '') || LOCAL_DEFAULT_BASE_PATH;
}

export default async function handler(req) {
  const requestUrl = new URL(req.url);
  if (useLocalDistribution(requestUrl)) {
    const resolvedVersion = localVersion();
    return jsonResponse({
      version: resolvedVersion,
      tag: `v${resolvedVersion}`,
      url: new URL(`${localDownloadPath()}/`, requestUrl.origin).href,
      prerelease: false,
      source: 'local',
    }, 200, {
      'Cache-Control': 'no-store',
    });
  }
  try {
    const release = await fetchLatestRelease('WorldMonitor-Version-Check');
    if (!release) {
      return jsonResponse({ error: 'upstream' }, 502);
    }
    const tag = release.tag_name ?? '';
    const version = tag.replace(/^v/, '');

    return jsonResponse({
      version,
      tag,
      url: release.html_url,
      prerelease: release.prerelease ?? false,
    }, 200, {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60, stale-if-error=3600',
      'Access-Control-Allow-Origin': '*',
    });
  } catch {
    return jsonResponse({ error: 'fetch_failed' }, 502);
  }
}
