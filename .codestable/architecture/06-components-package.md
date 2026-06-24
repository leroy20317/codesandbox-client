# Components 包 — 设计系统

> 代码最后更新：2024年。描述 `packages/components/`（`@codesandbox/components`）的当前状态。
> 维护方式：新增组件或设计 token 变更时更新。

## 定位

`@codesandbox/components` 是 CodeSandbox 的 **VS Code 主题感知 UI 组件库**。它不是一个普通的 design system——核心设计决策是让整个 UI 随 VS Code 主题自动适配。

## 技术栈

| 层 | 选型 | 作用 |
|----|------|------|
| 样式引擎 | `styled-components` v5 | 组件级 CSS-in-JS |
| Token 映射 | `@styled-system/css` v5 | 将 `'button.background'` 字符串路径映射到 theme 对象的实际值 |
| 样式组合 | `deepmerge` v4 | variant × size × customCss 的样式合并 |
| 无障碍 | `@reach/*` 系列 | Menu、Tooltip、SkipNav、Portal 的 ARIA 基元 |
| 颜色计算 | `color` v3 | 主题 polyfill 的颜色操作（对比度、明暗调节） |
| 颜色存储 | `dot-object` v2 | `'button.background': '#fff'` 平铺格式 → 嵌套对象转换 |

## 目录结构

```
packages/components/src/
├── index.ts                       # Barrel 导出（38 个组件 + design-language）
├── components/                    # 38 个组件，按原子/分子/布局分类
│   ├── Element/                   # 基础基元（所有组件的根）
│   ├── ThemeProvider/             # 主题提供者
│   ├── Button/, IconButton/, ComboButton/
│   ├── Input/, Textarea/, SearchInput/, Select/
│   ├── Checkbox/, Radio/, Switch/
│   ├── Text/, Label/, Link/, Badge/, Banner/
│   ├── Avatar/, Card/, CreateCard/, ExternalCard/
│   ├── Icon/, Loading/, SkeletonText/, Stats/
│   ├── SkipNav/, Tooltip/, Menu/
│   ├── Collapsible/, FormField/, TagInput/, Tags/
│   ├── List/, Integration/, InteractiveOverlay/
│   ├── Grid/, Stack/, SidebarRow/
│   └── MessageStripe/
│
├── design-language/               # 设计 Token
│   ├── index.ts                   # 导出入口
│   ├── theme.ts                   # space, sizes, breakpoints, radii, shadows, speeds
│   ├── colors.ts                  # 调色板（v1 grays/blues/reds... + v2 100-800 色阶）
│   └── typography.ts              # 字体大小、字重
│
├── themes/                        # 16 个 VS Code 颜色主题
│   ├── codesandbox.ts             # 默认 CodeSandbox 主题
│   ├── codesandbox-black.ts
│   ├── codesandbox-light.ts
│   ├── night-owl.ts, night-owl-no-italics.ts
│   ├── atom-dark.ts, atom-light.ts
│   ├── cobalt2.ts, lucy.ts
│   ├── palenight.ts, palenight-italic.ts
│   ├── shades-of-purple.ts
│   ├── high-contrast.ts
│   ├── vscode-light.ts
│   └── solarized-light.ts
│
├── utils/                         # polyfill-theme.ts + dot-object
└── examples/                      # 组合示例 Story
```

## 三层主题合并架构

这是整个 design system 最核心的设计：

