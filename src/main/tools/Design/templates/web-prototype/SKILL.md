---
name: web-prototype
description: |
  通用桌面 Web 原型。单文件自包含 HTML，通过复制种子 assets/template.html
  并粘贴 references/layouts.md 中的区块布局来构建。适用于着陆页、营销页、
  文档页、SaaS 页面等任何桌面 Web 页面原型。
triggers:
  - "prototype"
  - "mockup"
  - "landing"
  - "single page"
  - "marketing page"
  - "homepage"
  - "网页原型"
  - "着陆页"
  - "首页设计"
  - "官网"
platform: desktop
preview:
  type: html
  entry: index.html
---

# Web 原型模板

使用内置种子文件和布局库生成单文件自包含 HTML 原型 —— **不是从零写 CSS**。种子已编码良好的默认值（排版、间距、强调色预算）。你的任务是组合它们。

## 资源地图

```
web-prototype/
├── SKILL.md                ← 你正在阅读的文件
├── assets/
│   └── template.html       ← 种子：设计令牌 + 类系统 + 页面框架（先读这个）
└── references/
    ├── layouts.md          ← 8 个可直接粘贴的区块骨架
    └── checklist.md        ← P0/P1/P2 自检清单
```

## 工作流程

### 步骤 0 — 预检（写任何东西之前先做一次）

1. **通读 `assets/template.html`** —— 至少读完 `<style>` 块。`references/layouts.md` 顶部的类清单列出了必须在此定义的每个类；如果缺少某个类，在 `<style>` 中添加它，而不是在每个区块上内联定义。
2. **阅读 `references/layouts.md`** 了解有哪些区块骨架。不要写未覆盖的区块类型 —— 选最接近的布局并适配。
3. **确定设计令牌** —— 将用户需求的颜色映射到种子的六个 `:root` 变量；不要引入新令牌。

### 步骤 1 — 从种子准备 index.html

使用 `assets/template.html` 作为规范项目文件（通常是 `index.html`）的种子。

将六个 `:root` 变量替换为当前设计系统的令牌。替换页面 `<title>` 和顶部导航的品牌名。

### 步骤 2 — 规划区块列表

**先选布局再写文案。** 默认节奏（来自 `layouts.md`）：

| 页面类型 | 默认节奏 |
|---|---|
| 着陆页 | 1 hero → 3 features → 4 stats 或 5 quote → 自定义分栏 → 6 cta |
| 营销/编辑 | 1 hero-center → 7 log list → 6 cta |
| 定价页 | 1 hero-center → 8 comparison table → 6 cta |
| 文档索引 | 1 hero-center → 7 log list（文档分节）→ 6 cta |

在写之前用一句话向用户说明选择的列表 —— 他们现在可以低成本调整，而不是在 200 行 HTML 之后。

### 步骤 3 — 粘贴并填充

对于每个选定的布局，从 `layouts.md` 复制 `<section>` 块到项目 HTML 的 `<main id="content">` 中。用用户需求中真实、具体的文案替换方括号 `[REPLACE]` 字符串。**不要填充** —— 如果某个槽位是空的，说明选错了布局；换一个。

### 步骤 4 — 自检

从头到尾过一遍 `references/checklist.md`。每个 P0 项必须通过才能继续。P1 项应该通过；P2 是加分项。

### 步骤 5 — 生成并预览

将完成的 HTML 通过 `design_preview` 工具预览。然后发送一段简短的助手摘要，描述文件内容。不要在聊天中输出完整 HTML 源码。

## 硬性规则（种子保护了大部分 —— 不要对抗它）

- **单一强调色，每屏最多使用两次。** 眉标 + 主 CTA 是默认预算。
- **标题字体是衬线体**（Iowan Old Style / Charter / Georgia）。正文用无衬线。数字、说明、眉标用等宽字体。
- **图片用占位符，不用外部 URL。** 使用 `.ph-img` 类 —— 不要链接到图库 CDN。
- **移动端重排已通过种子的 920px 媒体查询实现。** 不要通过添加固定宽度破坏它。
- **每个 `<section>` 上加 `data-od-id`** 以便注释模式定位。

## 输出约定

生成的 HTML 通过 `design_preview(html=...)` 预览。代码也可通过 `file_write` 写入项目文件。

写完后一段简短摘要。不多说。
