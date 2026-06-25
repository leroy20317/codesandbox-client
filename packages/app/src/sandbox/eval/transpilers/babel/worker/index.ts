import loadPolyfills from '@codesandbox/common/lib/load-dynamic-polyfills';

require('app/config/polyfills');

const host = process.env.CODESANDBOX_HOST || '';
const browserFsUrl = host
  ? `${host}/static/browserfs12/browserfs.min.js`
  : new URL('static/browserfs12/browserfs.min.js', self.location.href).toString();

self.importScripts(browserFsUrl);

self.process = self.BrowserFS.BFSRequire('process');
// @ts-ignore
self.Buffer = self.BrowserFS.BFSRequire('buffer').Buffer;

loadPolyfills().then(() => {
  // eslint-disable-next-line global-require
  require('./babel-worker');
});
