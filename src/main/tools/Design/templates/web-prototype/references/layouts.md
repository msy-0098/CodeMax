# Web 原型布局库

**8 个可直接粘贴的区块骨架。** 放入 `assets/template.html` 的 `<main id="content">` 中。不要从零写区块 —— 选最接近的布局，粘贴，替换文案。

## 预检（粘贴前做一次）

1. **通读 `assets/template.html`** 至少读完 `<style>` 块。下面用到的每个类都必须在那里存在。如果缺少，在 `<style>` 中添加，而不是在每个区块内联。
2. **先选区块列表再写文案。** 默认节奏：
   - **着陆页**: 1 hero → 2 features → 3 stat-row 或 quote → 4 split → 6 cta-strip → footer
   - **营销/编辑**: 1 hero-center → 7 log-list → 4 split → 6 cta-strip
   - **定价/文档**: 1 hero-center → table-driven → 6 cta-strip
3. **每屏一个强调色，最多用两次。** Hero 眉标和主按钮已经用了；第三处要谨慎。

## 类清单（必须在 `template.html` 中存在）

> `section` `container` `hero` `hero-center` `hero-split` `hero-cta` `eyebrow` `lead` `h1` `h2` `h3` `meta` `num` `btn` `btn-primary` `btn-secondary` `btn-ghost` `btn-arrow` `card` `card-flat` `card-rule` `feature` `feature-mark` `stat` `stat-num` `stat-label` `stat-unit` `quote` `quote-mark` `quote-author` `pill` `tag` `field` `input` `textarea` `ds-table` `num-col` `ph-img` `square` `portrait` `wide` `rule` `rule-strong` `grid-2` `grid-3` `grid-4` `grid-2-1` `grid-1-2` `row` `row-between` `stack` `log-row` `pull` `topnav` `pagefoot`

如果用了不在列表中的类，先在 `<style>` 中定义，或用 `style="…"` 内联。不要在 `<section>` 上发明没有 CSS 支撑的全局类。

---

## 布局 1 — Hero，居中

页面以一个论点句开头时使用（大多数着陆页、营销页）。一个眉标，一个 h1（≤14字），一句引导语，两个 CTA。

```html
<section class="section hero" data-od-id="hero">
  <div class="container hero-center">
    <p class="eyebrow">眉标 · 上下文</p>
    <h1>一句话说明这是什么。</h1>
    <p class="lead">一句具体价值的副标题 —— 读者会得到什么改变。</p>
    <div class="hero-cta">
      <button class="btn btn-primary">主要操作</button>
      <button class="btn btn-secondary">次要</button>
    </div>
  </div>
</section>
```

## 布局 2 — Hero，分栏（文字 + 视觉）

有真实产品视觉时使用（产品 UI、截图、照片）。左半边文案，右半边 `ph-img` 占位符。

```html
<section class="section" data-od-id="hero-split">
  <div class="container hero-split">
    <div>
      <p class="eyebrow">眉标 · 角色</p>
      <h1>点明变化的标题。</h1>
      <p class="lead" style="margin-top: 20px;">简短副标题 —— 具体的，不是套话。最多两句。</p>
      <div class="hero-cta" style="margin-top: 28px;">
        <button class="btn btn-primary">主要操作</button>
        <button class="btn btn-ghost btn-arrow">阅读故事</button>
      </div>
    </div>
    <div class="ph-img wide" aria-label="Hero 视觉占位符">[ Hero 视觉 · 16:9 ]</div>
  </div>
</section>
```

## 布局 3 — 特性三联

三个特性单元格。以一个小 `<h2>` 框定这行。不要每个标题都放图标 —— 每个单元格一个精致的标记，单线。

```html
<section class="section" data-od-id="features">
  <div class="container stack" style="gap: 56px;">
    <div style="max-width: 36ch;">
      <p class="eyebrow">不同之处</p>
      <h2>你在前十分钟会注意到的三件事。</h2>
    </div>
    <div class="grid-3">
      <div class="feature card-flat">
        <div class="feature-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18M3 12h18"/></svg>
        </div>
        <h3>具体特性一</h3>
        <p>两句话描述用户价值，不是技术。</p>
      </div>
      <div class="feature card-flat">
        <div class="feature-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
        </div>
        <h3>具体特性二</h3>
        <p>两句话描述用户价值，不是技术。</p>
      </div>
      <div class="feature card-flat">
        <div class="feature-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M4 12h10M4 17h16"/></svg>
        </div>
        <h3>具体特性三</h3>
        <p>两句话描述用户价值，不是技术。</p>
      </div>
    </div>
  </div>
</section>
```

## 布局 4 — 统计行（数据看板）

有真实数字时使用。最多三个统计 —— 四个就像宣传册了。**不要编造指标。** 如果没有数字，用别的布局。

```html
<section class="section" data-od-id="stats">
  <div class="container">
    <p class="eyebrow" style="margin-bottom: 40px;">数据 · 2026</p>
    <div class="grid-3">
      <div class="stat">
        <div class="stat-num num">38<span class="stat-unit">×</span></div>
        <p class="stat-label">在真实客户负载下，线上传输数据量减少。</p>
      </div>
      <div class="stat">
        <div class="stat-num num">3,184</div>
        <p class="stat-label">付费团队，包括 YC W26 批次的 14 个。</p>
      </div>
      <div class="stat">
        <div class="stat-num num">¥0.28<span class="stat-unit">/GB</span></div>
        <p class="stat-label">平均出口流量节省 —— 典型月费从 ¥12,800 降到 ¥1,400。</p>
      </div>
    </div>
  </div>
</section>
```

