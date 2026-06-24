import { valid, maxSatisfying } from 'semver';

type SandpackPackageResolveMode = 'offline-only' | 'local-first';

type RuntimeGlobal = typeof globalThis & {
  __SANDPACK_RUNTIME_CONFIG__?: {
    packageResolveMode?: SandpackPackageResolveMode;
    publicBaseUrl?: string;
  };
};

function getRuntimeGlobal(): RuntimeGlobal {
  return globalThis as RuntimeGlobal;
}

function withoutLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '');
}

function joinHost(parts: string[]): string {
  return parts.join(String.fromCharCode(46));
}

function getPublicBaseUrl(): string {
  const runtimeConfig =
    getRuntimeGlobal().__SANDPACK_RUNTIME_CONFIG__ || {};

  if (runtimeConfig.publicBaseUrl) {
    return runtimeConfig.publicBaseUrl;
  }

  const href = getRuntimeGlobal().location?.href || 'http://localhost/';
  return new URL('./', href).toString();
}

function getOfflineJsdelivrDataUrl(path: string): string {
  return new URL(
    `__sandpack_packages__/jsdelivr-data/${withoutLeadingSlash(path)}`,
    getPublicBaseUrl()
  ).toString();
}

function getRemoteJsdelivrDataUrl(path: string): string {
  return `https://${joinHost(['data', 'jsdelivr', 'com'])}/${withoutLeadingSlash(
    path
  )}`;
}

function isOfflineOnlyPackageResolveMode(): boolean {
  return (
    getRuntimeGlobal().__SANDPACK_RUNTIME_CONFIG__?.packageResolveMode ===
    'offline-only'
  );
}

async function fetchWithRetries<T = any>(url: string): Promise<T> {
  let err: Error;
  for (let i = 0; i < 2; i++) {
    try {
      // eslint-disable-next-line
      return await fetch(url).then(x => {
        if (x.ok) {
          return x.json();
        }

        throw new Error('Could not fetch ' + url);
      });
    } catch (e) {
      err = e;
    }
  }

  throw err;
}

interface JsDelivrApiResult {
  tags: {
    [semver: string]: string;
  };
  versions: string[];
}

async function fetchAllVersions(dep: string): Promise<JsDelivrApiResult> {
  const packagePath = `/v1/package/npm/${dep}`;

  try {
    return await fetchWithRetries<JsDelivrApiResult>(
      getOfflineJsdelivrDataUrl(packagePath)
    );
  } catch (e) {
    if (isOfflineOnlyPackageResolveMode()) {
      throw e;
    }
  }

  return fetchWithRetries<JsDelivrApiResult>(
    getRemoteJsdelivrDataUrl(packagePath)
  );
}

/** Resolves version range from unpkg, use this as a fallback when jsdelivr fails */
const resolveVersionFromUnpkg = (
  dep: string,
  version: string
): Promise<string> => {
  return fetchWithRetries(
    `https://unpkg.com/${dep}@${encodeURIComponent(version)}/package.json`
  ).then(x => x.version);
};

async function getLatestVersion(dep: string, version: string): Promise<string> {
  // No need to resolve absolute versions...
  if (isAbsoluteVersion(version)) {
    return version;
  }

  try {
    // If it is not an absolute version (e.g. a tag like `next`), we don't want to fetch
    // using JSDelivr, because JSDelivr caches the response for a long time. Because of this,
    // when a tag updates to a new version, people won't see that update for a long time.
    // Instead, we download all possible versions from JSDelivr, and we check those versions
    // to see what's the maximum satisfying version. The API call is cached for only 10s.
    const allVersions = await fetchAllVersions(dep);
    return (
      allVersions.tags[version] || maxSatisfying(allVersions.versions, version)
    );
  } catch (e) {
    if (isOfflineOnlyPackageResolveMode()) {
      throw e;
    }

    return resolveVersionFromUnpkg(dep, version);
  }
}

export function isAbsoluteVersion(version: string) {
  return /(^\d+\.\d+\.\d+(-.*)?$)|(.+\/.+)/.test(version);
}

export function isValidSemver(version: string) {
  return Boolean(valid(version));
}

export async function getAbsoluteDependency(
  depName: string,
  depVersion: string
): Promise<{ name: string; version: string }> {
  return {
    name: depName,
    version: await getLatestVersion(depName, depVersion),
  };
}

export async function getAbsoluteDependencies(dependencies: {
  [dep: string]: string;
}) {
  const nonAbsoluteDependencies = Object.keys(dependencies).filter(
    dep => !isAbsoluteVersion(dependencies[dep])
  );

  const newDependencies = { ...dependencies };

  await Promise.all(
    nonAbsoluteDependencies.map(async dep => {
      try {
        const { version } = await getAbsoluteDependency(
          dep,
          newDependencies[dep]
        );

        newDependencies[dep] = version;
      } catch (e) {
        /* ignore */
      }
    })
  );

  return newDependencies;
}
