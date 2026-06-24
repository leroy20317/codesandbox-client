# Common 包 — 共享库

> 代码最后更新：2024年。描述 `packages/common/`（`@codesandbox/common`）的当前状态。
> 维护方式：common 包公开 API 或模板系统变更时更新。

## 定位

`@codesandbox/common` 是整个 monorepo 的**共享基础库**。几乎所有包都依赖它（直接或间接）。它提供三块核心能力：

1. **模板系统** — 32 种项目类型的定义和配置生成
2. **主题系统** — 链式颜色函数 + 字体 + 响应式断点
3. **共享工具** — 分析、URL 生成、版本检测、文件解析等

## 目录结构

```
packages/common/src/
├── templates/                  # 模板系统（详见 05-template-system.md）
│   ├── template.ts             # Template 基类
│   ├── index.ts                # TemplateType 联合类型 + getDefinition()
│   ├── react.ts, vue.ts, next.ts, ... # 32 个模板定义文件
│   ├── configuration/          # 配置生成器（12 种）
│   │   ├── index.ts            # 配置注册表
│   │   ├── types.ts            # ConfigurationFile 类型
│   │   ├── parse.ts            # 配置解析器（JSON/TOML）
│   │   ├── elements.ts, ui.ts  # 配置 UI 组件
│   │   ├── package-json/       # package.json 生成
│   │   ├── tsconfig/           # tsconfig.json 生成（8 条代码路径）
│   │   ├── babelrc/            # .babelrc 生成
│   │   ├── prettierRC/         # .prettierrc 生成
│   │   ├── sandbox/            # sandbox.config.json 生成
│   │   ├── now/                # Vercel 部署配置
│   │   ├── netlify/            # Netlify 部署配置
│   │   └── ...
│   └── helpers/                # ReactTemplate 等辅助类
│
├── theme/                      # 主题系统
│   ├── index.ts                # 导出入口
│   ├── theme.ts                # 主题组合（colors + fonts + media + sizes）
│   ├── createTheme.ts          # createTheme() 工厂函数
│   └── decorateSelector.ts     # 链式颜色操作（lighten/darken/saturate...）
│
├── components/                 # 共享 React 组件
│   ├── Preference/             # 配置 UI 控件（checkbox, dropdown, keybinding）
│   ├── Preview/                # 预览相关（AddressBar, Navigator）
│   ├── SandboxCard/            # 项目卡片
│   ├── Tooltip/, Tags/, Stats/, ...
│   └── icons/                  # 图标组件（Lock, Folder, Cog...）
│
├── utils/                      # 工具函数
│   ├── analytics/              # Amplitude 集成
│   ├── diff/                   # 文本比对
│   ├── makeTheme/              # VS Code 主题构建器
│   ├── url-generator/          # URL 生成
│   └── ...
│
├── sandbox/                    # Sandbox 模块类型定义
├── themes/                     # JSON 主题文件
├── forked-vendors/             # Fork 的第三方代码（jsonlint）
└── stories/                    # Storybook 装饰器
```

## 包信息

- **包名**: `@codesandbox/common` (v1.0.12)
- **许可证**: Apache-2.0
- **构建**: `tsc` → `babel` → `cpx`（复制静态资源到 `lib/`）
- **输出**: CommonJS 模块 + `.d.ts` 声明
- **导入方式**: 子路径导入（如 `@codesandbox/common/lib/templates`），无 barrel 文件

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES6",
    "jsx": "react",
    "outDir": "lib",
    "declaration": true
  }
}
```

## 主题系统

### 设计

主题系统基于两层：

1. **`createTheme(colors)`** — 接收平铺的颜色对象，将每个颜色值包装为**可链式调用的函数**（而非字符串）
2. **`decorateSelector(fn)`** — 给颜色函数附加链式变色方法：`.lighten()`, `.darken()`, `.saturate()`, `.desaturate()`, `.clearer()`, `.opaquer()`, `.rotate()`, `.greyscale()`, `.whiten()`, `.blacken()`

```typescript
// 使用示例
theme.primary()                    // '#FFD399'
theme.primary.darken(0.2)()       // 加深 20%
theme.primary.darken(0.2).saturate(0.3)()  // 加深 + 加饱和
```

每个链式调用通过 `memoize` 缓存，避免重复计算。

### 主题组成

```typescript
// theme.ts
export const theme = {
  ...createTheme({
    background: '#24282A',
    background2: '#1C2022',
    primary: '#FFD399',
    secondary: '#40A9F3',
    red: '#F27777',
    green: '#5da700',
    sidebar: '#191d1f',
    // ... 约 20 个语义化颜色
  }),
  vscodeTheme: codesandbox,     // VS Code 主题 JSON
  fonts,                         // 字体栈（Inter + 系统回退）
  media,                         // 响应式媒体查询辅助
  sizes,                         // 断点尺寸常量
};
```

### 响应式断点

```
xsmall (< 576px) → small (576px) → medium (768px) → large (992px) → xlarge (1200px) → xxlarge (1600px+)
```

`media` 提供 CSS-in-JS 查询辅助：`.greaterThan('small')`, `.lessThan('medium')`, `.between('small', 'large')`。

## 构建与发布

```
tsc (类型检查 + 编译) → babel (JS 转译) → cpx (复制 css/svg/png/jpg/woff2/d.ts)
                                          └→ lib/
```

开发模式使用并行 watch：`tsc --watch` + `babel --watch` + `cpx --watch`。

## 相关文档

- [05 - 模板系统详解](./05-template-system.md)
- [06 - Components 设计系统](./06-components-package.md)
- [00 - 架构概览](./00-overview.md)
