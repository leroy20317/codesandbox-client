# CodeStable — CodeSandbox Client 知识库

> `.codestable/` 是 CodeSandbox Client 项目的结构化知识管理系统。它只记录**现状**和**已确认的决策**，不包含猜测或未来规划（规划走 `roadmap/`）。

## 目录结构

```
.codestable/
├── README.md              ← 本文件，知识库导航
├── architecture/          ← 系统架构地图（只记现状，不写未来）
├── requirements/          ← 能力愿景文档（需求是什么、为谁、怎么算成功）
├── roadmap/               ← 大型事前规划（子 feature 拆解 + 接口契约）
├── decisions/             ← 已拍板的技术选型、架构决定、约束、编码规约
├── learning/              ← 踩过的坑 & 好做法（pitfall / knowledge）
├── tricks/                ← 可复用的编程模式、库用法、技术技巧
└── guides/                ← 开发者指南 & 用户指南（任务导向）
```

## 使用方式

- **想看系统长什么样** → `architecture/`
- **想做新功能** → `requirements/` + `roadmap/`，然后走 `cs-feat` 流程
- **想查技术决策** → `decisions/`
- **修 bug** → `cs-issue` 流程
- **想学踩过的坑** → `learning/`
- **想找复用模式** → `tricks/`

## 维护原则

1. **architecture/ 只记现状** — 代码改了就更新，不写"计划要改成 X"
2. **decisions/ 只记已拍板的** — 讨论中的不归档
3. **每个文档有明确的所有者（哪个模块/哪个 package）**
4. **文件名用数字前缀排序**（如 `01-overview.md`、`02-sandpack-core.md`）
