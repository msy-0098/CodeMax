# CodeMax 应用优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复中转站 GPT 流式输出、修正模型-供应商映射显示，并将全应用 UI 从毛玻璃重构为 Material 谷歌风格（含独立设置页与 CODEMAX 品牌锁定）。

**Architecture:** 两阶段执行。阶段一为功能修复（`src/main/deepseek/` 流式链路 + 新增共享选择器），全部可单测；阶段二为 UI 重构（主题 token 化去毛玻璃、全屏设置页、开屏品牌锁定），以 typecheck/build/grep 验证。核心原则：打字机平滑为纯展示层，不碰数据与 IPC 协议。

**Tech Stack:** Electron 33 + React 18 + Zustand + Tailwind 3 + TypeScript + Vitest（node 环境，仅测纯逻辑）。

**Spec:** `docs/superpowers/specs/2026-08-03-codemax-optimization-design.md`

**验证命令：** `npm run typecheck`、`npm run test`、`npm run build`、`grep -rn "backdrop-blur" src/renderer/src`（排除 `.json` 数据文件后应为 0）

---

## 阶段一：功能修复

### Task 1: `buildRequestBody` 增加 `includeUsage` 参数

**Files:**
- Modify: `src/main/deepseek/api.ts:20-61`
- Test: `tests/unit/api-body.test.ts`

- [ ] **Step 1: 写失败测试** — 在 `tests/unit/api-body.test.ts` 追加：

```ts
it('includeUsage=false 时不发送 stream_options', () => {
  const body = buildRequestBody({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'hi' }],
    tools: undefined,
    thinkingMode: false,
    reasoningEffort: 'medium',
    supportsThinking: false,
    temperature: 0.7,
    maxTokens: 4096,
    includeUsage: false
  })
  expect(body.stream_options).toBeUndefined()
})

it('includeUsage 默认发送 stream_options', () => {
  const body = buildRequestBody({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'hi' }],
    tools: undefined,
    thinkingMode: false,
    reasoningEffort: 'medium',
    supportsThinking: false,
    temperature: 0.7,
    maxTokens: 4096
  })
  expect(body.stream_options).toEqual({ include_usage: true })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/api-body.test.ts`
Expected: 编译失败（`includeUsage` 不在 `RequestBodyParams` 中）

- [ ] **Step 3: 实现** — 修改 `src/main/deepseek/api.ts`：

`RequestBodyParams` 接口追加 `includeUsage?: boolean`；`buildRequestBody` 解构加 `includeUsage = true`；请求体改为：

```ts
const body: Record<string, unknown> = {
  model,
  messages,
  stream: true,
  max_tokens: maxTokens
}
if (includeUsage) body.stream_options = { include_usage: true }
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/api-body.test.ts`
Expected: PASS（新增 2 条 + 原有用例全绿）

- [ ] **Step 5: Commit**

```bash
git add src/main/deepseek/api.ts tests/unit/api-body.test.ts
git commit -m "feat: buildRequestBody 支持 includeUsage 开关"
```

### Task 2: 容错 SSE 解析器 `stream-parse.ts`（含非流式 JSON 兜底）

**Files:**
- Create: `src/main/deepseek/stream-parse.ts`
- Modify: `src/main/deepseek/api.ts:173-237`
- Test: `tests/unit/stream-parse.test.ts`

- [ ] **Step 1: 写失败测试** — 新建 `tests/unit/stream-parse.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { parseStreamChunk } from '../../src/main/deepseek/stream-parse'

describe('parseStreamChunk 容错解析', () => {
  it('标准 OpenAI delta.content', () => {
    const r = parseStreamChunk({ choices: [{ delta: { content: '你' }, finish_reason: null }] })
    expect(r?.content).toBe('你')
  })

  it('delta.text 变体（部分网关）', () => {
    const r = parseStreamChunk({ choices: [{ delta: { text: '好' } }] })
    expect(r?.content).toBe('好')
  })

  it('非流式完整 JSON（网关忽略 stream）', () => {
    const r = parseStreamChunk({ choices: [{ message: { content: '完整回答' }, finish_reason: 'stop' }] })
    expect(r?.content).toBe('完整回答')
    expect(r?.finishReason).toBe('stop')
  })

  it('choices[0].text 变体', () => {
    const r = parseStreamChunk({ choices: [{ text: '变体' }] })
    expect(r?.content).toBe('变体')
  })

  it('usage-only chunk 返回 usage', () => {
    const r = parseStreamChunk({ usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } })
    expect(r?.usage).toBeDefined()
    expect(r?.content).toBeUndefined()
  })

  it('reasoning_content 思考链', () => {
    const r = parseStreamChunk({ choices: [{ delta: { reasoning_content: '思考中' } }] })
    expect(r?.reasoningContent).toBe('思考中')
  })

  it('tool_calls 增量透传', () => {
    const r = parseStreamChunk({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'f', arguments: '{}' } }] } }] })
    expect(r?.toolCalls).toHaveLength(1)
    expect(r?.toolCalls?.[0]?.index).toBe(0)
  })

  it('非法 JSON 返回 null', () => {
    expect(parseStreamChunk('not-json')).toBeNull()
    expect(parseStreamChunk(null)).toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/stream-parse.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现** — 新建 `src/main/deepseek/stream-parse.ts`：

```ts
/** 单个 SSE chunk 解析出的内容（纯函数，便于单测） */
export interface ParsedChunk {
  content?: string
  reasoningContent?: string
  toolCalls?: { index: number; id?: string; name?: string; arguments?: string }[]
  finishReason?: string
  usage?: unknown
}

