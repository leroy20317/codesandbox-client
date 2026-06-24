import { FetchProtocol, Meta } from '../../fetch-npm-module';
import { fetchWithRetries } from '../utils';
import { JSDelivrMeta, normalizeJSDelivr } from './utils';
import {
  createOfflinePackageError,
  fetchOfflinePackage,
  getOfflineJsdelivrDataUrl,
  getOfflineJsdelivrNpmUrl,
  getRemoteGithubApiUrl,
  getRemoteJsdelivrDataUrl,
  getRemoteJsdelivrNpmUrl,
  isOfflineOnlyPackageResolveMode,
} from '../../../offline/runtime-config';

/**
 * Converts urls like "https://github.com/user/repo.git" to "user/repo".
 */
const GH_RE = /^(((https:\/\/)|(git(\+(ssh|https))?:\/\/(.*@)?))(www\.)?github\.com(\/|:))?(([^\s#/]*)\/([^\s#/]*))(#(.*))?$/;
export function convertGitHubURLToVersion(ghUrl: string) {
  const result = ghUrl.match(GH_RE);
  if (result && result[10]) {
    const repo = result[10];
    const version = result[14];
    const cleanedRepo = repo.replace(/\.git$/, '');
    if (version) {
      return `${cleanedRepo}@${version}`;
    }
    return cleanedRepo;
  }
  return ghUrl;
}

export function isGithubDependency(ghUrl: string) {
  return GH_RE.test(ghUrl);
}

export class JSDelivrGHFetcher implements FetchProtocol {
  async file(name: string, version: string, path: string): Promise<string> {
    const packagePath = `/gh/${convertGitHubURLToVersion(version)}${path}`;
    const offlineUrl = getOfflineJsdelivrNpmUrl(packagePath);

    try {
      return await fetchOfflinePackage(offlineUrl).then(x => x.text());
    } catch (e) {
      if (isOfflineOnlyPackageResolveMode()) {
        throw createOfflinePackageError(offlineUrl);
      }
    }

    const url = getRemoteJsdelivrNpmUrl(packagePath);
    const result = await fetchWithRetries(url).then(x => x.text());

    return result;
  }

  async meta(name: string, version: string): Promise<Meta> {
    // Split the repo and requested version
    const [repo, repoVersion] = convertGitHubURLToVersion(version).split('@');

    // Fetch repo meta from GitHub
    // If the version is not specified, we use the default_branch from the repo meta
    let metaBranch = repoVersion;
    if (!metaBranch) {
      if (isOfflineOnlyPackageResolveMode()) {
        throw createOfflinePackageError(
          getOfflineJsdelivrDataUrl(`/v1/package/gh/${repo}/flat`)
        );
      }

      metaBranch = await fetch(getRemoteGithubApiUrl(`/repos/${repo}`))
        .then(x => x.json())
        .then(x => x.default_branch);
    }

    // We get the sha of the requested version
    if (isOfflineOnlyPackageResolveMode()) {
      throw createOfflinePackageError(
        getOfflineJsdelivrDataUrl(`/v1/package/gh/${repo}@${metaBranch}/flat`)
      );
    }

    const sha = await fetch(getRemoteGithubApiUrl(`/repos/${repo}/commits/${metaBranch}`))
      .then(x => x.json())
      .then(x => x.sha);

    const metaPath = `/v1/package/gh/${repo}@${sha}/flat`;
    const offlineUrl = getOfflineJsdelivrDataUrl(metaPath);

    try {
      const result: JSDelivrMeta = await fetchOfflinePackage(offlineUrl).then(
        x => x.json()
      );

      return normalizeJSDelivr(result.files, {});
    } catch (e) {
      if (isOfflineOnlyPackageResolveMode()) {
        throw createOfflinePackageError(offlineUrl);
      }
    }

    const url = getRemoteJsdelivrDataUrl(metaPath);
    const result: JSDelivrMeta = await fetchWithRetries(url).then(x =>
      x.json()
    );

    return normalizeJSDelivr(result.files, {});
  }
}
