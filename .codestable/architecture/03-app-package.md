# App 包内部结构

> 代码最后更新：2024年。描述 `packages/app/` 的当前状态。
> 维护方式：app 包顶层结构变更时更新。

## 定位

`packages/app/` 是 CodeSandbox 的**主 Web 应用**。它包含所有面向用户的功能：Dashboard（项目列表）、编辑器（代码编辑 + 预览）、登录/注册、团队工作区等。

## 目录结构

```
packages/app/
├── config/                        # Webpack 配置 + polyfills
│   ├── webpack.common.js          # 共享 Webpack 配置
│   ├── webpack.dev.js             # 开发模式（HMR, react-refresh）
│   ├── webpack.prod.js            # 生产模式
│   ├── build.js                   # 构建后处理（Gulp pipeline）
│   └── polyfills.js               # 浏览器 polyfill
│
├── src/
│   ├── app/                       # 主应用代码
│   │   ├── index.js               # App bundle 入口
│   │   ├── pages/                 # 路由级页面（React.lazy 懒加载）
│   │   │   ├── Sandbox/           # 编辑器（最复杂页面）
│   │   │   ├── Dashboard/         # 用户项目列表
│   │   │   ├── Profile/           # 用户主页
│   │   │   ├── Search/            # 搜索页
│   │   │   ├── SignIn/            # 登录
│   │   │   ├── SignUp/            # 注册
│   │   │   ├── CliInstructions/   # CLI 指引
│   │   │   └── WorkspaceFlows/    # 团队工作区创建流程
│   │   │
│   │   ├── components/            # App 级共享组件
│   │   │   ├── CodeEditor/        # Monaco + CodeMirror 封装
│   │   │   ├── Preview/           # 沙箱预览面板
│   │   │   ├── Create/            # 项目创建向导
│   │   │   ├── Integration/       # GitHub/Vercel 集成
│   │   │   └── dashboard/         # Dashboard 子组件
│   │   │
│   │   ├── overmind/              # 集中状态管理（Overmind）
│   │   │   ├── index.ts           # Overmind 配置入口
│   │   │   ├── state.ts           # 根状态类型
│   │   │   ├── actions.ts         # 根 actions
│   │   │   ├── effects/           # 副作用（API 调用、分析、通知等）
│   │   │   ├── namespaces/        # 功能模块
│   │   │   │   ├── dashboard/     # Dashboard 状态
│   │   │   │   ├── sidebar/       # 侧边栏状态
│   │   │   │   ├── preferences/   # 用户偏好
│   │   │   │   ├── profile/       # 用户资料
│   │   │   │   ├── checkout/      # 付费/订阅
│   │   │   │   ├── modals/        # 模态框管理
│   │   │   │   └── userNotifications/ # 通知
│   │   │   └── factories.ts       # 状态工厂
│   │   │
│   │   ├── graphql/               # GraphQL 查询/变更 + Apollo 配置
│   │   ├── hooks/                 # 自定义 React Hooks
│   │   └── utils/                 # App 级工具函数
│   │
│   ├── sandbox/                   # Sandbox 运行时（独立 bundle）
│   │   ├── index.ts               # Sandbox bundle 入口
│   │   ├── compile.ts             # 编译编排（调用 sandpack-core Manager）
│   │   ├── eval/                  # 代码执行逻辑
│   │   └── worker/                # Web Worker 设置
│   │
│   ├── embed/                     # 嵌入模式（独立 bundle）
│   │   └── components/
│   │
│   ├── banner.js                  # Banner 入口
│   └── watermark-button.js        # 水印按钮入口
│
├── public/                        # 静态资源
└── www/                           # 构建输出目录
```

## Webpack 多入口配置

