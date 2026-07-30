# 移动应用布局库

**6 个可直接粘贴的界面原型。** 放入 `assets/template.html` 的 `<main class="content">` 中。不要从零写界面 —— 选最接近的原型，粘贴，替换文案。

## 预检

1. **通读 `assets/template.html`** 至少读完 `<style>` 块 —— 下面用到的每个类都在那里定义。灵动岛、状态栏、Home 指示器和标签栏已绘制；不要内联重新实现。
2. **选择恰好一个原型。** 移动界面只做一件事。混合"feed + 结算 + 个人资料"是移动原型感觉假的头号原因。
3. **如果原型暗示有标签栏，保留它；否则删除整个 `<nav class="tabbar">` 块。** Onboarding、Detail 和 Checkout 界面通常不显示标签栏。

## 类清单

> `pad` `stack` `row` `row-between` `grid-2` `grid-3` `header` `greeting` `h2` `h3` `meta` `num` `card` `card.accent` `card.flat` `list-row` `avatar` `tag` `pill` `tabbar` `tab` `tab.active` `btn-primary` `btn-secondary` `ph-img` `progress`

如果用了不在列表中的类，先在种子的 `<style>` 中定义。

---

## 原型 A — Feed（首页 / 推荐 / 收件箱）

顶部：问候 + 标题。主体：4-6 个列表行，细线分隔。标签栏：有。

```html
<div class="header" data-od-id="header">
  <div>
    <p class="greeting">星期二 · 4月22日</p>
    <h1>收件箱</h1>
  </div>
  <button class="icon-btn" aria-label="撰写">
    <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
  </button>
</div>

<section class="pad" data-od-id="filters" style="margin-bottom: 8px;">
  <div class="row" style="overflow-x: auto; padding-bottom: 4px;">
    <span class="pill">全部 · 14</span>
    <span class="tag">提及</span>
    <span class="tag">关注</span>
    <span class="tag">分享</span>
  </div>
</section>

<section class="pad" data-od-id="feed">
  <div class="list-row">
    <div class="avatar"></div>
    <div class="body">
      <div class="title">张明 · 同步引擎 v3 审查</div>
      <div class="sub">"合并了分块器 —— 出口流量降了 38%。"</div>
    </div>
    <span class="meta">2分钟</span>
  </div>
  <div class="list-row">
    <div class="avatar"></div>
    <div class="body">
      <div class="title">#工程频道 · 7 条新回复</div>
      <div class="sub">03:40 到 04:10 之间的延迟峰值 —— 可能是定时任务。</div>
    </div>
    <span class="meta">14分钟</span>
  </div>
  <div class="list-row">
    <div class="avatar"></div>
    <div class="body">
      <div class="title">某科技公司 · 发票已支付</div>
      <div class="sub">¥15,288 · 4月 · 自动收据已发送至 billing@</div>
    </div>
    <span class="meta">1小时</span>
  </div>
  <div class="list-row">
    <div class="avatar"></div>
    <div class="body">
      <div class="title">李华 · 回复：下周二的审查</div>
      <div class="sub">"我会在周一下班前给出 Q2 数据。"</div>
    </div>
    <span class="meta">3小时</span>
  </div>
</section>
```

## 原型 B — Detail（单条目）

顶部 Hero 图片，眉标 + 标题 + 元信息，正文，底部浮动主操作。标签栏：无。

```html
<div class="ph-img wide" style="border-radius: 0; aspect-ratio: 4/3;" data-od-id="hero">[ Hero 图片 ]</div>

<section class="pad" style="padding-top: 18px;" data-od-id="meta">
  <span class="pill">工作室记录</span>
  <h1 class="h2" style="margin: 10px 0 6px;">Filebase v3 —— 我们发布了什么，砍掉了什么。</h1>
  <p class="meta">张明 · 4月22日 · 9 分钟阅读</p>
</section>

<section class="pad stack" style="margin-top: 18px; gap: 14px;" data-od-id="body">
  <p>v3 最大的突破是新的内容定义分块器。在 Final Cut 项目上，编辑后重新上传减少了 38 倍 —— 从完整多 GB 推送到实际变更的几百 KB。</p>
  <p>砍掉的：文件夹级压缩。基准测试上看起来很棒；在真实素材上比不压缩还慢，因为分块器已经在做去重了。</p>
  <p>下季度：R2 + S3 双区域复制，先推企业版。</p>
</section>

<section class="pad" style="padding-top: 24px; padding-bottom: 8px;" data-od-id="cta">
  <button class="btn-primary">保存到收藏</button>
</section>
```

## 原型 C — Onboarding（1/N 步）

插图块 + 标题 + 副标题 + 分页器 + 主 CTA。标签栏：无。状态栏仍可见。

