import {
  FetchProtocol,
  Meta,
  downloadDependency,
} from '../../fetch-npm-module';
import { fetchWithRetries } from '../utils';
import { JSDelivrMeta, normalizeJSDelivr } from './utils';
import {
  createOfflinePackageError,
  fetchOfflinePackage,
  getOfflineJsdelivrDataUrl,
  getOfflineJsdelivrNpmUrl,
  getRemoteJsdelivrDataUrl,
  getRemoteJsdelivrNpmUrl,
  isOfflineOnlyPackageResolveMode,
} from '../../../offline/runtime-config';

export class JSDelivrNPMFetcher implements FetchProtocol {
  async file(name: string, version: string, path: string): Promise<string> {
    const packagePath = `/npm/${name}@${version}${path}`;
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
    // if it's a tag it won't work, so we fetch latest version otherwise
    const latestVersion = /^\d/.test(version)
      ? version
      : JSON.parse(
          (await downloadDependency(name, version, '/package.json')).code
        ).version;

    const metaPath = `/v1/package/npm/${name}@${latestVersion}/flat`;
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
