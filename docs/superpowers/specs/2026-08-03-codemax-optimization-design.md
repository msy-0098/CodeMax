# CodeMax 应用优化设计 Spec

日期：2026-08-03
范围：5 项优化 + 1 项品牌锁定（SP6）
执行结构：两阶段 —— 阶段一功能修复（SP1/SP2），阶段二 UI 重构（SP3/SP4/SP5/SP6）

---

## 背景与目标

CodeMax（原 XimoAgent，DeepSeek-V4 驱动的 AI Agent 桌面工作台）已具备基础功能，本次针对以下问题优化：

1. 中转站（聚合网关）下 GPT 系列模型无法流式输出，只能等完整结果一次性返回
2. 界面右上角模型名固定显示 DeepSeek，与实际接入的供应商/模型不匹配
3. 全应用毛玻璃（Glassmorphism）风格需替换为简约谷歌风格（Material），保留深/浅主题
4. 部分 UI 区域元素拥挤、间距不足、层次感差
5. 设置功能为弹窗形式，需重构为应用内独立设置页
6. 启动开屏品牌名需锁定为 CODEMAX（不可修改、居中显示）

约束：所有改动不得破坏现有核心功能（Agent 循环、工具系统、provider 多模型、主题切换等）；改动后需 typecheck + 单测 + 全量回归。

---

## 阶段一：功能修复

### SP1 · GPT 系列流式输出修复（聚合网关）

**现状与根因**（`src/main/deepseek/api.ts`）：

- `buildRequestBody` 无条件发送 `stream_options: { include_usage: true }`（api.ts L39）。部分聚合网关（One-API/new-api 类）对该参数兼容性差，GPT 模型请求可能 400 或服务端降级为非流式。
- 网关常把上游输出缓冲后一次性下发（单个大 SSE chunk），前端收到即全量，无逐字效果。
- SSE 解析只认 `delta.content`，对 `delta.text`、`choices[0].message.content`（非流式 JSON 响应）等变体不兼容。

**修复设计**：

1. **stream_options 兼容重试**
   - `buildRequestBody` 新增参数 `includeUsage: boolean = true`；`includeUsage === false` 时请求体不含 `stream_options`。
   - `callDeepSeekStreamOnce` 增加一次 400 重试：若响应状态 400 且错误信息匹配 `stream_options` / `include_usage` / `unknown parameter` 等关键字 → 用 `includeUsage: false` 重发一次。
   - 纯函数改造，可单测。

2. **容错 SSE 解析**
   - 统一文本抽取：`delta?.content ?? delta?.text ?? choices[0]?.message?.content ?? choices[0]?.text`。
   - 兼容 `data: [DONE]` 与 `data:[DONE]`、`\r\n` 行尾、`data:` 前缀容错。
   - 若整个响应体为非 SSE JSON（网关忽略 stream:true，返回完整 chat.completion）→ 提取 `choices[0].message.content` 作为单块发出，正常收尾。

3. **客户端打字机平滑（逐字显示核心）**
   - 渲染层新增 hook `useTypingReveal(content: string, isStreaming: boolean): string`：
     - 流式期间返回 `content.slice(0, revealedLen)`，定时器按节奏推进（约 30ms / 2~4 字符）；
     - 流式结束后立即返回完整 content；
     - 纯展示层，不改数据，对所有服务商统一生效。
   - 应用于消息内容渲染组件（MessageItem 内容区）。

**验证**：
- 单测：`buildRequestBody` includeUsage 分支；400 重试判定函数；SSE 变体解析。
- 联调（需用户提供中转站测试 Key）：选择 GPT 模型确认逐字显示。

### SP2 · 模型-供应商映射显示

**现状**（硬编码 DeepSeek 显示点）：

| 位置 | 代码 |
|---|---|
| `src/renderer/src/components/layouts/CodingLayout.tsx` L67, L149 | `modelLabel`：`model.includes('pro') ? 'DeepSeek V4-Pro' : 'V4-Flash'` |
| `src/renderer/src/components/layouts/OfficeLayout.tsx` L234 | `model.includes('pro') ? 'V4-Pro' : 'V4-Flash'` |
| `src/renderer/src/components/layouts/DesignLayout.tsx` L153 | 同上 |
| `src/renderer/src/components/MessageItem.tsx` L478 | 消息模型标签（需核对） |
| `src/renderer/src/components/coding/SessionBar.tsx` L120 | 右侧模型显示（需核对） |

**修复设计**：
- 新增共享选择器 `src/renderer/src/store/selectors.ts`：
  - `getActiveProvider(settings)`：按 `settings.activeProviderId` 从 `settings.providers` 取当前服务商；
  - `getModelLabel(settings)`：返回 `${provider.name} · ${settings.model}`（如 `OpenAI · gpt-4o`、`DeepSeek · deepseek-v4-pro`）。
- 替换上述全部硬编码点；格式统一为 `{provider.name} · {model}`。
- `AboutTab` 中 DeepSeek-V4 产品介绍文案保留（产品介绍，非当前模型标识）。