```html
<section class="pad stack" style="height: 100%; padding-top: 24px; padding-bottom: 24px; gap: 24px;" data-od-id="onboarding">
  <div class="ph-img square" style="aspect-ratio: 1/1; max-width: 240px; margin: 0 auto;">[ 插图 ]</div>

  <div style="text-align: center;">
    <p class="meta" style="margin: 0 0 6px;">第 2 步，共 4 步</p>
    <h1 style="font-family: var(--font-display); font-size: 26px; margin: 0 0 10px; letter-spacing: -0.02em; line-height: 1.15;">只同步变更的部分。</h1>
    <p style="margin: 0 auto; max-width: 26ch; color: var(--muted); font-size: 14px; line-height: 1.5;">修复一帧不再重新上传 4 GB。我们按字节级差异比较，让网络保持安静。</p>
  </div>

  <!-- 分页圆点 -->
  <div class="row" style="justify-content: center; gap: 6px;">
    <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--border);"></span>
    <span style="width: 18px; height: 6px; border-radius: 999px; background: var(--accent);"></span>
    <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--border);"></span>
    <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--border);"></span>
  </div>

  <div class="stack" style="gap: 10px; margin-top: auto;">
    <button class="btn-primary">继续</button>
    <button class="btn-secondary" style="border: 0; color: var(--muted);">跳过</button>
  </div>
</section>
```

> 此原型需删除种子中的 `<nav class="tabbar">` 块。

## 原型 D — Profile（个人页）

头像 + 姓名 + 元信息行；统计行；下方标签内容。标签栏：有。

```html
<section class="pad" style="padding-top: 8px;" data-od-id="head">
  <div class="row" style="gap: 16px;">
    <div class="avatar" style="width: 64px; height: 64px;"></div>
    <div>
      <h1 class="h2" style="margin: 0;">张明</h1>
      <p class="meta" style="margin: 4px 0 0;">CTO · 某科技公司 · 2024年加入</p>
    </div>
  </div>
  <div class="row" style="margin-top: 16px; gap: 8px;">
    <button class="btn-secondary" style="flex: 1; min-height: 38px; font-size: 13px;">私信</button>
    <button class="btn-secondary" style="flex: 1; min-height: 38px; font-size: 13px;">关注</button>
  </div>
</section>

<section class="pad" data-od-id="stats" style="margin-top: 18px;">
  <div class="grid-3">
    <div class="card flat" style="text-align: center;">
      <div class="num" style="font-size: 22px; letter-spacing: -0.02em;">218</div>
      <div class="meta">帖子</div>
    </div>
    <div class="card flat" style="text-align: center;">
      <div class="num" style="font-size: 22px; letter-spacing: -0.02em;">3.1k</div>
      <div class="meta">粉丝</div>
    </div>
    <div class="card flat" style="text-align: center;">
      <div class="num" style="font-size: 22px; letter-spacing: -0.02em;">142</div>
      <div class="meta">关注</div>
    </div>
  </div>
</section>

<section class="pad" data-od-id="tabs" style="margin-top: 12px;">
  <div class="row" style="border-bottom: 1px solid var(--border); gap: 24px;">
    <span style="padding: 12px 0; border-bottom: 2px solid var(--accent); color: var(--fg); font-weight: 500; font-size: 14px;">帖子</span>
    <span style="padding: 12px 0; color: var(--muted); font-size: 14px;">回复</span>
    <span style="padding: 12px 0; color: var(--muted); font-size: 14px;">点赞</span>
  </div>
</section>

<section class="pad" data-od-id="post-list" style="margin-top: 4px;">
  <div class="list-row" style="grid-template-columns: 1fr;">
    <div class="body">
      <div class="title">"带宽价格涨了 4 倍 —— 同步引擎选择不再是装饰性的。"</div>
      <div class="sub" style="margin-top: 6px;">2 天前 · 142 赞</div>
    </div>
  </div>
  <div class="list-row" style="grid-template-columns: 1fr;">
    <div class="body">
      <div class="title">"今天发布了 v3。团队扛住了这一个。"</div>
      <div class="sub" style="margin-top: 6px;">5 天前 · 88 赞</div>
    </div>
  </div>
</section>
```

## 原型 E — Checkout / 表单

堆叠卡片区域（商品摘要 → 详情 → 合计），底部固定 CTA。标签栏：无。

