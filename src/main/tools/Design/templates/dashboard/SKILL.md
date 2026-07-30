---
name: dashboard
description: |
  管理 / 分析仪表盘，单文件自包含 HTML。固定左侧边栏，
  顶部栏含用户/搜索，主区域为 KPI 卡片网格和一到两个图表。
  当需求提到"仪表盘"、"后台"、"分析"、"控制面板"时使用。
triggers:
  - "dashboard"
  - "admin panel"
  - "analytics"
  - "control panel"
  - "后台"
  - "管理后台"
  - "仪表盘"
  - "数据看板"
  - "监控面板"
platform: desktop
preview:
  type: html
  entry: index.html
---

# 仪表盘模板

生成一个单屏管理 / 分析仪表盘。

## 工作流程

1. **确定设计令牌** —— 颜色、排版、间距、组件样式都来自此。不要发明新令牌。使用六个 `:root` 变量：`--bg`、`--surface`、`--fg`、`--muted`、`--border`、`--accent`。

2. **分类**仪表盘监控的内容（销售、流量、使用量、事件、运维等）。生成具体、合理的指标名称和数值 —— 不要 "指标 A / 指标 B" 占位符。

3. **布局**所需区域：
   - **左侧边栏**（220-260px）：顶部品牌标记，6-8 个带图标的导航链接，活跃状态使用强调色。
   - **顶部栏**：左侧页面标题，右侧搜索输入 + 用户头像 / 状态。
   - **主区域**：
     - 第 1 行：3-4 个 KPI 卡片（标签 + 大数字 + 较上期变化）。
     - 第 2 行：一个主图表（全宽或 2/3）—— 渲染为内联 SVG 折线 / 柱状 / 面积图，使用真实感数字。
     - 第 3 行：一个次图表或表格（最近事件、热门项目等）。

4. **编写**一个自包含 HTML 文档：
   - `<!doctype html>` 到 `</html>`，CSS 放在一个内联 `<style>` 块中。
   - CSS Grid 用于整体布局；Flexbox 用于卡片内部。
   - 语义化 HTML：`<aside>`、`<header>`、`<main>`、`<section>`。
   - 每个逻辑区域标记 `data-od-id="slug"`。

5. **图表**：仅内联 SVG，无 JS 库。折线图约 10 行 `<polyline>` 加微妙面积填充。柱状图是 N 个 `<rect>` 加强调色填充。轴线标签轻量化（muted 文字，更小字号）。

6. **自检**：
   - 每个颜色来自设计令牌。
   - 强调色最多用两次（侧边栏活跃 + 一个图表高亮）。
   - 侧边栏 + 顶部栏固定；主区域独立滚动。
   - 密度匹配设计氛围 —— 通风的设计用更多 padding，密集的设计（交易、加密）收紧行距。

## 设计令牌模板

```css
:root {
  --bg:      #f8f9fa;
  --surface: #ffffff;
  --fg:      #1a1916;
  --muted:   #6b6964;
  --border:  #e8e5df;
  --accent:  #c96442;
  --accent-soft: color-mix(in oklch, var(--accent) 14%, transparent);
  --font-display: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-body:    -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono:    ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace;
}
```

## 布局结构

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>[REPLACE] 仪表盘标题</title>
  <style>/* 令牌 + 布局 CSS */</style>
</head>
<body>
  <div class="app">
    <aside class="sidebar" data-od-id="sidebar">
      <!-- 品牌标记 + 导航链接 -->
    </aside>
    <div class="main-col">
      <header class="topbar" data-od-id="topbar">
        <!-- 页面标题 + 搜索 + 用户 -->
      </header>
      <main class="content" data-od-id="content">
        <!-- KPI 卡片行 → 主图表 → 次图表/表格 -->
      </main>
    </div>
  </div>
</body>
</html>
```

## KPI 卡片模式

```html
<div class="kpi-card">
  <span class="kpi-label">总营收</span>
  <span class="kpi-value num">¥128,430</span>
  <span class="kpi-delta up">↑ 12.4% 较上月</span>
</div>
```

## 内联 SVG 折线图模式

```html
<svg class="chart" viewBox="0 0 600 200" preserveAspectRatio="none">
  <polyline points="0,150 100,120 200,140 300,80 400,100 500,60 600,70"
            fill="none" stroke="var(--accent)" stroke-width="2"/>
  <polygon points="0,150 100,120 200,140 300,80 400,100 500,60 600,70 600,200 0,200"
           fill="var(--accent-soft)"/>
</svg>
```

## 自检清单

### P0 — 必须通过
- [ ] 所有颜色来自 `:root` 令牌，无原始 hex。
- [ ] 强调色最多用两次（侧边栏活跃 + 一个图表高亮）。
- [ ] 侧边栏和顶部栏固定（`position: sticky` 或 `fixed`），主区域独立滚动。
- [ ] KPI 数字使用等宽字体（`.num` 类）。
- [ ] 无占位符文案 —— 每个指标名称和数值都具体、合理。
- [ ] 图表是内联 SVG，无外部 JS 库。
- [ ] 每个主要区域有 `data-od-id`。

### P1 — 应该通过
- [ ] KPI 卡片显示变化趋势（↑/↓ + 百分比）。
- [ ] 侧边栏导航有活跃状态高亮。
- [ ] 表格/列表有悬停状态。
- [ ] 响应式：小屏下侧边栏可折叠或隐藏。

## 输出约定

将完成的 HTML 通过 `design_preview(html=...)` 预览。写完后一段简短摘要。
