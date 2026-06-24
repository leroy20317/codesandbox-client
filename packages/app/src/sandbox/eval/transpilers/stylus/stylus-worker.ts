import { ChildHandler } from '../worker-transpiler/child-handler';

const childHandler = new ChildHandler('stylus-worker');

const host = process.env.CODESANDBOX_HOST || '';
const stylusUrl = host
  ? `${host}/static/js/stylus.min.js`
  : new URL('static/js/stylus.min.js', self.location.href).toString();

self.importScripts(stylusUrl);

declare const stylus: {
  render: (
    code: string,
    opts: { filename: string },
    callback: (err: Error, css: string) => void
  ) => void;
};

async function compile(data) {
  const { code, path } = data;

  const transpiledCode = await new Promise((resolve, reject) => {
    stylus.render(code, { filename: path }, (err, css) => {
      if (err) {
        return reject(err);
      }

      return resolve(css);
    });
  });

  return { transpiledCode };
}

childHandler.registerFunction('compile', compile);
childHandler.emitReady();
