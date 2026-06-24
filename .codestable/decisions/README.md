# 技术决策归档

> 本目录记录已拍板的技术选型、架构决定、长期约束和编码规约。
> 讨论中的决策不归档，只归档已确认的。
> 分类：tech-stack（技术选型）、architecture（架构决定）、constraint（长期约束）、convention（编码规约）

## 决策清单

### 架构决策（architecture）

| 编号 | 决策 | 简述 | 归档日期 |
|------|------|------|----------|
| ADR-001 | 三 Bundle 架构（app/sandbox/embed） | 用户代码在 iframe 内执行，通过 postMessage 与主 IDE 通信，实现安全隔离 | 2024年（现有代码推断） |
| ADR-002 | 自研 sandpack-core 浏览器内打包器 | 需要在浏览器内完成 npm 依赖解析 + 转译 + 执行，无现成方案满足需求 | 2024年（现有代码推断） |
| ADR-003 | Monaco Editor + VS Code 扩展 | 提供完整的 IDE 体验（IntelliSense、语言服务、语法高亮） | 2024年（现有代码推断） |
| ADR-004 | Phoenix Channels + OT 实时协作 | WebSocket 连接 + Operational Transformation 文本同步 | 2024年（现有代码推断） |

### 技术选型（tech-stack）

| 编号 | 决策 | 简述 | 归档日期 |
|------|------|------|----------|
| TECH-001 | Lerna + Yarn Workspaces 管理 monorepo | 多包独立版本号，标准 monorepo 方案 | 2024年 |
| TECH-002 | React 16.9 作为 UI 框架 | 函数组件 + Hooks 模式 | 2024年 |
| TECH-003 | Overmind v27 作为主状态管理 | 类型安全、函数式、命名空间模块化；MobX 用于编辑器/运行时 | 2024年 |
| TECH-004 | styled-components v5 作为样式方案 | 组件级作用域 CSS，支持主题 | 2024年 |
| TECH-005 | TypeScript 5.2.2 | core 包 strict 模式，app 包 allowJs 渐进迁移 | 2024年 |
| TECH-006 | Webpack 多入口 + Gulp 后处理 | 复杂资源管线（Monaco/VS Code 静态资源、WASM、Worker） | 2024年 |
| TECH-007 | Apollo Client (GraphQL) + Phoenix Channels (WebSocket) | GQL 数据查询 + 实时推送 | 2024年 |
| TECH-008 | Jest + Storybook + Chromatic 测试体系 | 单元测试 + 组件故事 + 视觉回归 | 2024年 |

### 长期约束（constraint）

_暂无归档的长期约束。使用 `cs-decide` 流程添加。_

### 编码规约（convention）

_暂无归档的编码规约。使用 `cs-decide` 流程添加。_

## 格式

新决策文档命名：`{YYYY-MM-DD}-{slug}.md`

每份决策文档应包含：
1. **背景** — 什么场景下需要做这个决定
2. **方案对比** — 考虑了哪些选项，各自的优缺点
3. **最终决定** — 选择了什么，为什么
4. **后果** — 这个决定带来了什么影响（正面和负面）
5. **相关方** — 谁参与了这个决定

## 模板

```markdown
# {决策标题}

- 类型: tech-stack | architecture | constraint | convention
- 日期: YYYY-MM-DD
- 状态: accepted

## 背景

## 方案对比

### 方案 A: {名称}
- 优点:
- 缺点:

### 方案 B: {名称}
- 优点:
- 缺点:

## 最终决定

## 后果
```
