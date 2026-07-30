---
name: saas-landing
description: |
  单页 SaaS 着陆页，含 Hero、特性、社会证明、定价和 CTA。
  尊重设计系统的颜色/排版/布局令牌。
  触发关键词："SaaS 着陆页"、"营销页"、"产品着陆页"。
triggers:
  - "saas landing"
  - "marketing page"
  - "product landing"
  - "SaaS 着陆页"
  - "营销页"
  - "产品着陆页"
  - "产品官网"
platform: desktop
preview:
  type: html
  entry: index.html
---

# SaaS 着陆页模板

生成一个单页 SaaS 着陆页。严格按照以下工作流程执行。

## 1. 确定设计令牌

写任何东西之前：
- 确定颜色调色板、排版令牌和布局原则。
- 使用六个 `:root` 变量：`--bg`、`--surface`、`--fg`、`--muted`、`--border`、`--accent`。
- 注意：强调色在 Hero 中用一次，在底部 CTA 中用一次，用于所有链接。不要满页使用。

## 2. 规划区块

必需区块，按顺序：
1. **Hero** —— Logo 或文字商标，标题（从 tagline 输入），副标题（1-2 句），主 CTA，次 CTA。
2. **特性** —— 3-6 个特性卡片。每个：图标、短标题、1-2 句描述。
3. **社会证明** —— Logo 墙或推荐语。如果为 0，跳过此区块。
4. **定价** —— 2-3 个档位。仅在 `has_pricing` 为 true 时包含。
5. **底部 CTA** —— 大块强调色区域，一个按钮行动号召。
6. **页脚** —— 精简：链接 + 版权。

## 3. 应用设计系统

- 所有颜色必须来自设计令牌。不要发明 hex 值。
- 排版：标题用声明的主字体，其他用正文字体。
- 布局：尊重网格、最大宽度和区块间距规则。
- 组件：使用声明的按钮/卡片/输入模式。
- 强调色：Hero 中用一次，底部 CTA 中用一次，用于所有链接。不要满页使用。

## 4. 编写文件

输出一个自包含 HTML：
- 所有 CSS 内联在 `<head>` 的 `<style>` 块中。
- 系统字体回退。
- 无外部 JS。
- 语义化 HTML（`<header>`、`<main>`、`<section>`、`<footer>`）。
- 每个可编辑元素标记 `data-od-id="<unique-slug>"`。

## 5. 设计令牌模板

```css
:root {
  --bg:      #fafaf7;
  --surface: #ffffff;
  --fg:      #1a1916;
  --muted:   #6b6964;
  --border:  #e8e5df;
  --accent:  #c96442;
  --accent-soft: color-mix(in oklch, var(--accent) 14%, transparent);
  --font-display: 'Iowan Old Style', 'Charter', Georgia, serif;
  --font-body:    -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono:    ui-monospace, 'JetBrains Mono', Menlo, monospace;
  --container: 1120px;
  --gutter: 32px;
  --radius: 10px;
  --radius-lg: 16px;
}
```

## 6. 区块结构参考

### Hero 区
```html
<section class="hero" data-od-id="hero" style="text-align:center; padding: clamp(80px,12vw,160px) 32px;">
  <div style="max-width: 32ch; margin: 0 auto;">
    <p class="eyebrow" style="font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent);">[REPLACE] 眉标</p>
    <h1 style="font-family: var(--font-display); font-size: clamp(44px,6vw,76px); line-height: 1.04; letter-spacing: -0.02em; margin: 20px 0;">[REPLACE] 一句话价值主张</h1>
    <p style="font-size: 19px; line-height: 1.55; color: var(--muted); max-width: 60ch; margin: 0 auto 32px;">[REPLACE] 具体价值的副标题</p>
    <div style="display: inline-flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
      <button style="padding: 11px 20px; border-radius: var(--radius); border: 1px solid var(--accent); background: var(--accent); color: var(--surface); font-size: 15px; font-weight: 500; cursor: pointer;">免费开始</button>
      <button style="padding: 11px 20px; border-radius: var(--radius); border: 1px solid var(--border); background: transparent; color: var(--fg); font-size: 15px; font-weight: 500; cursor: pointer;">查看演示</button>
    </div>
  </div>
</section>
```

### 特性区
```html
<section data-od-id="features" style="padding: clamp(48px,8vw,96px) 32px; border-top: 1px solid var(--border);">
  <div style="max-width: var(--container); margin: 0 auto;">
    <div style="max-width: 36ch; margin-bottom: 56px;">
      <h2 style="font-family: var(--font-display); font-size: clamp(32px,4vw,48px); letter-spacing: -0.015em; margin: 0;">[REPLACE] 你在前十分钟会注意到的三件事。</h2>
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;">
      <!-- 特性卡片 ×3-6 -->
    </div>
  </div>
</section>
```

### 定价区
```html
<section data-od-id="pricing" style="padding: clamp(48px,8vw,96px) 32px; border-top: 1px solid var(--border);">
  <div style="max-width: var(--container); margin: 0 auto; text-align: center;">
    <h2 style="font-family: var(--font-display); font-size: clamp(32px,4vw,48px); margin: 0 0 56px;">定价</h2>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: left;">
      <!-- 定价卡片 ×2-3 -->
    </div>
  </div>
</section>
```

### 底部 CTA
```html
<section data-od-id="cta" style="background: var(--accent); color: #fff; padding: clamp(64px,10vw,120px) 32px; text-align: center;">
  <h2 style="font-family: var(--font-display); font-size: clamp(32px,4vw,48px); margin: 0 0 16px;">[REPLACE] 开始使用</h2>
  <p style="font-size: 19px; opacity: 0.85; margin: 0 0 32px;">[REPLACE] 个人免费，团队 ¥28/月</p>
  <button style="padding: 14px 28px; border: 0; border-radius: var(--radius); background: #fff; color: var(--accent); font-size: 16px; font-weight: 600; cursor: pointer;">免费开始</button>
</section>
```

## 7. 自检清单

完成前验证：
- [ ] 所有文字有内容意义，不是 lorem ipsum。
- [ ] 无破损颜色引用（每个 CSS 颜色值在令牌调色板中）。
- [ ] 响应式断点有效。
- [ ] 页面在 1440w、768w 和 375w 下看起来都不错。
- [ ] 强调色总共使用不超过两次（Hero + 底部 CTA）。
- [ ] 每个主要区域有 `data-od-id`。

## 8. 完成

通过 `design_preview(html=...)` 预览生成的 HTML。不生成单独的 CSS 文件、JS 文件或 README。

写完后一段简短摘要。不多说。