export function parseStreamChunk(json: unknown): ParsedChunk | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const j = json as Record<string, unknown>
  const choices = j.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    if (j.usage) return { usage: j.usage }
    return null
  }
  const choice = choices[0] as Record<string, unknown>
  const delta = (choice.delta ?? choice.message) as Record<string, unknown> | undefined
  const out: ParsedChunk = {}
  if (delta && typeof delta === 'object') {
    const content = delta.content ?? delta.text
    if (typeof content === 'string' && content) out.content = content
    const rc = delta.reasoning_content
    if (typeof rc === 'string' && rc) out.reasoningContent = rc
    if (Array.isArray(delta.tool_calls)) {
      out.toolCalls = delta.tool_calls.map((tc) => {
        const t = tc as Record<string, unknown>
        const fn = (t.function ?? {}) as Record<string, unknown>
        return {
          index: typeof t.index === 'number' ? t.index : 0,
          id: typeof t.id === 'string' ? t.id : undefined,
          name: typeof fn.name === 'string' ? fn.name : undefined,
          arguments: typeof fn.arguments === 'string' ? fn.arguments : undefined
        }
      })
    }
  }
  // 非流式完整响应：choices[0].text 或 choices[0].message.content
  if (!out.content) {
    const alt = choice.text ?? (choice.message as Record<string, unknown> | undefined)?.content
    if (typeof alt === 'string' && alt) out.content = alt
  }
  if (typeof choice.finish_reason === 'string') out.finishReason = choice.finish_reason
  if (j.usage) out.usage = j.usage
  return out
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/stream-parse.test.ts`
Expected: PASS（8 条）

- [ ] **Step 5: 接入 api.ts 流循环** — 替换 `api.ts:173-237` 内联解析块，改为：

```ts
try {
  const parsed = parseStreamChunk(JSON.parse(data))
  if (!parsed) continue

  // 文本内容
  if (parsed.content) {
    content += parsed.content
    emittedRef.value = true
    onChunk({ content: parsed.content })
  }
  // 思考链
  if (parsed.reasoningContent) {
    reasoningContent += parsed.reasoningContent
    emittedRef.value = true
    onChunk({ reasoningContent: parsed.reasoningContent })
  }
  // 工具调用增量（流式累积）
  if (parsed.toolCalls) {
    emittedRef.value = true
    for (const tc of parsed.toolCalls) {
      const idx = tc.index ?? 0
      if (!toolCallsAcc.has(idx)) {
        toolCallsAcc.set(idx, { id: tc.id ?? '', name: '', arguments: '' })
      }
      const acc = toolCallsAcc.get(idx)!
      if (tc.id) acc.id = tc.id
      if (tc.name) acc.name += tc.name
      if (tc.arguments) acc.arguments += tc.arguments
    }
  }
  // usage
  if (parsed.usage) {
    normalizedUsage = normaliseUsage(parsed.usage)
    onChunk({ usage: { promptTokens: normalizedUsage.promptTokens, completionTokens: normalizedUsage.completionTokens, totalTokens: normalizedUsage.totalTokens, promptCacheHitTokens: normalizedUsage.cacheHitTokens, promptCacheMissTokens: normalizedUsage.cacheMissTokens } })
  }
  // finish_reason
  if (parsed.finishReason) {
    const fr = parsed.finishReason
    const tcArray = collectToolCalls(toolCallsAcc)
    if (fr === 'tool_calls' || tcArray.length > 0) {
      return { finishReason: 'tool_calls', content, reasoningContent, toolCalls: tcArray, usage: normalizedUsage, emitted: emittedRef.value }
    }
    if (fr === 'stop') {
      return { finishReason: 'stop', content, reasoningContent, toolCalls: [], usage: normalizedUsage, emitted: emittedRef.value }
    }
    if (fr === 'length') {
      return { finishReason: 'length', content, reasoningContent, toolCalls: [], usage: normalizedUsage, emitted: emittedRef.value }
    }
  }
} catch {
  // 不完整的 JSON，跳过
}
```

在文件顶部加 `import { parseStreamChunk } from './stream-parse'`。

- [ ] **Step 6: 非流式 JSON 兜底** — 流循环结束处（`api.ts:240-245` 流自然结束分支）前追加剩余缓冲解析：

```ts
// 网关忽略 stream 时，剩余 buffer 可能是完整 JSON
if (!content && buffer.trim()) {
  try {
    const parsed = parseStreamChunk(JSON.parse(buffer.trim()))
    if (parsed?.content) {
      content += parsed.content
      emittedRef.value = true
      onChunk({ content: parsed.content })
    }
  } catch { /* ignore */ }
}
```

- [ ] **Step 7: 回归测试 + 提交**

Run: `npx vitest run tests/unit/stream-parse.test.ts tests/unit/api-body.test.ts && npm run typecheck`
Expected: 全绿 + typecheck 通过

```bash
git add src/main/deepseek/stream-parse.ts src/main/deepseek/api.ts tests/unit/stream-parse.test.ts
git commit -m "feat: 容错 SSE 解析器，兼容非流式 JSON 与网关变体"
```

### Task 3: `stream_options` 400 兼容重试

**Files:**
- Modify: `src/main/deepseek/api.ts:125-133`（!response.ok 分支）
- Modify: `src/main/deepseek/stream-parse.ts`
- Test: `tests/unit/stream-parse.test.ts`

- [ ] **Step 1: 写失败测试** — `tests/unit/stream-parse.test.ts` 追加：

```ts
import { shouldRetryWithoutStreamOptions } from '../../src/main/deepseek/stream-parse'

