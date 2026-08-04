import { fetchLatestRelease } from './_github-release.js';

// Non-sebuf: returns XML/HTML, stays as standalone Vercel function
export const config = { runtime: 'edge' };

const RELEASES_PAGE = 'https://github.com/benngee85/VISTA/releases/latest';

const LOCAL_DEFAULT_VERSION = '1.0.0';
const LOCAL_DEFAULT_BASE_PATH = '/downloads';

function readEnv(name) {
  return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

const UPSTREAM_ROOT_HOST = 'worldmonitor.app';

function isUpstreamHost(hostname) {
  return hostname === UPSTREAM_ROOT_HOST
    || hostname.endsWith(`.${UPSTREAM_ROOT_HOST}`);
}

function useLocalDistribution(url) {
  const mode = String(
    readEnv('VISTA_DESKTOP_DOWNLOAD_MODE') || ''
  ).toLowerCase();

  if (mode === 'local') return true;
  if (mode === 'upstream') return false;

  return !isUpstreamHost(url.hostname);
}

function safeVersion() {
  const configured = String(
    readEnv('VISTA_RELEASE_VERSION') || LOCAL_DEFAULT_VERSION
  );

  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(configured)
    ? configured
    : LOCAL_DEFAULT_VERSION;
}

function safeBasePath() {
  const configured = String(
    readEnv('VISTA_DESKTOP_DOWNLOAD_BASE_PATH')
      || LOCAL_DEFAULT_BASE_PATH
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

function localFilename(platform) {
  const version = safeVersion();

  const defaults = {
    'windows-exe': `MLC-VISTA_${version}_x64-setup.exe`,
    'windows-msi': `MLC-VISTA_${version}_x64_en-US.msi`,
    'macos-arm64': `MLC-VISTA_${version}_aarch64.dmg`,
    'macos-x64': `MLC-VISTA_${version}_x64.dmg`,
    'linux-appimage': `MLC-VISTA_${version}_amd64.AppImage`,
    'linux-appimage-arm64':
      `MLC-VISTA_${version}_aarch64.AppImage`,
  };

  return defaults[platform] || null;
}

function localRedirect(url, platform) {
  const basePath = safeBasePath();
  const filename = localFilename(platform);

  const targetPath = filename
    ? `${basePath}/${encodeURIComponent(filename)}`
    : `${basePath}/`;

  return Response.redirect(
    new URL(targetPath, url.origin),
    302,
  );
}

const PLATFORM_PATTERNS = {
  'windows-exe': (name) => name.endsWith('_x64-setup.exe'),
  'windows-msi': (name) => name.endsWith('_x64_en-US.msi'),
  'macos-arm64': (name) => name.endsWith('_aarch64.dmg'),
  'macos-x64': (name) =>
    name.endsWith('_x64.dmg') && !name.includes('setup'),
  'linux-appimage': (name) =>
    name.endsWith('_amd64.AppImage'),
  'linux-appimage-arm64': (name) =>
    name.endsWith('_aarch64.AppImage'),
};

// VISTA follows the upstream one-binary desktop model. Variant selection is
// performed in-app; the query parameter is validated as an identity hint.
export const SUPPORTED_VARIANTS = new Set([
  'full',
  'world',
  'tech',
  'finance',
  'commodity',
  'energy',
  'happy',
]);

const DESKTOP_ASSET_IDENTIFIERS = [
  'mlcvista',
  'vista',
  'worldmonitor',
];

function canonicalAssetName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function findDesktopAsset(assets, platformMatcher) {
  return assets.find((asset) => {
    const assetName = String(asset?.name || '');
    const canonical = canonicalAssetName(assetName);

    const hasDesktopIdentity =
      DESKTOP_ASSET_IDENTIFIERS.some((identifier) =>
        canonical.includes(identifier)
      );

    return hasDesktopIdentity && platformMatcher(assetName);
  }) ?? null;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const platform = url.searchParams.get('platform');
  const variant = (
    url.searchParams.get('variant') || ''
  ).toLowerCase();

  // Self-hosted VISTA distributions remain sovereign and do not call GitHub.
  if (useLocalDistribution(url)) {
    return localRedirect(url, platform);
  }

  // Object.hasOwn prevents inherited properties such as "constructor" from
  // being interpreted as platform matchers.
  if (
    !platform
    || !Object.hasOwn(PLATFORM_PATTERNS, platform)
  ) {
    return Response.redirect(RELEASES_PAGE, 302);
  }

  if (
    variant
    && !SUPPORTED_VARIANTS.has(variant)
  ) {
    return Response.redirect(RELEASES_PAGE, 302);
  }

  try {
    const release = await fetchLatestRelease(
      'WorldMonitor-Download-Redirect',
    );

    if (!release) {
      return Response.redirect(RELEASES_PAGE, 302);
    }

    const matcher = PLATFORM_PATTERNS[platform];
    const assets = Array.isArray(release.assets)
      ? release.assets
      : [];

    const asset = findDesktopAsset(assets, matcher);

    if (!asset) {
      return Response.redirect(RELEASES_PAGE, 302);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: asset.browser_download_url,
        'Cache-Control':
          'public, s-maxage=300, stale-while-revalidate=60, stale-if-error=600',
      },
    });
  } catch {
    return Response.redirect(RELEASES_PAGE, 302);
  }
}
