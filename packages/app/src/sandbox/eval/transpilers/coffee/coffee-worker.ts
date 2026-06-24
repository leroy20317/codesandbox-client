import { ChildHandler } from '../worker-transpiler/child-handler';

const childHandler = new ChildHandler('coffee-worker');

const host = process.env.CODESANDBOX_HOST || '';
const coffeeScriptUrl = host
  ? `${host}/static/js/coffeescript.2.3.2.js`
  : new URL('static/js/coffeescript.2.3.2.js', self.location.href).toString();

self.importScripts(coffeeScriptUrl);

async function workerCompile(opts) {
  const { code, path } = opts;
  // @ts-ignore
  const compiled = self.CoffeeScript.compile(code, {
    filename: path,
    sourceFiles: [path],
    bare: true,
    literate: false,
    inlineMap: true,
    sourceMap: false,
  });

  return {
    code: compiled,
  };
}

childHandler.registerFunction('compile', workerCompile);
childHandler.emitReady();
