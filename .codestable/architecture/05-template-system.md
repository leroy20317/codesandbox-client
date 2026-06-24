# 模板系统

> 代码最后更新：2024年。描述 `@codesandbox/common` 中 `src/templates/` 的模板系统。
> 维护方式：新增/修改模板定义时更新。

## 定位

模板系统是 CodeSandbox 支持 32 种项目类型的核心抽象。每个模板定义一个项目的：
- 入口文件（`mainFile`）
- 配置文件（`configurationFiles`，如 `package.json`、`tsconfig.json`）
- 视图面板（`views`，如浏览器、终端、控制台）
- 构建输出目录（`distDir`）
- 部署方式（静态/服务端）

## 架构

```
Template 基类 (template.ts)
  │
  ├── 直接实例化（大多数模板）
  │     react.ts, vue.ts, next.ts, angular.ts, svelte.ts, node.ts, ...
  │
  └── 子类化（特殊行为）
        ReactTemplate (helpers/react-template.ts)  ← react.ts 使用
```

### Template 基类

```typescript
class Template {
  name: TemplateType;           // 'create-react-app', 'vue-cli', 'next' ...
  niceName: string;             // 人类可读名称: 'React', 'Vue', 'Next.js'
  url: string;                  // 模板源 URL
  shortid: string;              // URL slug
  color: () => string;          // 品牌色（经过 decorateSelector 包装）
  backgroundColor: () => string | undefined;
  main: boolean;                // 是否"主流"模板
  popular: boolean;
  showOnHomePage: boolean;      // 是否在首页显示
  isServer: boolean;            // 是否需要服务端运行
  distDir: string;              // 构建输出目录
  configurationFiles: ConfigurationFiles;  // 默认 + 额外配置文件
  isTypescript: boolean;
  mainFile: string[];           // 候选入口文件列表
  defaultOpenedFile: string[];  // 默认打开的文件

  // 可被子类覆盖的方法
  getEntries(configurationFiles): string[];        // 获取入口文件
  getDefaultOpenedFiles(configurationFiles): string[];
  getViews(configurationFiles): ViewConfig[];       // 获取 UI 面板
  getHTMLEntries(configurationFiles): string[];     // 获取 HTML 入口
}
```

### TemplateType 联合类型

```typescript
type TemplateType =
  | 'adonis' | 'create-react-app' | 'vue-cli' | 'preact-cli'
  | 'svelte' | 'create-react-app-typescript' | 'angular-cli'
  | 'parcel' | 'cxjs' | '@dojo/cli-create-app' | 'gatsby'
  | 'marko' | 'nuxt' | 'next' | 'reason' | 'apollo'
  | 'sapper' | 'nest' | 'static' | 'styleguidist'
  | 'gridsome' | 'vuepress' | 'mdx-deck' | 'quasar'
  | 'unibit' | 'node' | 'ember' | 'custom' | 'docusaurus'
  | 'babel-repl' | 'esm-react' | 'remix-starter' | 'solid';
```

`getDefinition(theme?)` 函数将 `TemplateType` 字符串映射到模板实例，未匹配时回退到 `react`。

## 模板定义示例

### React（默认模板）

```typescript
// react.ts
export default new ReactTemplate(
  'create-react-app',
  'React',
  'https://github.com/facebookincubator/create-react-app',
  'new',
  decorateSelector(() => '#61DAFB'),
  {
    showOnHomePage: true,
    popular: true,
    main: true,
    mainFile: ['/src/index.js', '/src/index.tsx', ...],
    extraConfigurations: {
      '/jsconfig.json': configurations.jsconfig,
      '/tsconfig.json': configurations.tsconfig,
    },
  }
);
```

`ReactTemplate` 子类额外添加 React DevTools 视图标签页，并优先打开 `App.js`/`App.tsx`。

### Vue