```
Layer 1: Design Language
  ├─ space: [0, 4, 8, 12, 16, 20, 24, ...]  (4px 网格)
  ├─ sizes: [0, 4, 8, ...]
  ├─ speeds: [0, '75ms', '100ms', '150ms', ...]
  ├─ breakpoints: ['576px', '768px', '992px']
  ├─ radii: { small: 2, medium: 4, large: 16, round: '50%' }
  ├─ shadows: { /* 海拔 + 命名阴影 */ }
  └─ typography: { fontSizes, fontWeights }

Layer 2: VS Code Color Theme
  ├─ 'button.background': '#...'     (平铺 dot-notation 格式)
  ├─ 'sideBar.foreground': '#...'
  ├─ 'input.border': '#...'
  ├─ 'editor.background': '#...'
  └─ 'tokenColors': [{scope, settings}]  (语法高亮)

Layer 3: Polyfill (polyfill-theme.ts)
  ├─ 从 VS Code 主题推断缺失的 UI 颜色
  ├─ 计算 VS Code 未定义的 Token: secondaryButton, dangerButton,
  │   switch, avatar, menuList, dialog, mutedForeground
  └─ 使用 color 库确保对比度和可读性

        ↓ deepmerge 合并 ↓

          Final Theme Object
  ┌──────────────────────────────────┐
  │ 供 styled-components ThemeProvider │
  │ 使用 @styled-system/css 解析 token  │
  └──────────────────────────────────┘
```

### ThemeProvider

```typescript
// ThemeProvider 合并流程
design-language + VS Code theme + polyfill → 最终 theme
  → styled-components <ThemeProvider theme={finalTheme}>
```

关键在于 **polyfill 层**：VS Code 主题只定义了编辑器相关的颜色，但 UI 需要按钮、开关、对话框、头像等组件的颜色。polyfill 层从已有的 VS Code 颜色推算这些 UI token，或回退到 CodeSandbox Black/Light 的默认值。

## 组件设计模式

### Element — 统一基元

所有组件构建在 `Element` 之上：

```typescript
// Element 本质是一个 styled.div
const Element = styled.div`
  ${props => css({    // @styled-system/css
    margin: props.margin,
    padding: props.padding,
  })}
`;
```

其他组件通过 `styled(Element)` 扩展：

```typescript
// Button 基于 Element
const Button = styled(Element).attrs({ as: 'button' })`
  // ...
`;

// Stack 基于 Element
const Stack = styled(Element).attrs({ 
  // 自动处理 flex 布局
})``;
```

### Variant 系统

组件使用 `deepmerge.all()` 组合样式变体：

```
variantStyles[variant]  +  sizeStyles[size]  +  commonStyles  +  customCss
         ↓                      ↓                  ↓               ↓
     (primary/secondary)    (small/medium/large)  (基础样式)    (用户传入)
         ↓
      最终 CSS-in-JS 对象
```

### Theme Token 引用

两种方式引用主题 token：

```typescript
// 方式 1: @styled-system/css 对象语法（静态）
css({
  backgroundColor: 'button.background',   // 自动解析为 theme['button.background']
  color: 'button.foreground',
})

// 方式 2: styled-components 模板字面量（动态）
color: ${theme => theme.colors.input.foreground};
```

## 组件清单

### 基础（Primitives）— 2 个
`Element`, `ThemeProvider`

### 原子（Atoms）— 20 个
`Avatar`, `Badge`, `Banner`, `Button`, `Card`, `Checkbox`, `CreateCard`, `ExternalCard`, `Icon`, `IconButton`, `Input`, `Loading`, `Label`, `Link`, `Radio`, `SearchInput`, `Select`, `SkeletonText`, `SkipNav`, `Stats`, `Switch`, `Text`, `Textarea`

### 分子（Molecules）— 12 个
`Collapsible`, `FormField`, `Integration`, `List`, `Menu`, `TagInput`, `Tags`, `Tooltip`, `Banner`, `MessageStripe`, `InteractiveOverlay`, `ComboButton`

### 布局（Layout）— 3 个
`Grid` (12 列 + Column + Row), `SidebarRow`, `Stack` (flex 布局)

## 测试

- **Storybook 7.5**：40 个 story 文件，覆盖几乎所有组件
- **主题切换**：Storybook 支持在 16 个 VS Code 主题间实时切换
- **Chromatic**：CI 视觉回归测试，`master` 分支自动接受变更

## 相关文档

- [04 - Common 包](./04-common-package.md)
- [07 - 代码编辑器集成](./07-code-editor.md)
- [00 - 架构概览](./00-overview.md)