```html
<section class="pad" style="padding-top: 12px;" data-od-id="title">
  <h1 class="h2">确认订单</h1>
</section>

<section class="pad" data-od-id="item">
  <div class="card row" style="gap: 14px; align-items: flex-start;">
    <div class="ph-img square" style="width: 64px; height: 64px; aspect-ratio: 1; border-radius: 10px;"></div>
    <div style="flex: 1;">
      <div class="h3">Filebase 团队版 · 年付</div>
      <p class="meta" style="margin: 4px 0 0;">¥28 / 席位 / 月，按年计费</p>
    </div>
    <span class="num">¥13,440</span>
  </div>
</section>

<section class="pad stack" data-od-id="details" style="margin-top: 14px; gap: 10px;">
  <div class="card flat row-between">
    <span>席位</span>
    <span class="num">40</span>
  </div>
  <div class="card flat row-between">
    <span>计费邮箱</span>
    <span class="meta">billing@company.com</span>
  </div>
  <div class="card flat row-between">
    <span>支付方式</span>
    <span class="meta">Visa · 4242</span>
  </div>
</section>

<section class="pad" data-od-id="totals" style="margin-top: 14px;">
  <div class="card row-between" style="border-top: 1px solid var(--fg); border-radius: 0; padding: 16px 0; background: transparent;">
    <span style="font-weight: 600;">今日合计</span>
    <span class="num" style="font-size: 22px; letter-spacing: -0.01em;">¥13,440</span>
  </div>
</section>

<section class="pad" style="padding-top: 16px; padding-bottom: 12px;" data-od-id="cta">
  <button class="btn-primary">支付 ¥13,440</button>
  <p class="meta" style="text-align: center; margin: 12px 0 0;">点击支付即表示同意服务条款。</p>
</section>
```

## 原型 F — Focus / Hero 卡片（计时器、地图、单工具）

一张强调色 Hero 卡片占主导；下方小辅助内容。标签栏：有。

```html
<div class="header" data-od-id="header">
  <div>
    <p class="greeting">星期二 · 4月22日</p>
    <h1>距午餐还有两个番茄钟。</h1>
  </div>
  <button class="icon-btn" aria-label="设置">
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="3" r="0.5"/><circle cx="12" cy="21" r="0.5"/><circle cx="3" cy="12" r="0.5"/><circle cx="21" cy="12" r="0.5"/></svg>
  </button>
</div>

<section class="pad" data-od-id="hero-card" style="margin-top: 4px;">
  <div class="card accent" style="padding: 28px 24px; text-align: center;">
    <p class="meta" style="margin: 0 0 6px; color: rgba(255,255,255,0.72);">专注会话</p>
    <div class="num" style="font-size: 64px; line-height: 1; letter-spacing: -0.03em; font-weight: 600; margin: 8px 0 18px;">15:42</div>
    <div class="progress" style="margin-bottom: 18px;"><span style="width: 38%;"></span></div>
    <div class="row" style="justify-content: center; gap: 8px;">
      <button style="padding: 10px 22px; border: 1px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.12); color: #fff; border-radius: 999px; font: inherit; font-weight: 500;">跳过</button>
      <button style="padding: 10px 22px; border: 0; background: #fff; color: var(--accent); border-radius: 999px; font: inherit; font-weight: 600;">暂停</button>
    </div>
  </div>
</section>

<section class="pad" data-od-id="stats-row" style="margin-top: 18px;">
  <p class="meta" style="margin: 0 0 8px;">今日</p>
  <div class="grid-3">
    <div class="card"><div class="num" style="font-size: 22px;">3</div><div class="meta">会话</div></div>
    <div class="card"><div class="num" style="font-size: 22px;">75m</div><div class="meta">专注</div></div>
    <div class="card"><div class="num" style="font-size: 22px;">2</div><div class="meta">完成</div></div>
  </div>
</section>

<section class="pad" data-od-id="up-next" style="margin-top: 18px;">
  <p class="meta" style="margin: 0 0 8px;">接下来</p>
  <div>
    <div class="list-row" style="grid-template-columns: 22px 1fr auto;">
      <span style="width: 18px; height: 18px; border-radius: 50%; background: var(--accent);"></span>
      <div class="body">
        <div class="title" style="text-decoration: line-through; color: var(--muted);">审查 Q2 OKR</div>
        <div class="sub">25分钟 · 已完成</div>
      </div>
    </div>
    <div class="list-row" style="grid-template-columns: 22px 1fr auto;">
      <span style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--border);"></span>
      <div class="body">
        <div class="title">撰写同步引擎文章</div>
        <div class="sub">预计 2 个会话</div>
      </div>
    </div>
  </div>
</section>
```

---

## 从需求选择原型

| 需求提到… | 使用 |
|---|---|
| feed、收件箱、时间线、列表、消息 | A — Feed |
| 文章、帖子、条目、菜谱、歌曲、产品 | B — Detail |
| 注册、欢迎、介绍、引导 | C — Onboarding |
| 个人资料、账户、用户页、简介 | D — Profile |
| 结算、支付、订单、表单、设置步骤 | E — Checkout |
| 计时器、地图、仪表盘小部件、单个大数字 | F — Focus |

如果两个都匹配，选更符合用户在此界面上*主要*操作的那个。