describe('shouldRetryWithoutStreamOptions', () => {
  it('400 + stream_options 关键字 → true', () => {
    expect(shouldRetryWithoutStreamOptions(400, 'stream_options is not supported')).toBe(true)
    expect(shouldRetryWithoutStreamOptions(400, "Unknown parameter: 'include_usage'")).toBe(true)
  })
  it('非 400 或无关错误 → false', () => {
    expect(shouldRetryWithoutStreamOptions(500, 'stream_options')).toBe(false)
    expect(shouldRetryWithoutStreamOptions(400, 'rate limit exceeded')).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**（`shouldRetryWithoutStreamOptions` 未定义）

- [ ] **Step 3: 实现** — `stream-parse.ts` 追加：

```ts
const STREAM_OPTIONS_ERROR_KEYWORDS = ['stream_options', 'include_usage', 'unknown parameter']

/** 400 错误是否为 stream_options 兼容问题（可去掉该参数重试一次） */
export function shouldRetryWithoutStreamOptions(status: number, errorText: string): boolean {
  if (status !== 400) return false
  const lower = errorText.toLowerCase()
  return STREAM_OPTIONS_ERROR_KEYWORDS.some((k) => lower.includes(k))
}
```

- [ ] **Step 4: 接入 api.ts** — `callDeepSeekStreamOnce` 增加 `includeUsage` 参数（默认 `true`），`!response.ok` 分支改造为：当 `includeUsage === true && shouldRetryWithoutStreamOptions(status, errText)` 时，返回一个特殊标记让上层重试。改造为在 `callDeepSeekStreamOnce` 内直接二段调用：新增内部重试逻辑——`if (shouldRetry...) return callDeepSeekStreamOnce(apiKey, baseUrl, model, messages, tools, thinkingMode, supportsThinking, reasoningEffort, temperature, maxTokens, handlers, emittedRef, false)`。签名末尾追加 `includeUsage: boolean = true` 参数（注意：`callDeepSeekStreamOnce` 的 `handlers`/`emittedRef` 位置不变，追加参数放在最后）。

- [ ] **Step 5: 验证 + 提交**

Run: `npx vitest run tests/unit/stream-parse.test.ts && npm run typecheck`
Expected: 全绿

```bash
git add src/main/deepseek/api.ts src/main/deepseek/stream-parse.ts tests/unit/stream-parse.test.ts
git commit -m "feat: stream_options 400 兼容自动重试"
```

### Task 4: `useTypingReveal` 打字机 hook（纯逻辑可测）

**Files:**
- Create: `src/renderer/src/hooks/useTypingReveal.ts`
- Test: `tests/unit/typing-reveal.test.ts`

- [ ] **Step 1: 写失败测试** — 新建 `tests/unit/typing-reveal.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { nextRevealLength } from '../../src/renderer/src/hooks/useTypingReveal'

describe('nextRevealLength', () => {
  it('未赶上全量时按步进推进', () => {
    expect(nextRevealLength(0, 10, 3)).toBe(3)
    expect(nextRevealLength(6, 10, 3)).toBe(9)
  })
  it('不超过全量长度', () => {
    expect(nextRevealLength(9, 10, 3)).toBe(10)
    expect(nextRevealLength(12, 10, 3)).toBe(12)
  })
  it('空内容返回 0', () => {
    expect(nextRevealLength(0, 0, 3)).toBe(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现** — 新建 `src/renderer/src/hooks/useTypingReveal.ts`：

```ts
import { useEffect, useState } from 'react'

/** 纯函数：推进一个 reveal 步进，供单测 */
export function nextRevealLength(revealed: number, fullLength: number, charsPerTick: number): number {
  if (revealed >= fullLength) return revealed
  return Math.min(revealed + charsPerTick, fullLength)
}

/**
 * 打字机平滑显示 — 纯展示层
 * 流式期间 content 增长，revealed 指针以 tickMs/charsPerTick 节奏追赶；
 * 流式结束后立即显示完整内容。对所有服务商统一生效。
 */
export function useTypingReveal(content: string, isStreaming: boolean, charsPerTick = 3, tickMs = 30): string {
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    if (!isStreaming) {
      setRevealed(content.length)
      return
    }
    const interval = setInterval(() => {
      setRevealed((prev) => nextRevealLength(prev, content.length, charsPerTick))
    }, tickMs)
    return () => clearInterval(interval)
  }, [content, isStreaming, charsPerTick, tickMs])

  return content.slice(0, revealed)
}
```

- [ ] **Step 4: 验证 + 提交**

Run: `npx vitest run tests/unit/typing-reveal.test.ts && npm run typecheck`
Expected: PASS

```bash
git add src/renderer/src/hooks/useTypingReveal.ts tests/unit/typing-reveal.test.ts
git commit -m "feat: 打字机平滑显示 hook（纯展示层）"
```

### Task 5: MessageItem 应用打字机效果

**Files:**
- Modify: `src/renderer/src/components/MessageItem.tsx:533-537`

- [ ] **Step 1: 引入 hook** — 在 `MessageItem.tsx` 顶部加入 `import { useTypingReveal } from '../hooks/useTypingReveal'`；在组件内 `content` 渲染处（L534-536）改为：

```tsx
const revealedContent = useTypingReveal(content, isStreaming)
...
{content ? (
  <MarkdownRenderer content={revealedContent} />
) : isStreaming && !reasoning ? (
```

（若 `content` 来自 props/state 且与 `streamingContent` 不同，保持原有数据来源不变，仅渲染时套用 `useTypingReveal`。）

- [ ] **Step 2: 验证**

Run: `npm run typecheck && npm run build`
Expected: 通过；手动验证：任一服务商流式输出时逐字显示，结束后立即完整

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/MessageItem.tsx
git commit -m "feat: 消息内容应用打字机平滑显示"
```

### Task 6: 模型-供应商映射选择器 `model-label.ts`（TDD）

**Files:**
- Create: `src/shared/model-label.ts`
- Test: `tests/unit/model-label.test.ts`

- [ ] **Step 1: 写失败测试** — 新建 `tests/unit/model-label.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { getActiveProvider, getModelLabel } from '../../src/shared/model-label'
import type { AppSettings } from '../../src/shared/types'

const base: AppSettings = {
  providers: [
    { id: 'deepseek', name: 'DeepSeek', kind: 'preset', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', models: ['deepseek-v4-pro'], supportsThinking: true },
    { id: 'openai', name: 'OpenAI', kind: 'preset', baseUrl: 'https://api.openai.com/v1', apiKey: '', models: ['gpt-4o'], supportsThinking: false }
  ],
  activeProviderId: 'openai',
  model: 'gpt-4o'
} as AppSettings

describe('getActiveProvider / getModelLabel', () => {
  it('按 activeProviderId 返回服务商', () => {
    expect(getActiveProvider(base)?.id).toBe('openai')
  })
  it('格式为 服务商名 · 模型', () => {
    expect(getModelLabel(base)).toBe('OpenAI · gpt-4o')
  })
  it('无 providers 时回退 DeepSeek · model', () => {
    expect(getModelLabel({ model: 'deepseek-v4-pro' } as AppSettings)).toBe('DeepSeek · deepseek-v4-pro')
  })
  it('找不到服务商时回退 model', () => {
    expect(getModelLabel({ providers: base.providers, activeProviderId: 'missing', model: 'x' } as AppSettings)).toBe('x')
  })
})
```

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现** — 新建 `src/shared/model-label.ts`：

```ts
import type { AppSettings, ModelProvider } from './types'

/** 返回当前激活服务商；无 providers 时按 model 前缀回退 DeepSeek */
export function getActiveProvider(settings: AppSettings): ModelProvider | undefined {
  if (Array.isArray(settings.providers) && settings.providers.length > 0) {
    return settings.providers.find((p) => p.id === settings.activeProviderId)
  }
  return undefined
}

/** 模型显示标签：`{服务商名} · {模型}`；找不到服务商时仅显示模型名 */
export function getModelLabel(settings: AppSettings): string {
  const provider = getActiveProvider(settings)
  if (!settings.model) return provider?.name ?? '未知模型'
  if (provider) return `${provider.name} · ${settings.model}`
  if (settings.model.startsWith('deepseek')) return `DeepSeek · ${settings.model}`
  return settings.model
}
```

- [ ] **Step 4: 验证 + 提交**

Run: `npx vitest run tests/unit/model-label.test.ts && npm run typecheck`
Expected: PASS

```bash
git add src/shared/model-label.ts tests/unit/model-label.test.ts
git commit -m "feat: 模型-供应商映射选择器"
```

### Task 7: 替换硬编码模型显示点

**Files:**
- Modify: `src/renderer/src/components/layouts/CodingLayout.tsx:67,121,149`
- Modify: `src/renderer/src/components/layouts/OfficeLayout.tsx:234`
- Modify: `src/renderer/src/components/layouts/DesignLayout.tsx:153`

- [ ] **Step 1: CodingLayout** — 顶部加 `import { getModelLabel } from '../../../shared/model-label'`；L67 改为：

```ts
const settings = useStore((s) => s.settings)
const modelLabel = settings ? getModelLabel(settings) : '未知模型'
```

（若 `settings` 已被组件其他位置取用，直接复用；否则新增。）

- [ ] **Step 2: OfficeLayout L234 / DesignLayout L153** — 两处 chip 的 `{model.includes('pro') ? 'V4-Pro' : 'V4-Flash'}` 替换为 `{model}`，并在文件顶部加 `getModelLabel` 导入后，将模型段改为 `{getModelLabel(settings)}`（需确认该文件已取 `settings`；否则新增 `const settings = useStore((s) => s.settings)`）。最终 chip 文本形如 `思考 · OpenAI · gpt-4o`。

- [ ] **Step 3: 验证**

Run: `npm run typecheck`
Expected: 通过

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/layouts/CodingLayout.tsx src/renderer/src/components/layouts/OfficeLayout.tsx src/renderer/src/components/layouts/DesignLayout.tsx
git commit -m "fix: 模型显示改为服务商映射，去除硬编码 DeepSeek 标签"
```

---

## 阶段二：UI 重构

### Task 8: Material 主题 token（去玻璃化基础）

**Files:**
- Modify: `src/renderer/src/index.css:20-92`

- [ ] **Step 1: 浅色 token 修改**（`:root` 块内）：

| 现状 | 改为 |
|---|---|
| `--bg-base: #eef0f4` | `--bg-base: #f8f9fa` |
| `--bg-surface: #ffffff` | `#ffffff`（不变） |
| `--bg-elevated: #ffffff` | `#f1f3f4` |
| `--border-DEFAULT: rgba(20, 30, 50, 0.1)` | `#dadce0` |
| `--border-subtle: rgba(20, 30, 50, 0.06)` | `#f1f3f4` |
| `--border-hover: rgba(20, 30, 50, 0.18)` | `#bdc1c6` |
| `--bg-input: #ffffff` | `#ffffff`（不变） |

- [ ] **Step 2: 深色 token 修改**（`.dark` 块内）：

| 现状 | 改为 |
|---|---|
| `--bg-base: #090b10` | `#202124` |
| `--bg-surface: rgba(22, 25, 33, 0.66)` | `#292a2d` |
| `--bg-elevated: rgba(30, 34, 44, 0.85)` | `#303134` |
| `--bg-input: #12151c` | `#292a2d` |
| `--border-DEFAULT: rgba(255, 255, 255, 0.1)` | `#3c4043` |
| `--border-subtle: rgba(255, 255, 255, 0.06)` | `#303134` |
| `--border-hover: rgba(255, 255, 255, 0.2)` | `#5f6368` |

- [ ] **Step 3: 主题切换平滑** — 在 `index.css` 末尾追加：

```css
/* 主题切换平滑过渡 — 仅背景/边框/文字色 */
.theme-transition * {
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
```

- [ ] **Step 4: App.tsx 应用过渡类** — `src/renderer/src/App.tsx:158-166` 明暗切换 effect 中，加类并短暂移除：

```ts
useEffect(() => {
  const root = document.documentElement
  root.classList.add('theme-transition')
  if (settings?.theme === 'light') {
    root.classList.remove('dark')
  } else {
    root.classList.add('dark')
  }
  const t = setTimeout(() => root.classList.remove('theme-transition'), 300)
  return () => clearTimeout(t)
}, [settings?.theme])
```

- [ ] **Step 5: 验证 + 提交**

Run: `npm run build`
Expected: 构建通过；手动：切主题时背景/边框平滑过渡

```bash
git add src/renderer/src/index.css src/renderer/src/App.tsx
git commit -m "style: Material 主题 token 化，去除半透明玻璃表面"
```

### Task 9: 毛玻璃全面清除（全局 sweep）

**Files:**
- Modify: `src/renderer/src/index.css`（`.glass` 系列定义，L162-187、L1323-1351 区域）
- Modify: 下列 21 处组件类名

- [ ] **Step 1: 清除 index.css 中的 backdrop-filter 定义** — 删除/注释以下位置的 `-webkit-backdrop-filter` 与 `backdrop-filter` 行（保留其余样式）：
  - L162-163、L168-169、L176-177、L186-187（`.glass`/`.glass-panel`/`.glass-card`/`.glass-chip` 等）
  - L1323-1324、L1350-1351（自定义面板类）

- [ ] **Step 2: 逐文件替换组件类名**（`旧 → 新`，移除 backdrop-blur、半透明表面改纯色）：

| 文件 | 旧 | 新 |
|---|---|---|
| `components/AgentExpertPanel.tsx:46` | `bg-black/50 backdrop-blur-sm` | `bg-black/50` |
| `components/CodeBlock.tsx:59` | `bg-bg-elevated/60 backdrop-blur-sm` | `bg-bg-elevated` |
| `components/MemoryPanel.tsx:55` | `bg-black/50 backdrop-blur-sm` | `bg-black/50` |
| `components/GlobalChatInput.tsx:460` | `bg-bg-elevated/60 backdrop-blur-md` | `bg-bg-elevated` |
| `components/GlobalChatInput.tsx:486` | `bg-bg-elevated/95 backdrop-blur-xl shadow-glass` | `bg-bg-elevated border-border shadow-sm` |
| `components/coding/InlineTerminalOutput.tsx:19` | `bg-bg-surface/40 backdrop-blur-sm` | `bg-bg-surface` |
| `components/PlanSpecDialog.tsx:99` | `bg-black/50 backdrop-blur-sm` | `bg-black/50` |
| `components/ScreenshotPreview.tsx:16` | `bg-black/70 backdrop-blur-md` | `bg-black/70` |
| `components/SettingsModal.tsx:156` | `bg-black/60 backdrop-blur-md` | `bg-black/60`（此文件 Task 11 将删除） |
| `components/MessageItem.tsx:131` | `bg-bg-surface/40 backdrop-blur-sm` | `bg-bg-surface` |
| `components/MessageItem.tsx:335` | `bg-bg-surface/60 backdrop-blur-sm` | `bg-bg-surface` |
| `components/MessageItem.tsx:431` | `bg-white/20 ... backdrop-blur-sm` | `bg-white/20`（去掉 backdrop） |
| `components/MessageItem.tsx:506` | `bg-bg-surface/60 backdrop-blur-sm` | `bg-bg-surface` |
| `components/coding/ReasonixInput.tsx:58` | `bg-bg-elevated/80 backdrop-blur-xl ... focus-within:shadow-glow` | `bg-bg-elevated ... focus-within:shadow-glow` |
| `components/layouts/CodingLayout.tsx:289` | `bg-red-500/8 ... backdrop-blur-sm` | `bg-red-500/8` |
| `components/layouts/DesignLayout.tsx:160` | 同上 | 去掉 `backdrop-blur-sm` |
| `components/layouts/OfficeLayout.tsx:241` | 同上 | 去掉 `backdrop-blur-sm` |
| `components/ConfirmDialog.tsx:23` | `bg-black/50 backdrop-blur-md` | `bg-black/50` |
| `components/TaskListPanel.tsx:37` | `bg-bg-elevated/60 backdrop-blur-md` | `bg-bg-elevated` |
| `components/TokenStatsModal.tsx:54` | `bg-black/50 backdrop-blur-md` | `bg-black/50` |
| `components/shared/ToolResultCard.tsx:17` | `bg-red-500/5 ... backdrop-blur-sm` | `bg-red-500/5` |
| `components/office/SkillListPanel.tsx:277` | `bg-black/40 backdrop-blur-sm` | `bg-black/40` |
| `components/office/EmbeddedBrowserPanel.tsx:728` | `bg-black/50 backdrop-blur-sm` | `bg-black/50` |
| `components/office/McpListPanel.tsx:264` | `bg-black/40 backdrop-blur-sm` | `bg-black/40` |

（`bg-black/xx` 遮罩层保留——它是遮罩不是玻璃；仅去掉 blur。）

- [ ] **Step 3: 清点残留**

Run: `grep -rn "backdrop-blur\|backdrop-filter" src/renderer/src --include="*.tsx" --include="*.css"`（排除 `ui-components-precompiled.json` 数据文件）
Expected: 0 结果

- [ ] **Step 4: 验证 + 提交**

Run: `npm run typecheck && npm run build`
Expected: 通过

```bash
git add -A src/renderer/src
git commit -m "style: 全局移除毛玻璃效果，表面改为纯色 token"
```

### Task 10: 布局拥挤优化

**Files:**
- Modify: `src/renderer/src/components/GlobalChatInput.tsx`（输入区间距）
- Modify: `src/renderer/src/components/TitleBar.tsx`
- Modify: `src/renderer/src/components/RightSidebar.tsx`
- Modify: `src/renderer/src/components/Sidebar.tsx`

- [ ] **Step 1: GlobalChatInput** — 检查并统一：外层容器 `px-4 py-3`；工具按钮组与模型选择器之间 `gap-2`；输入区与发送按钮 `gap-2`；确保无 `-m-*` 负边距重叠。

- [ ] **Step 2: TitleBar** — 确认按钮组 `gap-1.5` 且图标 16px，左右留白 `px-3`。

- [ ] **Step 3: Sidebar / RightSidebar** — 列表项行高 `py-2`、分区间 `gap-2`/`mb-4` 统一；移除元素重叠（`absolute` 覆盖时补 z-index 与留白）。

- [ ] **Step 4: 验证 + 提交**

Run: `npm run typecheck && npm run build`
Expected: 通过；手动：三布局截图确认无拥挤/重叠

```bash
git add -A src/renderer/src/components
git commit -m "style: 布局间距优化，统一间隙节奏"
```

### Task 11: 应用内全屏设置页

**Files:**
- Create: `src/renderer/src/components/settings/SettingsPage.tsx`
- Modify: `src/renderer/src/App.tsx:17,232-235,266-274`
- Delete: `src/renderer/src/components/SettingsModal.tsx`

- [ ] **Step 1: 创建 SettingsPage** — 迁移 `SettingsModal` 全部状态逻辑（local/handleSave/handleReset/handleTest/导入导出/主题预览/转场导入导出），骨架改为全屏布局。核心结构：

```tsx
import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Key, Cpu, Users, Wrench, Gauge, Info } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { AppSettings, TestResult, TransitionAnimationFile } from '../../../../shared/types'
import { FALLBACK_SETTINGS, type TabId, type TestState } from './shared-components'
import { ApiTab } from './ApiTab'
import { ModelTab } from './ModelTab'
import { AgentTab } from './AgentTab'
import { ToolsTab } from './ToolsTab'
import { AppearanceTab } from './AppearanceTab'
import { AboutTab } from './AboutTab'

const NAV_ITEMS: { id: TabId; label: string; icon: typeof Key }[] = [
  { id: 'api', label: 'API 配置', icon: Key },
  { id: 'model', label: '模型与推理', icon: Cpu },
  { id: 'agent', label: 'Agent 编排', icon: Users },
  { id: 'tools', label: '工具设置', icon: Wrench },
  { id: 'appearance', label: '外观与数据', icon: Gauge },
  { id: 'about', label: '关于', icon: Info }
]

/** 应用内全屏设置页 — Material 风格，左侧分类导航 + 右侧内容面板 */
export function SettingsPage(): React.ReactElement | null {
  const settings = useStore((s) => s.settings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const updateSettings = useStore((s) => s.updateSettings)
  const clearAllConversations = useStore((s) => s.clearAllConversations)
  const convoCount = useStore((s) => s.conversations.length)
  const [activeTab, setActiveTab] = useState<TabId>('api')
  const [local, setLocal] = useState<AppSettings>(settings ?? FALLBACK_SETTINGS)
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [transitionMsg, setTransitionMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const transitionFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (settings) {
      setLocal(settings)
      setTestState('idle')
      setTestResult(null)
      setImportMsg(null)
      setTransitionMsg(null)
    }
  }, [settings])

  useEffect(() => {
    document.documentElement.style.setProperty('--theme-color', local.themeColor)
    return () => {
      if (settings?.themeColor) document.documentElement.style.setProperty('--theme-color', settings.themeColor)
    }
  }, [local.themeColor, settings?.themeColor])

  if (!settings) return null

  const update = (patch: Partial<AppSettings>): void => setLocal({ ...local, ...patch })

  const handleSave = async (): Promise<void> => {
    await updateSettings(local)
    setShowSettings(false)
  }

  const handleReset = (): void => {
    setLocal(FALLBACK_SETTINGS)
    setTestState('idle')
    setTestResult(null)
  }

  const handleTest = async (): Promise<void> => {
    setTestState('testing')
    setTestResult(null)
    const result = await window.api.chat.test(local.apiKey, local.baseUrl, local.model)
    setTestResult(result)
    setTestState(result.success ? 'success' : 'error')
  }

  const handleExport = (): void => {
    const convos = useStore.getState().conversations
    const data = JSON.stringify(convos, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `codemax-conversations-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (): void => {
      try {
        const parsed = JSON.parse(reader.result as string)
        if (!Array.isArray(parsed)) {
          setImportMsg({ ok: false, text: '文件格式错误：不是有效的会话数组' })
          return
        }
        useStore.setState({ conversations: parsed, currentConversationId: null })
        void useStore.getState()._persist()
        setImportMsg({ ok: true, text: `成功导入 ${parsed.length} 个会话` })
      } catch {
        setImportMsg({ ok: false, text: '文件解析失败：不是有效的 JSON' })
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-base">
      {/* 顶栏：返回 + 标题 + 保存 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <button
          onClick={() => setShowSettings(false)}
          className="flex items-center gap-2 text-sm font-medium text-text-primary transition-colors hover:text-accent"
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <h1 className="text-base font-semibold text-text-primary">设置</h1>
        <button
          onClick={() => void handleSave()}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          保存
        </button>
      </header>

      {/* 主体：左导航 + 右内容 */}
      <div className="flex min-h-0 flex-1">
        <nav className="w-56 shrink-0 overflow-y-auto border-r border-border bg-bg-surface p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-accent/10 font-medium text-accent'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          {activeTab === 'api' && (
            <ApiTab settings={local} update={update} showKey={showKey} setShowKey={setShowKey} testState={testState} testResult={testResult} onTest={() => void handleTest()} />
          )}
          {activeTab === 'model' && <ModelTab settings={local} update={update} />}
          {activeTab === 'agent' && <AgentTab settings={local} update={update} />}
          {activeTab === 'tools' && <ToolsTab settings={local} update={update} />}
          {activeTab === 'appearance' && (
            <AppearanceTab
              settings={local}
              update={update}
              clearAllConversations={clearAllConversations}
              convoCount={convoCount}
              importMsg={importMsg}
              fileInputRef={fileInputRef}
              onImport={handleImport}
              transitionMsg={transitionMsg}
              transitionFileRef={transitionFileRef}
            />
          )}
          {activeTab === 'about' && <AboutTab settings={local} />}
        </div>
      </div>
    </div>
  )
}
```

> 注意：需核对 `AppearanceTab`/`ApiTab` 等实际 props 签名（SettingsModal 内原有传参方式），保持一致；`handleReset` 的"恢复默认"如需提供，在顶栏加按钮。

- [ ] **Step 2: App.tsx 接入** — L17 懒加载改：

```ts
const SettingsPage = lazy(() => import('./components/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
```

删除 `SettingsModal` 的懒加载与渲染（L17、L232-235）；在 `mainContent` 渲染后、启动动画判断之前，插入全屏设置页分支：

```tsx
// 全屏设置页 — 独立于主界面视图
if (settings?.view === 'settings') {
  return <SettingsPage />
}
```

> 说明：`settings.view` 需在 `AppSettings` 类型新增 `view?: 'main' | 'settings'` 并在 `setShowSettings(true/false)` 中同步（或直接复用 `showSettings` store 状态：`if (showSettings && loaded && settings) return <SettingsPage />`——推荐复用 store 的 `showSettings`，零类型改动）。采用后者：

```tsx
const showSettings = useStore((s) => s.showSettings)
...
if (!animationDone && loaded && settings && showStartupAnimation) { ... 原逻辑 ... }
if (showSettings && loaded && settings) return <SettingsPage />
return mainContent
```

- [ ] **Step 3: 删除 SettingsModal** — `DeleteFile: src/renderer/src/components/SettingsModal.tsx`；全局搜索确认无引用（`grep -rn "SettingsModal" src` 应仅剩 App.tsx 已改无引用）。

- [ ] **Step 4: 验证 + 提交**

Run: `npm run typecheck && npm run build`
Expected: 通过；手动：Ctrl+, 打开全屏设置页、左导航切换、保存/返回、主题切换平滑

```bash
git add -A src/renderer/src
git commit -m "feat: 设置重构为应用内全屏页面（左导航分类）"
```

### Task 12: 开屏品牌锁定 CODEMAX

**Files:**
- Modify: `src/renderer/src/components/StartupAnimation.tsx:203`
- Modify: `src/renderer/src/components/settings/AppearanceTab.tsx:231-246`
- Modify: `src/shared/defaults.ts:89`

- [ ] **Step 1: StartupAnimation 硬编码** — L203 `const text = config?.startupText ?? 'CodeMax'` 改为：

```ts
const text = 'CODEMAX'
```

（`config` 中 `startupText` 不再读取；其余 `fontSize/strokeDuration/fontFamily` 等仍取 `config`。）

- [ ] **Step 2: AppearanceTab 移除输入框** — 删除 L231-246 的「开屏文字」输入块（含 `Type` 图标 label、input、提示文案）。确认 `Type` 图标仍在 L249 `NumberInputRow` 使用，import 保留。

- [ ] **Step 3: defaults.ts** — L89 `startupText: 'CodeMax'` → `startupText: 'CODEMAX'`。

- [ ] **Step 4: 验证 + 提交**

Run: `npm run typecheck && npm run build`
Expected: 通过；手动：重启应用开屏居中显示 CODEMAX；设置→外观 无「开屏文字」输入框

```bash
git add src/renderer/src/components/StartupAnimation.tsx src/renderer/src/components/settings/AppearanceTab.tsx src/shared/defaults.ts
git commit -m "feat: 开屏品牌锁定为 CODEMAX，移除可编辑设置项"
```

---

## 收尾回归

- [ ] **Step 1: 全量验证**

Run: `npm run typecheck && npm run test && npm run build`
Expected: 全绿

- [ ] **Step 2: 手动回归清单**
  1. DeepSeek 对话：思考链 + 逐字输出 + 工具调用正常
  2. 切换 OpenAI/自定义服务商（中转站）：流式逐字输出；右上角/消息/会话栏模型名显示为「服务商 · 模型」
  3. 三布局（office/coding/design）切换正常，无毛玻璃残留、无拥挤重叠
  4. 浅/深主题切换平滑；设置页左导航、保存、返回正常
  5. 重启：开屏居中 CODEMAX；设置无「开屏文字」编辑框

- [ ] **Step 3: Commit（如内容未随任务提交）**

```bash
git status
```

---

## Self-Review 记录

**Spec 覆盖核对：**
- SP1 流式（stream_options 重试 / 容错解析 / 打字机）→ Task 1-5 ✓
- SP2 模型-供应商映射 → Task 6-7 ✓
- SP3 去毛玻璃 Material → Task 8-9 ✓
- SP4 布局优化 → Task 10 ✓
- SP5 全屏设置页 → Task 11 ✓
- SP6 CODEMAX 锁定 → Task 12 ✓
- 主题切换平滑（spec SP5）→ Task 8 Step 3-4 ✓

**类型一致性：**
- `buildRequestBody` 的 `RequestBodyParams.includeUsage`（Task 1）与 `callDeepSeekStreamOnce` 末尾追加参数（Task 3）同源；`parseStreamChunk`（Task 2）与 `shouldRetryWithoutStreamOptions`（Task 3）均在 `stream-parse.ts` 导出 ✓
- `getActiveProvider/getModelLabel` 签名在 `src/shared/model-label.ts` 定义，Task 6 测试与 Task 7 消费一致 ✓
- `useTypingReveal` 与 `nextRevealLength` 同文件导出，Task 4 测试、Task 5 消费一致 ✓
