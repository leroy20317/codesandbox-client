# Architecture — 系统架构地图

> 本目录记录 CodeSandbox Client 的**当前**系统架构。只记现状，不写未来规划（规划走 `../roadmap/`）。
> 维护方式：代码有结构性变更时同步更新对应文档。

## 文档索引

| 文件 | 内容 | 适用场景 |
|------|------|----------|
| [00-overview.md](./00-overview.md) | 系统总览：定位、运行时模型、技术栈、关键决策 | 新人入门、全局理解 |
| [01-monorepo-structure.md](./01-monorepo-structure.md) | Monorepo 结构：完整包清单、依赖图、构建流程 | 了解包关系、新增/删除包 |
| [02-sandpack-core.md](./02-sandpack-core.md) | Sandpack Core：浏览器内打包器架构 | 修改打包逻辑、理解转译流程 |
| [03-app-package.md](./03-app-package.md) | App 包内部结构：Webpack 配置、路由、状态管理、Sandbox 运行时 | 修改主应用代码 |
| [04-common-package.md](./04-common-package.md) | Common 包：共享库（模板、主题、配置、工具） | 修改共享库、了解模板/主题系统 |
| [05-template-system.md](./05-template-system.md) | 模板系统详解：32 种项目类型、配置生成器 | 新增/修改模板定义 |
| [06-components-package.md](./06-components-package.md) | Components 包：VS Code 主题感知 UI 组件库 | 修改/新增 UI 组件 |
| [07-code-editor.md](./07-code-editor.md) | 代码编辑器集成：Monaco/VS Code 双编辑器架构 | 修改编辑器、理解资源管线 |

## 架构图

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

## 包依赖总览

```
app ──► sandpack-core ──► @codesandbox/common ──► codesandbox-api (leaf)
  │          │                      │
  │          └──► sandbox-hooks ────┘
  │
  ├──► @codesandbox/components
  ├──► @codesandbox/executors
  ├──► @codesandbox/notifications
  └──► @codesandbox/react-embed
```

## 待补充

以下模块的架构文档待补充（欢迎贡献）：

- `standalone-packages/codesandbox-browserfs/` — 虚拟文件系统
- 实时协作（Phoenix Channels + OT）
- GraphQL 数据层
- 部署与 CI/CD 流程