**验证**：切换不同 provider 后，三布局右上角、消息标签、SessionBar 显示与实际一致。

---

## 阶段二：UI 重构

### SP3 · 去毛玻璃 + Material 谷歌风格

**现状**：24+ 处 `backdrop-blur`/`backdrop-filter`，大量半透明表面（`bg-white/70`、`bg-black/40`）与重阴影。

**修复设计**（统一 token + 逐组件替换）：

1. **颜色令牌**（Tailwind 主题，`src/renderer/src/assets/index.css`）：

   | 令牌 | 浅色 | 深色 |
   |---|---|---|
   | surface（主表面） | `#ffffff` | `#202124` |
   | surface-elevated（次级表面） | `#f8f9fa` | `#292a2d` |
   | border（发丝线边框） | `#dadce0` | `#3c4043` |
   | text-primary | `#202124` | `#e8eaed` |
   | text-muted | `#5f6368` | `#9aa0a6` |
   | accent | `#1a73e8` | `#8ab4f8` |

2. **替换规则**：
   - 所有 `backdrop-blur-*` / `backdrop-filter` 移除；
   - 半透明表面 `bg-*/xx` → 对应纯色 token；
   - 重阴影（`shadow-glass` 等）→ 发丝线边框 + 极轻阴影（`border` + 1px）；
   - 圆角：卡片 8px，输入框/按钮 pill 18-20px。

3. **执行顺序**：token 与全局基础组件 → 各布局/组件文件替换 → Grep 全量清点 `backdrop-blur` 残留为零。

### SP4 · 布局拥挤优化

**目标清单**（逐项核对后调整）：

- `GlobalChatInput`：输入区垂直间距、工具按钮组与模型选择器间距、发送区布局；
- `TitleBar`、会话列表行距、`RightSidebar` 分区间距；
- Coding/Office/Design 三布局工具栏芯片间距与对齐；
- 统一间距节奏（`gap-2/3/4`、`px-3/4` 规范），消除重叠与顶格。

**验证**：各布局截图前后对比；无元素重叠、无过度紧凑。

### SP5 · 应用内全屏设置页

**现状**：`SettingsModal` 弹窗承载全部设置 Tab。

**修复设计**：
- 渲染层视图切换：store 新增 `ui.view: 'main' | 'settings'`（`src/renderer/src/store/uiSlice.ts` 或 App.tsx 状态）；
- 设置页骨架：左侧固定分类导航（通用 / 模型与推理 / 外观 / 工具 / Agent / 关于），右侧内容面板（Chrome/Gmail 布局），Material 风格；
- 复用现有 Tab 组件（ModelTab / ApiTab / AppearanceTab / ToolsTab / AgentTab / AboutTab），保留组件文件，重排页面骨架与配色；
- 入口：TitleBar 齿轮按钮；返回：左上角返回按钮回主界面；
- 主题切换平滑：根容器 `transition-colors duration-200`，确认浅/深切换无闪烁。

**验证**：打开/关闭设置页、切换分类、主题切换正常，与主界面风格一致。

### SP6 · 启动品牌锁定 CODEMAX

**现状**：
- `settings.startupText`（默认 `'CodeMax'`）可编辑，入口在 `AppearanceTab`「开屏文字」输入框；
- `StartupAnimation` 读取 `config?.startupText`，容器 flex 居中。

**修复设计**：
- 开屏文字固定为 `'CODEMAX'`（`StartupAnimation` 忽略配置直接使用常量，不再读取 `startupText`）；
- 移除 `AppearanceTab` 中「开屏文字」输入框（含相关 `update({ startupText })` 逻辑）；
- 保留其余开屏配置（大小/描边时长/转场样式等）可编辑；
- 确认开屏文字居中显示（容器 flex `items-center justify-center`，SVG 视口不变）。
- `settings.startupText` 字段保留在类型中（旧数据兼容），默认值同步更新为 `'CODEMAX'`，但不再被读取、不再暴露 UI。
- 其余位置的品牌拼写（TitleBar「CodeMax 任务状态」、AboutTab 标题、MessageItem 标签等）本次**保持 `CodeMax`** 不变，仅锁定开屏文字为 `CODEMAX`。

**验证**：重启应用，开屏显示居中的 CODEMAX；设置页外观分类无「开屏文字」输入框。

---

## 阶段边界与验证流程

1. 阶段一完成 → `npm run typecheck` + 单测 → 用户验证 GPT 流式（提供中转站 Key）
2. 阶段二完成 → typecheck + `npm run build` + 全量回归（三布局、主题切换、设置页、开屏动画、对话/工具流）

## 明确不做（Out of Scope）

- BPE 分词器、tokenizer.json 不改动
- DeepSeek/Agnes 之外的视觉模型不改动
- 自动更新逻辑、打包配置不改动
- 消息存储结构 / IPC 协议不改动（SP1 打字机为纯展示层）