```javascript
// config/webpack.common.js

// 三种构建模式：
// 1. 全量构建（默认）
entry: {
  app:              'src/app/index.js',        // 主 IDE
  sandbox:          'src/sandbox/index.ts',     // 沙箱运行时
  'sandbox-startup': 'src/sandbox/startup.ts',  // 沙箱启动
  embed:            'src/embed/index.js',       // 嵌入模式
  'watermark-button':'src/watermark-button.js', // 水印
  banner:           'src/banner.js',            // Banner
}

// 2. SANDBOX_ONLY: 仅 sandbox + sandbox-startup
// 3. APP_HOT: 仅 app（快速开发用）
```

### 构建后处理（Gulp）

Webpack 构建后，Gulp 负责：
1. 复制 Monaco/VS Code 静态资源到 `www/public/`
2. CSS 提取 + 内容哈希
3. HTML 模板注入（根据环境替换变量）

## 路由与代码分割

页面使用 `React.lazy` + webpack magic comments 实现按路由懒加载：

```typescript
// src/app/pages/index.tsx

// 普通加载
const SignInAuth = Loadable(() =>
  import(/* webpackChunkName: 'page-sign-in' */ './SignInAuth')
);

// 命名导出适配
const SignIn = Loadable(() =>
  import(/* webpackChunkName: 'page-sign-in' */ './SignIn').then(module => ({
    default: module.SignInPage,
  }))
);
```

主要 chunk 分组：
- `page-sandbox` — 编辑器页面
- `page-dashboard` — Dashboard
- `page-sign-in` — 登录/注册
- `page-profile` — 个人主页
- `page-search` — 搜索
- `page-cli` — CLI 指引

## 状态管理：Overmind

Overmind 使用命名空间模式组织状态：

```
overmind/
├── state.ts          ← 根状态类型定义
├── actions.ts        ← 根 actions
├── effects/          ← 副作用（API 调用等）
└── namespaces/       ← 功能模块
    ├── dashboard/    ← state + actions + effects
    ├── sidebar/
    ├── preferences/
    ├── profile/
    ├── checkout/
    ├── modals/
    └── userNotifications/
```

每个 namespace 遵循 `{ state, actions, effects }` 模式，通过 `namespaced()` 函数组合到根配置中。

```typescript
// src/app/overmind/index.ts
export const config = merge(
  { effects, state, actions },
  namespaced({
    preferences,
    userNotifications,
    dashboard,
    sidebar,
    profile,
    checkout,
    modals: createModals(modals),
  })
);
```

## 编辑器页面（`pages/Sandbox/`）

这是最复杂的页面，包含：

```
Sandbox/
├── Editor/           # Monaco 编辑器集成
│   ├── CodeEditor/   # 代码编辑器封装
│   ├── Header/       # 顶部工具栏
│   ├── Tabs/         # 文件标签页
│   └── Workspace/    # 文件树
│
├── Preview/          # 预览面板（内嵌 sandbox iframe）
│   ├── Navigator/    # 浏览器导航栏（URL 栏）
│   └── ResponsiveWrapper/ # 响应式预览尺寸切换
│
├── StatusBar/        # 底部状态栏
└── common/           # 编辑器共享组件
```

## 沙箱运行时（`sandbox/`）

独立于主 app 代码，编译为独立 bundle，在 iframe 中加载：

```
sandbox/
├── index.ts          # 入口：监听 postMessage "compile"
├── compile.ts        # 编排 sandpack-core Manager
├── eval/             # 用户代码执行
│   ├── managers/     # 各框架的 eval manager
│   └── transpilers/  # 转译器配置
├── startup.ts        # 沙箱初始化
└── worker/           # Web Worker 设置
```

## TypeScript 路径别名

```json
// tsconfig.base.json
{
  "paths": {
    "app/*":    ["./src/app/*"],
    "embed/*":  ["./src/embed/*"],
    "sandbox/*":["./src/sandbox/*"]
  }
}
```

## 相关文档

- [00 - 架构概览](./00-overview.md)
- [01 - Monorepo 结构](./01-monorepo-structure.md)
- [02 - Sandpack Core](./02-sandpack-core.md)
