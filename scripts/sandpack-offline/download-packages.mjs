import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import https from 'https';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OFFLINE_DIR = path.join(ROOT_DIR, 'offline-packages');
const ALLOWED_PACKAGES_PATH = path.join(__dirname, 'allowed-packages.json');

const CODESANDBOX_PACKAGE_BASE =
  'https://prod-packager-packages.codesandbox.io';
const JSDELIVR_DATA_BASE = 'https://data.jsdelivr.com';
const JSDELIVR_NPM_BASE = 'https://cdn.jsdelivr.net';

const REQUEST_RETRIES = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toUrlPath(value) {
  return value.startsWith('/') ? value : `/${value}`;
}

function packageSpec(name, version) {
  return `${name}@${version}`;
}

function mapUrlToLocalPath(url) {
  if (url.startsWith(CODESANDBOX_PACKAGE_BASE)) {
    return path.join(
      OFFLINE_DIR,
      'codesandbox',
      new URL(url).pathname.replace(/^\/+/, '')
    );
  }

  if (url.startsWith(JSDELIVR_DATA_BASE)) {
    return path.join(
      OFFLINE_DIR,
      'jsdelivr-data',
      new URL(url).pathname.replace(/^\/+/, '')
    );
  }

  if (url.startsWith(JSDELIVR_NPM_BASE)) {
    return path.join(
      OFFLINE_DIR,
      'jsdelivr-npm',
      new URL(url).pathname.replace(/^\/+/, '')
    );
  }

  throw new Error(`Unsupported offline package URL: ${url}`);
}

function request(url, attempt = 1) {
  return new Promise((resolve, reject) => {
    https
      .get(url, response => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          resolve(request(new URL(response.headers.location, url).toString()));
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
          return;
        }

        resolve(response);
      })
      .on('error', reject);
  }).catch(async error => {
    if (attempt >= REQUEST_RETRIES) {
      throw error;
    }

    await sleep(500 * attempt);
    return request(url, attempt + 1);
  });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function downloadToFile(url, localPath = mapUrlToLocalPath(url)) {
  await fs.mkdir(path.dirname(localPath), { recursive: true });

  const response = await request(url);
  await pipeline(response, createWriteStream(localPath));

  return localPath;
}

async function downloadJson(url) {
  const localPath = await downloadToFile(url);
  return readJson(localPath);
}

async function downloadPackage(name, version) {
  const spec = packageSpec(name, version);

  console.log(`Downloading ${spec}`);

  const metadataUrl = `${CODESANDBOX_PACKAGE_BASE}/v2/packages/${name}/${version}.json`;
  await downloadToFile(metadataUrl);

  const flatUrl = `${JSDELIVR_DATA_BASE}/v1/package/npm/${spec}/flat`;
  const flat = await downloadJson(flatUrl);

  if (!Array.isArray(flat.files)) {
    throw new Error(`Invalid jsDelivr flat response for ${spec}`);
  }

  for (const file of flat.files) {
    if (!file || typeof file.name !== 'string') {
      continue;
    }

    const fileUrl = `${JSDELIVR_NPM_BASE}/npm/${spec}${toUrlPath(
      file.name
    )}`;
    await downloadToFile(fileUrl);
  }
}

async function writeManifest(packages) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    packages,
  };

  await fs.mkdir(OFFLINE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(OFFLINE_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

async function main() {
  const config = await readJson(ALLOWED_PACKAGES_PATH);
  const packages = config.dependencies || {};

  await fs.rm(OFFLINE_DIR, { recursive: true, force: true });

  for (const [name, version] of Object.entries(packages)) {
    await downloadPackage(name, version);
  }

  await writeManifest(packages);
  console.log(`Offline packages written to ${OFFLINE_DIR}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
