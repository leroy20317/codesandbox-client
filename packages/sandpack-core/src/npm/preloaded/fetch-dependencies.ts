import _debug from '@codesandbox/common/lib/utils/debug';
import { getAbsoluteDependency } from '@codesandbox/common/lib/utils/dependencies';
import { ILambdaResponse } from '../merge-dependency';

import delay from '../../utils/delay';
import dependenciesToQuery, {
  normalizeVersion,
} from '../dependencies-to-query';
import {
  createOfflinePackageError,
  fetchOfflinePackage,
  getOfflineCodesandboxUrl,
  getRemoteCodesandboxBucketUrl,
  getRemoteCodesandboxPackagerUrl,
  isOfflineOnlyPackageResolveMode,
} from '../offline/runtime-config';

const RETRY_COUNT = 60;
const MAX_RETRY_DELAY = 10_000;
const debug = _debug('cs:sandbox:packager');

const VERSION = 2;

const REMOTE_ENV = 'prod';
const BUCKET_URL = getRemoteCodesandboxBucketUrl(REMOTE_ENV);
const PACKAGER_URL = getRemoteCodesandboxPackagerUrl(REMOTE_ENV);

function callApi(url: string, method = 'GET') {
  return fetch(url, {
    method,
  })
    .then(async response => {
      if (!response.ok) {
        const error = new Error(response.statusText || '' + response.status);

        try {
          // @ts-ignore
          error.response = await response.text();
        } catch (err) {
          console.error(err);
        }

        // @ts-ignore
        error.statusCode = response.status;

        throw error;
      }

      return response;
    })
    .then(response => response.json());
}

/**
 * Request the packager, if retries > RETRY_COUNT it will throw if something goes wrong
 * otherwise it will retry again with an incremented retry
 *
 * @param {string} query The dependencies to call
 */
async function requestPackager(
  url: string,
  method: string = 'GET',
  retries: number = 0
): Promise<any> {
  // eslint-disable-next-line no-constant-condition
  debug(`Trying to call packager for ${retries} time`);

  try {
    const manifest = await callApi(url, method);
    return manifest;
  } catch (err: any) {
    console.error({ err });

    // If it's a 403 or network error, we retry the fetch
    if (err.response && err.statusCode !== 403) {
      throw new Error(err.response.error);
    }

    // 403 status code means the bundler is still bundling
    if (retries < RETRY_COUNT) {
      const msDelay = Math.min(
        MAX_RETRY_DELAY,
        1000 * retries + Math.round(Math.random() * 1000)
      );
      console.warn(`Retrying package fetch in ${msDelay}ms`);
      await delay(msDelay);
      return requestPackager(url, method, retries + 1);
    }

    throw err;
  }
}

export async function getDependency(
  depName: string,
  depVersion: string
): Promise<ILambdaResponse> {
  let version = depVersion;
  if (!isOfflineOnlyPackageResolveMode()) {
    try {
      const { version: absoluteVersion } = await getAbsoluteDependency(
        depName,
        depVersion
      );
      version = absoluteVersion;
    } catch (e) {
      /* Ignore this, not critical */
    }
  }

  const normalizedVersion = normalizeVersion(version);
  const dependencyUrl = dependenciesToQuery({ [depName]: normalizedVersion });
  const manifestPath = `/v${VERSION}/packages/${depName}/${normalizedVersion}.json`;
  const offlineUrl = getOfflineCodesandboxUrl(manifestPath);
  const fullUrl = `${BUCKET_URL}${manifestPath}`;

  try {
    const bucketManifest = await fetchOfflinePackage(offlineUrl).then(x =>
      x.json()
    );
    return bucketManifest;
  } catch (e) {
    if (isOfflineOnlyPackageResolveMode()) {
      throw createOfflinePackageError(offlineUrl);
    }
  }

  try {
    const bucketManifest = await callApi(fullUrl);
    return bucketManifest;
  } catch (e) {
    // The dep has not been generated yet...
    const packagerRequestUrl = `${PACKAGER_URL}/${dependencyUrl}`;
    await requestPackager(packagerRequestUrl, 'POST');

    return requestPackager(fullUrl);
  }
}
