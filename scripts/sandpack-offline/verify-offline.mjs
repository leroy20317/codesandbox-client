import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OFFLINE_DIR = path.join(ROOT_DIR, 'offline-packages');
const ALLOWED_PACKAGES_PATH = path.join(__dirname, 'allowed-packages.json');
const MANIFEST_PATH = path.join(OFFLINE_DIR, 'manifest.json');

const SCAN_DIRS = ['www', 'docker', 'packages/sandpack-core/src/npm'];
const FORBIDDEN_PATTERNS = [
  'prod-packager-packages.codesandbox.io',
  'dev-packager-packages.codesandbox.io',
  'aiwi8rnkp5.execute-api.eu-west-1.amazonaws.com',
  'xi5p9f7czk.execute-api.eu-west-1.amazonaws.com',
  'data.jsdelivr.com',
  'cdn.jsdelivr.net',
  'api.github.com',
  'col.csbops.io',
  'cdn.tailwindcss.com',
];

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (e) {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function packageSpec(name, version) {
  return `${name}@${version}`;
}

function packagePaths(name, version) {
  const spec = packageSpec(name, version);

  return {
    metadata: path.join(
      OFFLINE_DIR,
      'codesandbox',
      'v2',
      'packages',
      name,
      `${version}.json`
    ),
    flat: path.join(
      OFFLINE_DIR,
      'jsdelivr-data',
      'v1',
      'package',
      'npm',
      spec,
      'flat'
    ),
    packageJson: path.join(
      OFFLINE_DIR,
      'jsdelivr-npm',
      'npm',
      spec,
      'package.json'
    ),
  };
}

function assertSamePackages(allowed, manifest) {
  const allowedJson = JSON.stringify(allowed, Object.keys(allowed).sort());
  const manifestJson = JSON.stringify(
    manifest.packages || {},
    Object.keys(manifest.packages || {}).sort()
  );

  if (allowedJson !== manifestJson) {
    throw new Error('offline-packages/manifest.json does not match allowed-packages.json');
  }
}

async function verifyPackageFiles(packages) {
  const missing = [];

  for (const [name, version] of Object.entries(packages)) {
    const paths = packagePaths(name, version);
    for (const [kind, filePath] of Object.entries(paths)) {
      if (!(await pathExists(filePath))) {
        missing.push(`${name}@${version} missing ${kind}: ${filePath}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing offline package files:\n${missing.join('\n')}`);
  }
}

async function walkFiles(dir) {
  if (!(await pathExists(dir))) {
    return [];
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_fixtures') {
        continue;
      }

      files.push(...(await walkFiles(entryPath)));
    } else if (
      entry.isFile() &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.spec.tsx')
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

async function verifyForbiddenPatterns() {
  const matches = [];

  for (const relativeDir of SCAN_DIRS) {
    const files = await walkFiles(path.join(ROOT_DIR, relativeDir));
    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf8').catch(() => '');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (content.includes(pattern)) {
          matches.push(`${path.relative(ROOT_DIR, filePath)} contains ${pattern}`);
        }
      }
    }
  }

  if (matches.length > 0) {
    throw new Error(`Forbidden external domains found:\n${matches.join('\n')}`);
  }
}

async function main() {
  const allowed = (await readJson(ALLOWED_PACKAGES_PATH)).dependencies || {};
  const manifest = await readJson(MANIFEST_PATH);

  assertSamePackages(allowed, manifest);
  await verifyPackageFiles(allowed);
  await verifyForbiddenPatterns();

  console.log('Sandpack offline package mirror verified.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
