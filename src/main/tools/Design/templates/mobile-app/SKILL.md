---
name: mobile-app
description: |
  在像素级精确的 iPhone 15 Pro 设备框中渲染的移动应用界面。
  通过复制种子 assets/template.html 并粘贴 references/layouts.md 中的
  界面原型来构建。当需求提到"移动应用"、"iOS 应用"、"Android 应用"、
  "手机界面"、"App UI"时使用。
triggers:
  - "mobile app"
  - "ios app"
  - "android app"
  - "phone screen"
  - "app ui"
  - "app mockup"
  - "移动端"
  - "手机 app"
  - "手机界面"
  - "App 设计"
platform: mobile
preview:
  type: html
  entry: index.html
---

# 移动应用模板

生成一个移动应用界面原型，框在真实感的 iPhone 15 Pro 设备中。

## 资源地图

```
mobile-app/
├── SKILL.md                ← 你正在阅读的文件
├── assets/
│   └── template.html       ← 种子：设备框 + 屏幕原语（先读这个）
└── references/
    ├── layouts.md          ← 6 个界面原型（Feed / Detail / Onboarding / Profile / Checkout / Focus）
    └── checklist.md        ← P0/P1/P2 自检清单（防假设备）
```

## 工作流程

### 步骤 0 — 预检

1. **通读 `assets/template.html`** 至少读完 `<style>` 块。灵动岛、状态栏 SVG 图标、Home 指示器、侧边按键、底部标签栏都已用 HTML/SVG 绘制 —— 不要在每个界面上重新实现它们。
2. **阅读 `references/layouts.md`** 了解 6 个原型。
3. **确定设计令牌** —— 将令牌映射到种子的六个 `:root` 变量。

### 步骤 1 — 复制种子

复制 `assets/template.html` 作为项目 HTML。将六个 `:root` 变量替换为当前设计系统的令牌。替换页面 `<title>` 和设备上方的说明文字。

### 步骤 2 — 选择恰好一个原型

| 需求语言 | 使用 |
|---|---|
| feed、收件箱、时间线、列表、消息、通知 | A — Feed |
| 文章、帖子、条目、菜谱、歌曲、产品、详情 | B — Detail |
| 注册、欢迎、介绍、引导、导览 | C — Onboarding |
| 个人资料、账户、用户页、某人简介 | D — Profile |
| 结算、支付、订单、表单、设置步骤 | E — Checkout |
| 计时器、地图、仪表盘小部件、单个大数字 | F — Focus / Hero 卡片 |

移动界面只做**一件事**。如果需求似乎组合了两件事，出一个界面并提供另一个作为后续。

### 步骤 3 — 粘贴并填充

从 `layouts.md` 复制原型块到 `<main class="content">` 中，替换占位符卡片。用需求中真实、具体的文案替换方括号文字。对于不显示标签栏的原型（B、C、E），**删除整个 `<nav class="tabbar">` 块**。

### 步骤 4 — 自检

过一遍 `references/checklist.md`。特别注意：
- 设备框仍有灵动岛、状态栏 SVG 和 Home 指示器
- 点击目标 ≥ 44px
- 一个强调色，屏幕上最多用 2 次
- 标题仍使用 `var(--font-display)`

### 步骤 5 — 生成并预览

将完成的 HTML 通过 `design_preview(html=...)` 预览。一段简短描述。

## 硬性规则

- **手机是真实的。** 灵动岛缺口、SVG 状态图标、Home 指示器。种子保护了这三者 —— 不要重写设备框。
- **单屏，单任务。** 不多标签导览，不拼接流程。
- **强调色预算 = 2。** 一个活跃标签 + 一个主要操作是默认。
- **数字用等宽字体** 通过 `.num` 类。
- **标题用衬线体** 通过 `var(--font-display)`。
- **无外部图片** —— 使用 `.ph-img` 占位符。
