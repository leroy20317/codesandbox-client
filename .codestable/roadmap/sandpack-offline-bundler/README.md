# Sandpack Offline Bundler Roadmap

## 背景

当前项目把 `codesandbox-client` 作为可独立部署的 Sandpack bundler 静态资源库使用，宿主应用只需要配置 `SANDPACK_BUNDLER_URL` 指向 bundler 服务。私有化部署场景要求 bundler 运行时可控，但现有 Sandpack npm 加载链路会访问 CodeSandbox packager、jsDelivr、GitHub API 等外部服务。

本 roadmap 记录已确认的私有化改造方案：把 bundler、固定 npm 包离线镜像、Nginx 配置和 Docker 部署方式收敛为一个可交付镜像。

## 目标

1. 提供一个 `sandpack-bundler` Docker 镜像，内置 Sandpack bundler 静态资源和固定 npm 包离线镜像。
2. 默认运行模式为 `local-first`：先读取镜像内置离线包，缺失时允许公网回退。
3. 支持私有化交付时显式切换为 `offline-only`：只读本地离线包，缺包直接报错，不访问公网。
4. 支持根路径和宿主应用子路径反代部署，例如 `/` 与 `/sandpack-bundler/`。
5. GitHub Actions 构建镜像并推送 GHCR，同时创建 Release，提供 manifest、docker-compose 示例和部署说明。
6. 私有化部署环境可通过 `docker load` + `docker compose up -d` 部署，不要求访问 GHCR 或 npm/CDN 公网服务。

## 非目标

1. 不在私有化部署环境部署 Verdaccio、Nexus、Artifactory 等 npm 私服。
2. 不在运行时动态安装 npm 包。
3. 不支持任意 npm 依赖；只支持固定白名单依赖。
4. 不保留 telemetry 上报开关；遥测逻辑应直接删除或永久禁用。
5. 不要求宿主应用配置离线包路径；离线包路径由 bundler 访问路径自动推导。

## 已确认决策

### 运行模式

只保留一个可选环境变量：

```env
SANDPACK_PACKAGE_RESOLVE_MODE=offline-only
```

支持值：

```text
offline-only
local-first
```

默认值：

```text
local-first
```

不再引入以下配置：

```env
SANDPACK_ENABLE_REMOTE_FALLBACK
SANDPACK_DISABLE_TELEMETRY
SANDPACK_PACKAGE_LOCAL_BASE_URL
```

原因：

- `SANDPACK_ENABLE_REMOTE_FALLBACK` 与 `SANDPACK_PACKAGE_RESOLVE_MODE` 语义重复。
- telemetry 在私有化 bundler 中应删除或永久禁用，不需要运行时开关。
- 离线包路径应自动跟随 bundler public base，避免宿主应用手动配置子路径。

### 离线包路径

离线包统一挂载在 bundler public base 下：

```text
{publicBaseUrl}/__sandpack_packages__/
```

示例：

```text
https://example.com/
=> https://example.com/__sandpack_packages__/

https://example.com/sandpack-bundler/
=> https://example.com/sandpack-bundler/__sandpack_packages__/
```

`publicBaseUrl` 由运行时配置脚本根据自身加载地址推导：

```js
(function () {
  var scriptUrl =
    document.currentScript && document.currentScript.src
      ? document.currentScript.src
      : window.location.href;

  window.__SANDPACK_RUNTIME_CONFIG__ = {
    packageResolveMode: 'local-first',
    publicBaseUrl: new URL('./', scriptUrl).toString()
  };
})();
```

### 固定依赖清单

离线包生成脚本维护固定白名单，例如：

```json
{
  "dependencies": {
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "@babel/core": "7.29.7",
    "@babel/runtime": "7.29.7",
    "react-refresh": "0.9.0",
    "node-libs-browser": "2.2.1",
    "clsx": "2.1.1",
    "dayjs": "1.11.20",
    "lucide-react": "1.7.0",
    "@tailwindcss/browser": "4.2.1"
  }
}
```

该清单需要与宿主应用传给 Sandpack 的依赖白名单保持一致。

## 离线包目录契约

构建阶段生成：

```text
offline-packages/
├── manifest.json
├── codesandbox/
│   └── v2/packages/...
├── jsdelivr-data/
│   └── v1/package/npm/...
└── jsdelivr-npm/
    └── npm/...
```

镜像内挂载为：

```text
/usr/share/nginx/html/__sandpack_packages__/
```

公网到本地路径映射：