## 布局 5 — 推荐引言

一条有归属的决定性引言。谨慎使用 —— 每页一条，绝不连续两条。

```html
<section class="section" data-od-id="quote">
  <div class="container" style="max-width: 800px;">
    <div class="quote-mark">"</div>
    <blockquote class="quote">第一个月就回本了。我们本来要招一个专职 DevOps 来盯同步 —— 现在直接切换了。</blockquote>
    <p class="quote-author">— 张明，某科技公司 CTO</p>
  </div>
</section>
```

## 布局 6 — CTA 条（收尾）

以一个决定性的行动号召结束页面。居中，充裕留白，一个主按钮。除非页面没有其他按钮，否则不要次要按钮。

```html
<section class="section" data-od-id="cta-strip" style="text-align: center;">
  <div class="container" style="max-width: 600px;">
    <h2>别再量化会议了。开始量化专注。</h2>
    <p class="lead" style="margin: 16px auto 32px;">个人免费。团队成员 ¥28/月。</p>
    <button class="btn btn-primary">免费开始</button>
  </div>
</section>
```

## 布局 7 — 日志列表（更新日志 / 博客索引 / 文章列表）

带日期条目的编辑布局。日期在左侧等宽字体，标题+摘要居中，右侧可选拉取统计。用上边框，不用框 —— 框感觉像宣传册。

```html
<section class="section" data-od-id="log">
  <div class="container">
    <div class="row-between" style="margin-bottom: 32px;">
      <h2>最近更新</h2>
      <a class="btn btn-ghost btn-arrow" href="#">查看全部</a>
    </div>
    <div>
      <article class="log-row">
        <span class="meta">2026-04-27</span>
        <div>
          <h3>同步引擎 v3 —— 线上传输量减半</h3>
          <p style="margin: 4px 0 0; color: var(--muted); font-size: 14px;">新的内容定义分块器在 Final Cut 项目上减少 38× 的编辑后变更。</p>
        </div>
        <span class="pull meta">工程</span>
      </article>
      <article class="log-row">
        <span class="meta">2026-04-19</span>
        <div>
          <h3>文件夹级带宽预算</h3>
          <p style="margin: 4px 0 0; color: var(--muted); font-size: 14px;">限制单个项目每月拉取量 —— 对归档文件夹有用。</p>
        </div>
        <span class="pull meta">产品</span>
      </article>
      <article class="log-row">
        <span class="meta">2026-04-04</span>
        <div>
          <h3>S3 + R2 双区域复制</h3>
          <p style="margin: 4px 0 0; color: var(--muted); font-size: 14px;">两个供应商，自动故障转移。目前仅限企业版。</p>
        </div>
        <span class="pull meta">基建</span>
      </article>
    </div>
  </div>
</section>
```

## 布局 8 — 对比表格（定价、方案矩阵、前后对比）

细线边框，等宽数字，一列通过强调色边框高亮。不要把整行放在表面色 —— 那太"表格"了。

```html
<section class="section" data-od-id="pricing">
  <div class="container">
    <div style="text-align: center; max-width: 36ch; margin: 0 auto 56px;">
      <p class="eyebrow">定价</p>
      <h2>一行功能。三行定价。</h2>
    </div>
    <table class="ds-table">
      <thead>
        <tr>
          <th>功能</th>
          <th class="num-col">个人</th>
          <th class="num-col">团队</th>
          <th class="num-col">企业</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>同步引擎 v3</td><td class="num-col">✓</td><td class="num-col">✓</td><td class="num-col">✓</td></tr>
        <tr><td>文件夹预算</td><td class="num-col">—</td><td class="num-col">✓</td><td class="num-col">✓</td></tr>
        <tr><td>SAML / SCIM</td><td class="num-col">—</td><td class="num-col">—</td><td class="num-col">✓</td></tr>
        <tr><td>专属基础设施</td><td class="num-col">—</td><td class="num-col">—</td><td class="num-col">✓</td></tr>
        <tr style="border-top: 1px solid var(--fg);">
          <td><strong>月费</strong></td>
          <td class="num-col"><strong>¥0</strong></td>
          <td class="num-col"><strong>¥28 / 席位</strong></td>
          <td class="num-col"><strong>联系销售</strong></td>
        </tr>
      </tbody>
    </table>
  </div>
</section>
```

---

## 区块节奏 —— 拿不准时

5 区块着陆页：
1. Hero（布局 1 或 2）
2. 特性（布局 3）
3. 统计 或 引言（布局 4 或 5）
4. 分栏详情（自定义，用 `grid-2-1` / `grid-1-2`）
5. CTA + 页脚（布局 6）

4 区块文档/营销索引：
1. Hero 居中（布局 1）
2. 日志列表（布局 7）
3. CTA + 页脚（布局 6）

连续两个统计行、连续两个引言块、连续两个特性三联 —— 都是视觉疲劳。交替使用。
