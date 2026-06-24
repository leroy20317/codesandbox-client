# 代码编辑器集成

> 代码最后更新：2024年。描述 Monaco Editor 和 VS Code 在 CodeSandbox 中的集成方式。
> 维护方式：编辑器架构或静态资源管线变更时更新。

## 定位

CodeSandbox 使用**双编辑器架构**，通过 `settings.codemirror` 开关切换：

| 模式 | 编辑器 | 默认场景 |
|------|--------|----------|
| `codemirror: true` | CodeMirror（旧版） | iOS 默认（轻量） |
| `codemirror: false` | VS Code Workbench Shell | 非 iOS 默认（完整 IDE） |

开关存储在 localStorage `settings.codemirror`，由 Overmind 状态层管理。

## 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                     index.html (app shell)                       │
│  Preload: codesandbox.editor.main.css + .js from /vscode33/vs   │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────▼──────────────┐
          │   settings.codemirror ?     │
          └──────┬────────────┬─────────┘
                 │ true       │ false (default)
                 ▼            ▼
    ┌─────────────────┐   ┌──────────────────────────┐
    │  CodeMirror/     │   │  VSCode Workbench        │
    │  index.js        │   │  (standalone, non-React)  │
    │                  │   │  Loaded by:               │
    │  - CodeMirror    │   │  vscode-script-loader.ts  │
    │  - Tern.js 补全  │   │                           │
    │  - ESLint Worker │   │  AMD module system mocks: │
    │  - Emmet         │   │  fs → BrowserFS           │
    │  - Vim mode      │   │  http → browserify        │
    └─────────────────┘   │  path → path-browserify    │
                           │  child_process → stub     │
                           │  electron → stub          │
                           └──────────────────────────┘

Shared Chrome: FilePath, FuzzySearch, Configuration
```

## VS Code 编辑器（主路径）

### 关键组件

| 组件 | 版本 | 位置 | 角色 |
|------|------|------|------|
| **vscode-editor** | 0.14.3 | `standalone-packages/vscode-editor/` | 主编辑器分发（workbench + editor + platform） |
| **monaco-editor** | 0.13.1 | `standalone-packages/monaco-editor/` | 旧版分发 + 自定义 `codesandbox.editor.main.js` |
| **monaco-editor-core** | 0.14.6 | npm（vscode-editor 的 devDep） | Monaco 核心引擎 |
| **vscode-textmate** | 4.0.1 | `standalone-packages/vscode-textmate/` | TextMate 语法引擎（语法高亮） |
| **vscode-extensions** | 1.0.0 | `standalone-packages/vscode-extensions/` | 打包的 VS Code 扩展 |
| **oniguruma / onigasm** | — | multiple WASM paths | TextMate 的正则引擎 |

### 静态资源管线

构建时将 Monaco/VS Code 静态资源从 `standalone-packages/` 复制到 `www/public/`：

```
Sources                                   Destinations
────────────────────────────────────────  ─────────────────────────────
vscode-editor/release/min/vs       →     public/vscode33/vs/    (主编辑器)
monaco-editor/release/min/vs       →     public/14/vs/          (旧版)
vscode-extensions/out              →     public/vscode-extensions/v21/
vscode-oniguruma/onig.wasm         →     public/vscode-oniguruma/1.3.1/
onigasm/onigasm.wasm               →     public/onigasm/2.2.1/
vscode-textmate/onigasm/onigasm.wasm →  public/onigasm/2.1.0/
monaco-vue/release/min             →     public/14/vs/language/vue/
```

`SANDBOX_ONLY` 模式跳过所有编辑器资源复制。

### VS Code Script Loader

`overmind/effects/vscode/vscode-script-loader.ts` 负责引导 VS Code 编辑器：

1. 预加载 `codesandbox.editor.main.css` 和 `.js`
2. Mock Node.js API（`fs` → BrowserFS、`http` → browserify、`path` → path-browserify）
3. 初始化 VS Code Workbench shell
4. 加载 VS Code 扩展和语言服务

### VS Code 扩展

扩展打包在 `standalone-packages/vscode-extensions/`：

```
复制 extensions-bundle/ → out/extensions/
  → 生成 index.json (BrowserFS HTTP 索引)
  → 压缩为 vscode-extensions.tar.zst (zstd)
  → 部署到 /public/vscode-extensions/v21/
  → 生产环境合并为 main.min.json (减少 HTTP 请求)
```

## CodeMirror 编辑器（回退路径）

`packages/app/src/app/components/CodeEditor/CodeMirror/` 实现 `Editor` 接口：

- **ESLint 验证** — Web Worker 中运行
- **Tern.js 补全** — 懒加载
- **Emmet 支持**
- **Vim 模式**
- **文档缓存** — `documentCache[moduleId]` 按模块缓存

## Editor 接口

两种编辑器实现同一个 `Editor` 接口：

```typescript
interface Editor {
  changeSandbox(sandbox, newCurrentModule, dependencies);
  setErrors(errors);
  setCorrections(corrections);
  updateModules(modules);
  changeSettings(settings);
  changeDependencies(deps);
  changeModule(module);
  changeCode(code, moduleId);
  setTSConfig(config);
  setReceivingCode(receiving);
  applyOperations(operations);
  updateUserSelections(selections);
}
```

## 共享编辑器周边组件

两种编辑器共用以下 UI 组件（位于 `CodeEditor/` 下）：

| 组件 | 职责 |
|------|------|
| `FilePath/` | 面包屑文件路径条 + Zen 模式切换 |
| `FuzzySearch/` | `Cmd+P` 模糊文件搜索（基于 Downshift） |
| `Configuration/` | 配置文件编辑向导 UI |

## 相关文档

- [06 - Components 设计系统](./06-components-package.md)
- [03 - App 包内部结构](./03-app-package.md)
- [00 - 架构概览](./00-overview.md)
