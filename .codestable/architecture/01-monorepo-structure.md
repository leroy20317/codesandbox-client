# Monorepo 结构与包依赖图

> 代码最后更新：2024年。描述 `packages/` 和 `standalone-packages/` 的当前状态。
> 维护方式：新增/删除包时更新。

## 仓库管理

- **工具**: Lerna 6 + Yarn Workspaces
- **版本策略**: independent（每个包独立 semver）
- **Nx**: 禁用
- **包路径**: `packages/*` + `standalone-packages/*`

```json
// lerna.json
{
  "packages": ["packages/*", "standalone-packages/*"],
  "version": "independent",
  "useNx": false
}
```

## 完整包清单

### 应用包 (`packages/`) — 16 个

| 包名 | 可见性 | 职责 | 关键依赖 |
|------|--------|------|----------|
| `app` | private | 主 SPA：Dashboard + 编辑器 + Sandbox + Embed | 几乎所有其他包 |
| `@codesandbox/common` | public | 共享库：模板定义、主题、配置、类型、工具函数 | codesandbox-api, @codesandbox/components |
| `sandpack-core` | public | 浏览器内打包器/转译器引擎 | @codesandbox/common, codesandbox-api, sandbox-hooks |
| `@codesandbox/components` | public | 共享 UI 组件库（design system） | styled-components |
| `codesandbox-api` | public | postMessage 通信协议定义 | **零依赖（叶子包）** |
| `sandbox-hooks` | public | 注入 sandbox iframe 的运行时 hooks | @codesandbox/common, codesandbox-api |
| `@codesandbox/executors` | public | 服务端沙箱执行器 | — |
| `@codesandbox/notifications` | public | Toast/通知系统 | — |
| `@codesandbox/react-embed` | public | 可嵌入的 React sandbox 组件 | — |
| `@codesandbox/template-icons` | public | 模板 SVG 图标（React 组件） | — |
| `node-services` | public | Node.js 内置模块的浏览器 polyfill | — |
| `vue3-transpiler` | public | Vue 3 SFC 转译器（sandpack 用） | — |
| `vue3-browser-compiler` | public | @vue/compiler-sfc 的浏览器 bundle | — |
| `browser-dart-sass` | public | SCSS 编译（dart-sass 浏览器版） | — |
| `browser-eslint-rules` | public | ESLint 浏览器版（bundled rules + parser） | — |
| `codesandbox-deps` | private | Tern.js 代码智能 | — |
| `sse-hooks` | private | Server-Sent Events hooks（沙箱预览） | — |

### Vendor Fork 包 (`standalone-packages/`) — 12 个

| 包名 | 职责 |
|------|------|
| `monaco-editor` | Monaco 编辑器（VS Code 核心）fork |
| `monaco-css` | Monaco CSS 语言支持 |
| `monaco-languages` | Monaco 语言支持包 |
| `monaco-typescript` | Monaco TypeScript 语言服务 |
| `vscode` | VS Code 集成核心 |
| `vscode-editor` | VS Code 编辑器 release build |
| `vscode-extensions` | VS Code 扩展包 |
| `vscode-textmate` | TextMate 语法引擎（语法高亮） |
| `codesandbox-browserfs` | 浏览器内虚拟文件系统 |
| `browser-jsdom` | 浏览器兼容的 JSDOM |
| `resolver` | 模块解析引擎 |
| `sse-loading-screen` | SSE 沙箱加载页面 |

## 包依赖图（核心链）

```
                    ┌──────────────────────┐
                    │        app           │ ◄── SPA（Webpack 多入口）
                    └──────┬──────┬────────┘
          ┌────────────────┤      ├──────────────────────┐
          ▼                ▼      ▼                      ▼
  ┌──────────────┐ ┌──────────┐ ┌────────────────┐ ┌──────────┐
  │ sandpack-core│ │ @cs/common│ │ @cs/components │ │ @cs/exec │
  └──┬───┬───────┘ └──┬───┬───┘ └───────┬────────┘ └────┬─────┘
     │   │             │   │             │               │
     ▼   ▼             ▼   ▼             │               │
┌────────┐ ┌──────┐ ┌──────────┐         │               │
│sandbox-│ │ codes│ │ @cs/      │         │               │
│hooks   │ │ andbox│ │notifications│       │               │
└───┬────┘ │ -api  │ └──────────┘         │               │
    │      └───▲───┘                      │               │
    └──────────┘                          │               │
                                          ▼               ▼
                                  ┌──────────────┐ ┌──────────┐
                                  │codesandbox-api│ │codesandbox│
                                  │  (leaf pkg)   │ │  -api    │
                                  └──────────────┘ └──────────┘
```

### 关键依赖流

1. **`codesandbox-api`** — 叶子包，零依赖。定义 app iframe 与 sandbox iframe 之间的 postMessage 协议
2. **`@codesandbox/common`** → 依赖 `codesandbox-api` + `@codesandbox/components` + `@codesandbox/notifications`。几乎所有包都依赖它
3. **`sandbox-hooks`** → 依赖 `@codesandbox/common` + `codesandbox-api`。提供错误页面等注入 sandbox
4. **`sandpack-core`** → 依赖 `@codesandbox/common` + `codesandbox-api` + `sandbox-hooks`。核心导出：Manager, TranspiledModule, Transpiler, Preset
5. **`app`** → 依赖所有包。是最终消费方

### 跨包共享依赖

以下依赖被多个包共用：
- `react`、`react-dom`、`react-router-dom` — app, common, components, notifications
- `styled-components` — app, common, components, notifications

## 构建流程

```
lerna run build
    │
    ├── 1. codesandbox-api (Rollup)
    ├── 2. @codesandbox/common (TypeScript compile)
    ├── 3. @codesandbox/components (TypeScript compile)
    ├── 4. sandpack-core (TypeScript compile)
    ├── 5. sandbox-hooks (TypeScript compile)
    ├── 6. 其他库包 (Rollup / TypeScript)
    └── 7. app (Webpack multi-entry + Gulp post-build)
            ├── 复制 Monaco/VS Code 静态资源
            ├── 复制 codesandbox-browserfs
            ├── CSS 处理 + 哈希
            └── 生成最终 dist/
```

## 相关文档

- [00 - 架构概览](./00-overview.md)
- [02 - Sandpack Core](./02-sandpack-core.md)
- [03 - App 包内部结构](./03-app-package.md)