```text
https://prod-packager-packages.codesandbox.io/xxx
=> __sandpack_packages__/codesandbox/xxx

https://data.jsdelivr.com/xxx
=> __sandpack_packages__/jsdelivr-data/xxx

https://cdn.jsdelivr.net/xxx
=> __sandpack_packages__/jsdelivr-npm/xxx
```

`manifest.json` 只记录包清单，不记录公网 source URL，避免安全扫描误报。

## 需要改造的模块

### 1. Runtime config

新增运行时配置读取能力，默认：

```ts
{
  packageResolveMode: 'local-first',
  publicBaseUrl: new URL('./', window.location.href).toString()
}
```

优先读取：

```ts
window.__SANDPACK_RUNTIME_CONFIG__
```

### 2. npm package resolver

改造以下方向的请求：

```text
packages/sandpack-core/src/npm/preloaded/fetch-dependencies.ts
packages/sandpack-core/src/npm/dynamic/fetch-protocols/jsdelivr/jsdelivr-npm.ts
packages/sandpack-core/src/npm/dynamic/fetch-protocols/jsdelivr/jsdelivr-gh.ts
```

`offline-only` 行为：

```text
本地离线包存在 => 返回本地内容
本地离线包缺失 => 抛出明确错误
不得访问公网
```

`local-first` 行为：

```text
本地离线包存在 => 返回本地内容
本地离线包缺失 => 回退原公网逻辑
```

### 3. Telemetry

删除或永久禁用 telemetry 上报逻辑。私有化构建产物不应包含：

```text
col.csbops.io
```

### 4. 离线包脚本

新增脚本：

```text
scripts/sandpack-offline/allowed-packages.json
scripts/sandpack-offline/download-packages.mjs
scripts/sandpack-offline/verify-offline.mjs
```

下载流程：

```text
读取 allowed-packages.json
下载 CodeSandbox metadata
下载 jsDelivr flat
按 flat 整包下载 npm 文件
生成 offline-packages/manifest.json
```

校验流程：

```text
检查每个白名单包都有 metadata、flat、package.json
检查 manifest 与 allowed-packages 一致
检查私有化产物不包含禁止的公网域名
```

### 5. Docker / Nginx

镜像需要包含：

```text
bundler 静态资源
__sandpack_packages__ 离线包
entrypoint.sh
nginx.conf
```

Nginx 需要支持根路径与子路径反代：

```text
/__sandpack_packages__/...
/sandpack-bundler/__sandpack_packages__/...
/__sandpack_config__.js
/sandpack-bundler/__sandpack_config__.js
```

### 6. GitHub Actions / Release

CI 流程：

```text
build bundler
download offline packages
verify
docker build
smoke test
push GHCR
create GitHub Release
```

不需要 CI cache。

Release assets：

```text
manifest.json
docker-compose.yml
README-DEPLOY.md
.env.example，可选
```

## 部署流程

内部制品：

```bash
docker pull ghcr.io/<owner>/sandpack-bundler:1.0.0

docker tag \
  ghcr.io/<owner>/sandpack-bundler:1.0.0 \
  sandpack-bundler:1.0.0

docker save sandpack-bundler:1.0.0 \
  | gzip > sandpack-bundler-1.0.0.tar.gz
```

私有化部署服务器：

```bash
gunzip -c sandpack-bundler-1.0.0.tar.gz | docker load
docker compose up -d
```

宿主应用配置：

```env
SANDPACK_BUNDLER_URL=http://<internal-host>:8080/
```

子路径部署：

```env
SANDPACK_BUNDLER_URL=https://example.com/sandpack-bundler/
```

## 验收标准

1. `local-first` 为默认模式；私有化交付可显式设置 `SANDPACK_PACKAGE_RESOLVE_MODE=offline-only` 禁止公网回退。
2. 根路径和子路径反代下都能读取 `__sandpack_config__.js` 与 `__sandpack_packages__/manifest.json`。
3. Sandpack 预览可加载固定白名单依赖。
4. 缺包时抛出明确错误，不触发公网请求。
5. 私有化部署环境 Network 不出现以下域名：

```text
prod-packager-packages.codesandbox.io
dev-packager-packages.codesandbox.io
aiwi8rnkp5.execute-api.eu-west-1.amazonaws.com
xi5p9f7czk.execute-api.eu-west-1.amazonaws.com
data.jsdelivr.com
cdn.jsdelivr.net
api.github.com
col.csbops.io
cdn.tailwindcss.com
```

6. 私有化部署环境可以通过 `docker load` + `docker compose up -d` 完成部署。
