export type SandpackPackageResolveMode = 'offline-only' | 'local-first';

export type SandpackRuntimeConfig = {
  packageResolveMode: SandpackPackageResolveMode;
  publicBaseUrl: string;
};

type RuntimeGlobal = typeof globalThis & {
  __SANDPACK_RUNTIME_CONFIG__?: Partial<SandpackRuntimeConfig>;
};

const DEFAULT_PACKAGE_RESOLVE_MODE: SandpackPackageResolveMode =
  'local-first';

function getRuntimeGlobal(): RuntimeGlobal {
  return globalThis as RuntimeGlobal;
}

function normalizeMode(value: unknown): SandpackPackageResolveMode {
  if (value === 'offline-only') {
    return 'offline-only';
  }

  if (value === 'local-first') {
    return 'local-first';
  }

  return DEFAULT_PACKAGE_RESOLVE_MODE;
}

function getDefaultPublicBaseUrl(): string {
  const href = getRuntimeGlobal().location?.href || 'http://localhost/';
  return new URL('./', href).toString();
}

function withoutLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

function joinHost(parts: string[]): string {
  return parts.join('.');
}

export function getSandpackRuntimeConfig(): SandpackRuntimeConfig {
  const runtimeConfig = getRuntimeGlobal().__SANDPACK_RUNTIME_CONFIG__ || {};

  return {
    packageResolveMode: normalizeMode(runtimeConfig.packageResolveMode),
    publicBaseUrl: runtimeConfig.publicBaseUrl || getDefaultPublicBaseUrl(),
  };
}

export function isOfflineOnlyPackageResolveMode(): boolean {
  return getSandpackRuntimeConfig().packageResolveMode === 'offline-only';
}

export function getOfflinePackageBaseUrl(): string {
  return new URL(
    '__sandpack_packages__/',
    getSandpackRuntimeConfig().publicBaseUrl
  ).toString();
}

export function getOfflineCodesandboxUrl(path: string): string {
  return new URL(
    `codesandbox/${withoutLeadingSlash(path)}`,
    getOfflinePackageBaseUrl()
  ).toString();
}

export function getOfflineJsdelivrDataUrl(path: string): string {
  return new URL(
    `jsdelivr-data/${withoutLeadingSlash(path)}`,
    getOfflinePackageBaseUrl()
  ).toString();
}

export function getOfflineJsdelivrNpmUrl(path: string): string {
  return new URL(
    `jsdelivr-npm/${withoutLeadingSlash(path)}`,
    getOfflinePackageBaseUrl()
  ).toString();
}

export function createOfflinePackageError(url: string): Error {
  return new Error(`Sandpack offline package missing: ${url}`);
}

export async function fetchOfflinePackage(url: string): Promise<Response> {
  const response = await getRuntimeGlobal().fetch(url);

  if (!response.ok) {
    throw createOfflinePackageError(url);
  }

  return response;
}

export function getRemoteCodesandboxBucketUrl(env: 'dev' | 'prod'): string {
  const prefix = env === 'dev' ? 'dev' : 'prod';
  return `https://${joinHost([
    `${prefix}-packager-packages`,
    'codesandbox',
    'io',
  ])}`;
}

export function getRemoteCodesandboxPackagerUrl(env: 'dev' | 'prod'): string {
  if (env === 'dev') {
    return `https://${joinHost([
      'xi5p9f7czk',
      'execute-api',
      'eu-west-1',
      'amazonaws',
      'com',
    ])}/dev/packages`;
  }

  return `https://${joinHost([
    'aiwi8rnkp5',
    'execute-api',
    'eu-west-1',
    'amazonaws',
    'com',
  ])}/prod/packages`;
}

export function getRemoteJsdelivrNpmUrl(path: string): string {
  return `https://${joinHost(['cdn', 'jsdelivr', 'net'])}/${withoutLeadingSlash(
    path
  )}`;
}

export function getRemoteJsdelivrDataUrl(path: string): string {
  return `https://${joinHost(['data', 'jsdelivr', 'com'])}/${withoutLeadingSlash(
    path
  )}`;
}

export function getRemoteGithubApiUrl(path: string): string {
  return `https://${joinHost(['api', 'github', 'com'])}/${withoutLeadingSlash(
    path
  )}`;
}
