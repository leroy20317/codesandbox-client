# Sandpack Core — 浏览器内打包器

> 代码最后更新：2024年。描述 `packages/sandpack-core/` 的当前状态。
> 维护方式：sandpack-core 架构变更时更新。

## 定位

`sandpack-core` 是 CodeSandbox 的**浏览器内打包/转译引擎**。它让用户代码在浏览器中完成：
1. npm 依赖的远程下载和缓存
2. 模块解析（ES module + CommonJS）
3. 源码转译（Babel、TypeScript、Vue SFC、SCSS 等）
4. 代码执行和 HMR（热模块替换）

所有操作在 Web Worker 中执行，不阻塞主线程。

## 核心 API

```typescript
// packages/sandpack-core/src/index.ts
export { default as Manager } from './manager';
export {
  TranspiledModule,
  LoaderContext,
  getModuleUrl,
} from './transpiled-module';
export { Transpiler, TranspilerResult } from './transpiler';
export { Preset, TranspilerDefinition } from './preset';
```

## 架构

```
┌──────────────────────────────────────────┐
│              Manager                      │
│  ┌────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Preset │  │ Resolver │  │ Caching  │ │
│  └───┬────┘  └────┬─────┘  └────┬─────┘ │
│      │            │              │       │
│  ┌───▼────────────▼──────────────▼─────┐ │
│  │         Transpiler Pipeline         │ │
│  │  (runs in Web Worker)               │ │
│  │  babel → ts → vue → scss → css ... │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Manager

`Manager` 是整个打包器的编排器。职责：
- 接收编译请求（来自 app 的 postMessage `compile`）
- 管理模块图（module graph）
- 协调 Preset、Resolver、Transpiler、Caching 之间的协作
- 管理 Web Worker 生命周期

### Preset（预设）

`Preset` 是一组 Transpiler 的集合，对应不同项目模板：

```
Template (React) → Preset → [babel-transpiler, css-transpiler, ...]
Template (Vue)   → Preset → [vue-transpiler, css-transpiler, ...]
Template (Node)  → Preset → [babel-transpiler, raw-transpiler, ...]
```

每个模板定义在 `@codesandbox/common/src/templates/` 下，指定使用哪个 Preset 和哪组 transpiler。

### TranspiledModule

`TranspiledModule` 代表一个被转译后的模块。它管理：
- 模块的转译结果缓存
- 依赖关系（imports/exports）
- HMR 更新传播
- 源码与编译产物的映射

### Transpiler

`Transpiler` 是单个转译器的抽象。每个 transpiler 实现 `doTranspile(code, loaderContext)` 方法：

```typescript
abstract class Transpiler {
  abstract doTranspile(code: string, loaderContext: LoaderContext): Promise<TranspilerResult>;
}
```

内置 transpiler 包括：
- Babel（JS/JSX/TS → ES5）
- TypeScript
- Vue 3 SFC
- SCSS/SASS
- CSS
- Raw（复制原文件）
- JSON

### Resolver（模块解析）

Resolver 负责：
- 解析 `import` / `require` 路径
- 区分本地文件 vs npm 包
- 处理 node_modules 路径映射
- 支持 ES module (`import`) 和 CommonJS (`require`)

### npm 依赖管理

当遇到 npm 包时：
1. 检查内存缓存 → IndexedDB 缓存 → 远程请求
2. 从 npm registry / CDN 动态下载包内容
3. 解析包的 `package.json` 确定入口文件
4. 递归处理包的依赖

### 缓存层

```
内存缓存 (LRU)  ← 最快，会话内有效
     ↓ miss
IndexedDB       ← 持久化，跨会话
     ↓ miss  
远程下载        ← npm registry / CDN
```

### Web Worker

转译在 Web Worker 中执行，避免阻塞主线程：
```
Main Thread          Web Worker
    │                    │
    │── compile ────────►│
    │                    │  manager.queueCompile()
    │                    │  transpiler.doTranspile()
    │                    │  resolver.resolve()
    │◄── result ────────│
    │                    │
```

## 主要入口点

- `src/manager.ts` — Manager 实现
- `src/transpiled-module.ts` — TranspiledModule 实现
- `src/transpiler.ts` — Transpiler 抽象类
- `src/preset.ts` — Preset 实现
- `src/resolver/` — 模块解析逻辑
- `src/npm/` — npm 依赖获取
- `src/transpiler/` — 各 transpiler 实现
- `src/worker/` — Web Worker 相关

## 构建

sandpack-core 使用 TypeScript 编译（`tsc`），输出到 `lib/` 目录。在 `app` 中作为依赖被 webpack 打包。

## 相关文档

- [00 - 架构概览](./00-overview.md)
- [01 - Monorepo 结构](./01-monorepo-structure.md)
- [03 - App 包内部结构](./03-app-package.md)
