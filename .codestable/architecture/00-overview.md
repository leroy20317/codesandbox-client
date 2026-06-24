# Architecture Overview

> 代码最后更新：2024年。本文档描述 CodeSandbox Client 的**当前**系统架构。
> 维护方式：代码有结构性变更时同步更新本文档。

## 系统定位

CodeSandbox Client 是 [codesandbox.io](https://codesandbox.io) 的**浏览器端前端应用**，一个完整的在线 Web IDE。用户可在浏览器中创建、编辑、预览和分享 Web 项目，无需本地环境。

与此仓库配套的后端服务在独立仓库中：
- [codesandbox-server](https://github.com/codesandbox/codesandbox-server) — Phoenix API 服务
- [codesandbox-importers](https://github.com/codesandbox/codesandbox-importers) — 项目导入 / CLI

## 顶层架构

```
┌─────────────────────────────────────────────────┐
│                  浏览器                           │
│  ┌──────────┐  postMessage   ┌────────────────┐ │
│  │ app (IDE) │ ◄──────────► │ sandbox iframe │ │
│  │           │               │                │ │
│  │ Dashboard │               │ sandpack-core  │ │
│  │ Editor    │               │  (bundler)     │ │
│  │ Monaco    │               │  user code     │ │
│  └─────┬─────┘               └───────┬────────┘ │
│        │ HTTP/WS                      │         │
└────────┼──────────────────────────────┼─────────┘
         │                              │
    ┌────▼────┐                  ┌──────▼──────┐
    │ Phoenix │                  │ npm registry│
    │  API    │                  │  CDN        │
    └─────────┘                  └─────────────┘
```

## 核心运行时模型

项目编译为**三个独立 bundle**，在浏览器中通过 postMessage 通信：

| Bundle | 入口 | 职责 |
|--------|------|------|
| **app** | `packages/app/src/app/index.js` | 主 IDE 界面：Dashboard、编辑器、设置 |
| **sandbox** | `packages/app/src/sandbox/index.ts` | 沙箱运行时：在 iframe 中运行用户代码 |
| **embed** | `packages/app/src/embed/index.js` | 独立嵌入模式（精简版） |

### 通信协议

App 与 Sandbox 之间的通信由 `codesandbox-api` 包定义，基于 `postMessage`：

```
app (parent)                    sandbox (iframe)
    │                                │
    │──── compile ──────────────────►│  触发编译
    │◄─── compilation-complete ─────│  编译完成
    │◄─── console.log / error ──────│  控制台输出
    │◄─── preview-ready ────────────│  预览就绪
    │──── eval ────────────────────►│  执行代码
    │◄─── eval-result ─────────────│  执行结果
```

### 沙箱隔离

用户代码**从不**在主 app 上下文中执行。sandbox iframe：
- 加载独立的 `sandbox` bundle
- 通过 `sandpack-core` 在浏览器内完成模块解析、转译、执行
- 通过 `codesandbox-api` 将错误、控制台输出、预览状态回传给父窗口
- `sandbox-hooks` 提供沙箱内错误页面（404、依赖未找到等）

## 技术栈总览

| 关注点 | 选型 | 备注 |
|--------|------|------|
| 前端框架 | React 16.9 | 函数组件 + Hooks |
| 路由 | react-router-dom v5 | 按页面懒加载 |
| 状态管理 | Overmind v27 | 命名空间模块化（dashboard, sidebar, profile...） |
| 额外状态 | MobX 5.x + mobx-state-tree | 编辑器/Sandbox 运行时用 |
| 样式 | styled-components v5 | 组件级作用域 CSS |
| 类型系统 | TypeScript 5.2.2 | core 包 strict，app 包 allowJs |
| 构建 | Webpack（多入口） | 6 个入口点（app/sandbox/embed/...） |
| 沙箱打包 | sandpack-core（自研） | 浏览器内转译 + Web Worker |
| API 通信 | Apollo Client (GraphQL) + Phoenix Channels (WebSocket) | GQL 查询 + 实时协作 |
| 代码编辑器 | Monaco Editor + VS Code 扩展 | TypeScript/JS 语言服务 |
| 实时协作 | Phoenix Channels + OT | 操作变换解决文本冲突 |
| 错误监控 | Sentry + Amplitude | |
| 测试 | Jest + Storybook + Chromatic | |

## 仓库拓扑

```
codesandbox-client/
├── packages/              ← Lerna workspace 包（16 个）
│   ├── app/               ← 主 SPA（Dashboard + 编辑器 + Sandbox + Embed）
│   ├── common/            ← 共享库（模板、主题、类型、工具）
│   ├── sandpack-core/     ← 浏览器内打包器引擎
│   ├── components/        ← 共享 UI 组件库（design system）
│   ├── codesandbox-api/   ← postMessage 通信协议（零依赖叶子包）
│   ├── sandbox-hooks/     ← 注入 sandbox iframe 的运行时 hooks
│   └── ...                ← 详见 01-monorepo-structure.md
│
└── standalone-packages/   ← vendor fork 包（12 个）
    ├── monaco-editor/     ← Monaco 编辑器 fork
    ├── vscode/            ← VS Code 集成
    ├── codesandbox-browserfs/ ← 浏览器内虚拟文件系统
    └── ...
```

## 关键设计决策

参见 `../decisions/README.md` 了解各项决策的详细理由。

| 决策 | 理由 |
|------|------|
| 三 bundle 架构 | 安全隔离：用户代码在 iframe 内执行 |
| 自研 sandpack-core | 需要在浏览器内完成 npm 依赖解析 + 转译，无现成方案 |
| Overmind 状态管理 | 类型安全、函数式、命名空间模块化 |
| Monaco + VS Code 扩展 | 提供完整 IDE 体验（IntelliSense、语言服务） |
| Phoenix Channels 实时协作 | WebSocket + OT 文本同步 |
| Lerna + Yarn Workspaces | 多包管理标准方案，独立版本号 |

## 相关文档

- [01 - Monorepo 结构与包依赖图](./01-monorepo-structure.md)
- [02 - Sandpack Core 浏览器打包器](./02-sandpack-core.md)
- [03 - App 包内部结构](./03-app-package.md)
- [../decisions/README.md](../decisions/README.md) — 技术决策归档