```typescript
// vue.ts
class VueTemplate extends Template {
  getEntries(configurationFiles) {
    const entries = super.getEntries(configurationFiles);
    entries.push('/src/main.js', '/main.js');
    return entries;
  }
  getHTMLEntries() {
    return ['/static/index.html', '/public/index.html', '/index.html'];
  }
}
```

Vue 模板覆盖了 `getEntries()` 和 `getHTMLEntries()`，因为 Vue CLI 项目的入口和 HTML 位置与 CRA 不同。

### Next.js

```typescript
// next.ts
export default new Template('next', 'Next.js', '...',
  'github/zeit/next.js/tree/master/examples/hello-world',
  decorateSelector(() => '#ffffff'),
  {
    distDir: 'out',           // Next.js 静态导出目录
    staticDeployment: false,
    mainFile: ['/pages/index.js'],
    backgroundColor: decorateSelector(() => '#000000'),
    main: true, popular: true,
    showCube: false,          // 隐藏 Cube 品牌水印
  }
);
```

## 配置系统

### 配置文件注册表

```typescript
// configuration/index.ts
const configs = {
  babelrc, babelTranspiler, packageJSON, prettierRC,
  sandboxConfig, angularCli, angularJSON, tsconfig,
  customCodeSandbox, nowConfig, netlifyConfig, jsconfig,
};
```

每个配置实现 `ConfigurationFile` 接口：

```typescript
type ConfigurationFile = {
  title: string;
  type: string;
  description: string | null;
  moreInfoUrl: string;
  getDefaultCode?: (template, resolveModule) => string;
  generateFileFromState?: (state: any) => string;
  generateFileFromSandbox?: (sandbox: Sandbox) => string;
  schema?: string;
};
```

### 关键配置生成器

| 配置 | 文件 | 说明 |
|------|------|------|
| `packageJSON` | `configuration/package-json/` | 从 sandbox 元数据生成 `package.json` |
| `tsconfig` | `configuration/tsconfig/` | **8 条代码路径**：CRA-TS、Parcel、Nest、Dojo、Angular、Solid、通用 |
| `babelrc` | `configuration/babelrc/` | 检测 Babel 7/6、Preact 10/legacy，生成对应配置 |
| `sandboxConfig` | `configuration/sandbox/` | `infiniteLoopProtection: true`, `hardReloadOnChange: false` |
| `nowConfig` | `configuration/now/` | Vercel 部署配置 |
| `netlifyConfig` | `configuration/netlify/` | Netlify 部署配置 |

### 配置解析

`parseConfigurations()` 从 sandbox 模块中解析配置文件：
1. 根据模板类型确定需要的配置
2. 从模块树中读取文件内容
3. JSON 用 forked `jsonlint` 解析（支持注释）
4. TOML 用 `markty-toml` 解析
5. 返回 `ParsedConfigurationFiles`（按类型索引的已解析配置对象）

## 完整模板列表

| 模板 | 类型 | 服务端 | 主流 |
|------|------|--------|------|
| React | `create-react-app` | 否 | ✓ |
| React + TS | `create-react-app-typescript` | 否 | |
| Vue 3 | `vue-cli` | 否 | ✓ |
| Angular | `angular-cli` | 否 | ✓ |
| Svelte | `svelte` | 否 | |
| Next.js | `next` | 否 | ✓ |
| Gatsby | `gatsby` | 否 | ✓ |
| Nuxt | `nuxt` | 是 | |
| Node | `node` | 是 | |
| Nest | `nest` | 是 | |
| Preact | `preact-cli` | 否 | |
| Remix | `remix-starter` | 是 | |
| Solid | `solid` | 否 | |
| Docusaurus | `docusaurus` | 否 | |
| Parcel | `parcel` | 否 | |
| 静态 | `static` | 否 | |
| ... | 共 32 种 | | |

## 相关文档

- [04 - Common 包](./04-common-package.md)
- [02 - Sandpack Core](./02-sandpack-core.md)
- [00 - 架构概览](./00-overview.md)
