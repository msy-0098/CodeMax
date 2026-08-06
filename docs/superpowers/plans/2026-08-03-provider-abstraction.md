# ModelProvider 抽象层（多模型服务商支持）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 设计文档：[`docs/superpowers/specs/2026-08-03-provider-abstraction-design.md`](../specs/2026-08-03-provider-abstraction-design.md)

**Goal:** 让 ximo-agent 支持任意 OpenAI 兼容模型服务商——内置 6 家预设 + 自定义服务商（独立 Key/模型列表）+「获取模型」按钮，按服务商自动区分 DeepSeek 专属参数。

**Architecture:** 新增 `ModelProvider` 数据模型与 `providers.ts` 预设表；`AppSettings` 增加 `providers[]` + `activeProviderId`，顶层 `model/baseUrl/apiKey` 保留为活动连接快照（主进程/工具层/会话持久化零改动）；请求层 `supportsThinking` 门控 DeepSeek 专属参数；`loadSettings` 做一次性数据迁移；新增 `providers:fetchModels` IPC 拉取模型列表。

**Tech Stack:** Electron 33 / React 18 / Zustand / TypeScript / Vitest（新加最小配置）

**执行约定：**
- 提交遵循 Conventional Commits（`feat: xxx` / `test: xxx`）；每次提交前先 `git status` 确认只暂存相关文件
- 测试位于 `tests/unit/`，仅测纯逻辑（类型、迁移、请求体构造、响应解析、token 估算），不测 UI 组件
- 所有命令在 `d:\AllTools\frontend\codemax` 下以 PowerShell 执行

---

## 文件结构总览

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/shared/types/core.ts` | `ModelId` 放宽为 `string` | 修改 |
| `src/shared/types/settings.ts` | 新增 `ModelProvider`、`providers`、`activeProviderId` | 修改 |
| `src/shared/types/messaging.ts` | `ChatRequest` 新增 `supportsThinking?` | 修改 |
| `src/shared/providers.ts` | 预设常量表 + 构造函数 + 工具函数 | 新建 |
| `src/shared/migrate-settings.ts` | 旧 settings → providers 迁移纯函数 | 新建 |
| `src/shared/defaults.ts` | `providers`/`activeProviderId` 默认值 | 修改 |
| `src/main/store.ts` | `loadSettings` 接入迁移 | 修改 |
| `src/main/deepseek/api.ts` | `buildRequestBody` 纯函数 + `supportsThinking` 门控 | 修改 |
| `src/main/deepseek/agent-loop.ts` | 传递 `request.supportsThinking` | 修改 |
| `src/main/deepseek/supervisor.ts` | `runSupervisionCheck` 增加 `supportsThinking` 门控 | 修改 |
| `src/main/deepseek/index.ts` | 导出 `estimateTokens` | 修改 |
| `src/main/deepseek/tokenizer.ts` | 新增 `estimateTokens` | 修改 |
| `src/main/ipc/chat-handler.ts` | 从 active provider 取连接参数 | 修改 |
| `src/main/ipc/providers-handlers.ts` | `providers:fetchModels` IPC + 响应解析 | 新建 |
| `src/main/index.ts` | 注册 providers-handlers | 修改 |
| `src/preload/index.ts` | 暴露 `window.api.providers` | 修改 |
| `src/renderer/src/store/types.ts` | StoreState 新增 3 个 provider actions | 修改 |
| `src/renderer/src/store/useStore.ts` | 实现 provider actions | 修改 |
| `src/renderer/src/components/settings/ModelTab.tsx` | 服务商管理页 | 修改 |
| `src/renderer/src/components/settings/ApiTab.tsx` | 同步当前服务商编辑 | 修改 |
| `src/renderer/src/components/chat-input/ModelSelector.tsx` | 两级下拉 | 修改 |
| `tests/unit/providers.test.ts` | 预设表测试 | 新建 |
| `tests/unit/migrate-settings.test.ts` | 迁移测试 | 新建 |
| `tests/unit/api-body.test.ts` | 请求体构造测试 | 新建 |
| `tests/unit/parse-models.test.ts` | /models 响应解析测试 | 新建 |
| `tests/unit/estimate-tokens.test.ts` | token 估算测试 | 新建 |
| `vitest.config.ts` | vitest 最小配置（隔离 electron-vite） | 新建 |

---

## Task 0: 环境准备

**Files:**
- Create: `vitest.config.ts`
- 依赖安装（无新增依赖）

- [ ] **Step 1: 安装依赖**

Run: `npm install`
Expected: 完成安装，无 error。若 electron 二进制下载失败（网络问题），重试 `npm install` 或配置镜像。

- [ ] **Step 2: 新建 vitest 配置（隔离 electron-vite，否则 vitest 会误读 electron.vite.config.ts）**

Create: `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
})
```

- [ ] **Step 3: 基线验证**

Run: `npx vitest run`
Expected: `No test files found`（退出码 1，可接受——这是基线状态）

Run: `npm run typecheck`
Expected: node + web 均通过（`tsc` 找到）。**若基线 typecheck 有预存错误，记录下来并在每个任务后只验证"未引入新错误"。**

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts package-lock.json
git commit -m "chore: 初始化 vitest 配置用于纯逻辑单测"
```

---

## Task 1: 类型层

**Files:**
- Modify: `src/shared/types/core.ts:5`
- Modify: `src/shared/types/settings.ts`
- Modify: `src/shared/types/messaging.ts:63-77`

- [ ] **Step 1: 放宽 ModelId**

Modify `src/shared/types/core.ts` 第 5 行：

```ts
export type ModelId = string
```

（原有 `'deepseek-v4-pro' as ModelId` 断言处仍可编译，无需改动。）

- [ ] **Step 2: 新增 ModelProvider 接口与 AppSettings 字段**

Modify `src/shared/types/settings.ts`，在文件顶部（`import` 之后、`AppSettings` 之前）新增：

```ts
/** 模型服务商配置 — 一个服务商 = 一套 OpenAI 兼容连接 */
export interface ModelProvider {
  /** 唯一 ID：预设用 'deepseek'|'openai'|'glm'|'kimi'|'qwen'|'siliconflow'，自定义用 'custom-N' */
  id: string
  /** 显示名 */
  name: string
  /** 预设不可删除；自定义可增删改 */
  kind: 'preset' | 'custom'
  /** OpenAI 兼容 Base URL（不含尾部 /chat/completions） */
  baseUrl: string
  /** 该服务商独立的 API Key */
  apiKey: string
  /** 可选模型列表 */
  models: string[]
  /** 是否支持 DeepSeek 专属思考链参数（enable_thinking / reasoning_content） */
  supportsThinking: boolean
}
```

Modify `AppSettings`，在 `baseUrl` 字段后新增：

```ts
  /** 模型服务商列表（预设 + 自定义） */
  providers: ModelProvider[]
  /** 当前激活的服务商 ID */
  activeProviderId: string
```

- [ ] **Step 3: ChatRequest 新增 supportsThinking**

Modify `src/shared/types/messaging.ts` 的 `ChatRequest` 接口，在 `autoModeLevel` 后新增：

```ts
  /** 服务商是否支持思考链 — 由主进程根据 active provider 注入，渲染进程不设置 */
  supportsThinking?: boolean
```

- [ ] **Step 4: 验证**

Run: `npm run typecheck`
Expected: 通过。若报 `settings.ts` 中 `DEFAULT_SETTINGS` 缺 `providers`/`activeProviderId`——这是预期中的中间态，Task 3 会补默认值；若报错阻塞，先继续 Task 2/3 再回来验证。

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/core.ts src/shared/types/settings.ts src/shared/types/messaging.ts
git commit -m "feat: 定义 ModelProvider 类型并放宽 ModelId 为 string"
```

---

## Task 2: 预设常量表

**Files:**
- Create: `src/shared/providers.ts`
- Test: `tests/unit/providers.test.ts`

- [ ] **Step 1: 写失败测试**

Create: `tests/unit/providers.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { PROVIDER_PRESETS, buildPresetProvider, detectSupportsThinkingByBaseUrl, getPresetById } from '../../src/shared/providers'

describe('PROVIDER_PRESETS', () => {
  it('包含 6 家预设且 id 唯一', () => {
    expect(PROVIDER_PRESETS).toHaveLength(6)
    const ids = PROVIDER_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('仅 deepseek 支持思考链，baseUrl 均为合法 http(s)', () => {
    for (const p of PROVIDER_PRESETS) {
      expect(p.supportsThinking).toBe(p.id === 'deepseek')
      expect(p.baseUrl).toMatch(/^https?:\/\//)
      expect(p.defaultModels.length).toBeGreaterThan(0)
    }
  })

  it('buildPresetProvider 深拷贝模型列表并生成 preset provider', () => {
    const preset = getPresetById('openai')!
    const p = buildPresetProvider(preset)
    expect(p.id).toBe('openai')
    expect(p.kind).toBe('preset')
    expect(p.models).toEqual(preset.defaultModels)
    expect(p.models).not.toBe(preset.defaultModels) // 引用不同
    expect(p.apiKey).toBe('')
  })

  it('detectSupportsThinkingByBaseUrl 按 deepseek.com 判定', () => {
    expect(detectSupportsThinkingByBaseUrl('https://api.deepseek.com/v1')).toBe(true)
    expect(detectSupportsThinkingByBaseUrl('https://api.openai.com/v1')).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/providers.test.ts`
Expected: FAIL（`Cannot find module '../../src/shared/providers'`）

- [ ] **Step 3: 实现**

Create: `src/shared/providers.ts`

```ts
import type { ModelProvider } from './types/settings'

/** 预设服务商定义（不含 apiKey，实例化时注入） */
export interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  defaultModels: string[]
  supportsThinking: boolean
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModels: ['deepseek-v4-pro', 'deepseek-v4-flash'], supportsThinking: true },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3'], supportsThinking: false },
  { id: 'glm', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModels: ['glm-4-plus', 'glm-4-flash'], supportsThinking: false },
  { id: 'kimi', name: 'Kimi（Moonshot）', baseUrl: 'https://api.moonshot.cn/v1', defaultModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], supportsThinking: false },
  { id: 'qwen', name: '通义 Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModels: ['qwen-max', 'qwen-plus', 'qwen-turbo'], supportsThinking: false },
  { id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', defaultModels: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'], supportsThinking: false }
]

/** 由预设实例化一个可持久化的 provider（默认空 Key） */
export function buildPresetProvider(preset: ProviderPreset, apiKey = ''): ModelProvider {
  return {
    id: preset.id,
    name: preset.name,
    kind: 'preset',
    baseUrl: preset.baseUrl,
    apiKey,
    models: [...preset.defaultModels],
    supportsThinking: preset.supportsThinking
  }
}

export function getPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id)
}

/** 按 Base URL 启发式判断是否 DeepSeek（迁移与容错用） */
export function detectSupportsThinkingByBaseUrl(baseUrl: string): boolean {
  return baseUrl.includes('deepseek.com')
}

/** 生成下一个可用的自定义服务商 ID */
export function genCustomProviderId(existing: ModelProvider[]): string {
  const used = new Set(existing.map((p) => p.id))
  let n = 1
  while (used.has(`custom-${n}`)) n++
  return `custom-${n}`
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/providers.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/shared/providers.ts tests/unit/providers.test.ts
git commit -m "feat: 新增模型服务商预设表与构造函数"
```

---

## Task 3: 数据迁移（纯函数 + store 接入）

**Files:**
- Create: `src/shared/migrate-settings.ts`
- Test: `tests/unit/migrate-settings.test.ts`
- Modify: `src/shared/defaults.ts`
- Modify: `src/main/store.ts:18-28`

- [ ] **Step 1: 写失败测试**

Create: `tests/unit/migrate-settings.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { migrateSettings } from '../../src/shared/migrate-settings'

describe('migrateSettings', () => {
  it('已存在 providers 时不迁移', () => {
    const providers = [{ id: 'openai', name: 'OpenAI', kind: 'preset', baseUrl: 'https://api.openai.com/v1', apiKey: 'k', models: ['gpt-4o'], supportsThinking: false }]
    const r = migrateSettings({ providers, activeProviderId: 'openai', model: 'gpt-4o' } as never)
    expect(r.needsWriteBack).toBe(false)
    expect(r.settings.providers).toBe(providers)
  })

  it('旧 DeepSeek 配置迁移为 deepseek 预设并保留原模型', () => {
    const r = migrateSettings({ apiKey: 'sk-123', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-pro' })
    expect(r.needsWriteBack).toBe(true)
    expect(r.settings.providers).toHaveLength(1)
    const p = r.settings.providers![0]
    expect(p.id).toBe('deepseek')
    expect(p.supportsThinking).toBe(true)
    expect(p.apiKey).toBe('sk-123')
    expect(p.models).toContain('deepseek-v4-pro')
    expect(r.settings.activeProviderId).toBe('deepseek')
  })

  it('非 DeepSeek baseUrl 迁移为 custom-migrated 且按 URL 判定思考链', () => {
    const r = migrateSettings({ apiKey: 'k', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' })
    const p = r.settings.providers![0]
    expect(p.id).toBe('custom-migrated')
    expect(p.kind).toBe('custom')
    expect(p.supportsThinking).toBe(false)
    expect(p.models).toEqual(['gpt-4o'])
  })

  it('空输入不迁移', () => {
    const r = migrateSettings(undefined)
    expect(r.needsWriteBack).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/migrate-settings.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现纯函数**

Create: `src/shared/migrate-settings.ts`

```ts
import type { AppSettings, ModelProvider } from './types/settings'
import { PROVIDER_PRESETS, buildPresetProvider, detectSupportsThinkingByBaseUrl } from './providers'

export interface MigrationResult {
  settings: Partial<AppSettings>
  needsWriteBack: boolean
}

/**
 * 旧版 settings（仅 baseUrl/model/apiKey）→ providers 数组。
 * 仅当 providers 缺失时触发；已迁移的配置原样返回。
 */
export function migrateSettings(parsed: Partial<AppSettings> | undefined): MigrationResult {
  if (!parsed) return { settings: {}, needsWriteBack: false }
  if (Array.isArray(parsed.providers) && parsed.providers.length > 0) {
    return { settings: parsed, needsWriteBack: false }
  }

  const baseUrl = parsed.baseUrl || 'https://api.deepseek.com/v1'
  const model = parsed.model || 'deepseek-v4-pro'
  const apiKey = parsed.apiKey || ''
  const isDeepSeek = detectSupportsThinkingByBaseUrl(baseUrl)

  const preset = PROVIDER_PRESETS.find((p) => p.baseUrl === baseUrl)
  let provider: ModelProvider
  if (preset) {
    provider = buildPresetProvider(preset, apiKey)
    if (!provider.models.includes(model)) provider.models.unshift(model)
  } else {
    provider = {
      id: 'custom-migrated',
      name: '自定义服务商',
      kind: 'custom',
      baseUrl,
      apiKey,
      models: [model],
      supportsThinking: isDeepSeek
    }
  }

  return {
    settings: { ...parsed, providers: [provider], activeProviderId: provider.id },
    needsWriteBack: true
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/migrate-settings.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: defaults.ts 注入默认 providers**

Modify `src/shared/defaults.ts`：在文件顶部 import 后新增

```ts
import { PROVIDER_PRESETS, buildPresetProvider } from './providers'
import type { ModelProvider } from './types/settings'
```

并在 `export const DEFAULT_SETTINGS` 对象中、`baseUrl` 字段之后新增：

```ts
  providers: PROVIDER_PRESETS.map((p) => buildPresetProvider(p)),
  activeProviderId: 'deepseek',
```

同时删除 defaults.ts 中的硬编码视觉密钥（第 77 行 `visionApiKey: 'sk-qeSAX...'` 改为 `visionApiKey: ''`，密钥交由用户在设置中填写）。

- [ ] **Step 6: store.ts 接入迁移**

Modify `src/main/store.ts` 的 `loadSettings`（当前 18-28 行）：

```ts
export async function loadSettings(): Promise<AppSettings> {
  try {
    await ensureDir()
    const raw = await readFile(settingsFile, 'utf-8')
    const parsed = JSON.parse(raw)
    const { settings: migrated, needsWriteBack } = migrateSettings(parsed)
    const merged: AppSettings = { ...DEFAULT_SETTINGS, ...migrated }
    if (needsWriteBack) {
      await saveSettings(merged)
    }
    return merged
  } catch (e) {
    console.error('加载设置失败：', e)
  }
  return { ...DEFAULT_SETTINGS }
}
```

并在文件顶部 import 处新增：

```ts
import { migrateSettings } from '../shared/migrate-settings'
```

- [ ] **Step 7: 验证**

Run: `npm run typecheck`
Expected: 通过（`ModelId` 已放宽，`DEFAULT_SETTINGS` 补齐 providers 字段）

- [ ] **Step 8: Commit**

```bash
git add src/shared/migrate-settings.ts tests/unit/migrate-settings.test.ts src/shared/defaults.ts src/main/store.ts
git commit -m "feat: 旧设置迁移到 providers 并移除硬编码视觉密钥"
```

---

## Task 4: token 估算

**Files:**
- Modify: `src/main/deepseek/tokenizer.ts`（文件末尾新增）
- Modify: `src/main/deepseek/index.ts`
- Test: `tests/unit/estimate-tokens.test.ts`

- [ ] **Step 1: 写失败测试**

Create: `tests/unit/estimate-tokens.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { estimateTokens } from '../../src/main/deepseek/tokenizer'

describe('estimateTokens', () => {
  it('非 deepseek 服务商按 字符数/4 近似', () => {
    expect(estimateTokens('', 'openai')).toBe(0)
    expect(estimateTokens('hello world', 'openai')).toBe(3) // ceil(11/4)
    expect(estimateTokens('中文测试文本长度较长', 'qwen')).toBe(5) // ceil(18/4)
  })

  it('deepseek 服务商走 BPE；分词器不可用时回退近似', () => {
    const n = estimateTokens('你好，世界', 'deepseek')
    expect(n).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/estimate-tokens.test.ts`
Expected: FAIL（`estimateTokens` 未导出）

- [ ] **Step 3: 实现**

Modify `src/main/deepseek/tokenizer.ts` 文件末尾新增：

```ts
/**
 * 跨服务商 token 估算：
 * - deepseek：走本地 BPE 精确计数（失败时回退近似）
 * - 其他：字符数/4 近似（API 返回的真实 usage 仍以响应为准）
 */
export function estimateTokens(text: string, providerId: string): number {
  if (providerId === 'deepseek') {
    try {
      return countTokens(text)
    } catch {
      return Math.ceil(text.length / 4)
    }
  }
  return Math.ceil(text.length / 4)
}
```

Modify `src/main/deepseek/index.ts` 的导出行：

```ts
export { countTokens, countMessageTokens, isTokenizerReady, estimateTokens } from './tokenizer'
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/estimate-tokens.test.ts`
Expected: PASS（2 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/main/deepseek/tokenizer.ts src/main/deepseek/index.ts tests/unit/estimate-tokens.test.ts
git commit -m "feat: 新增跨服务商 token 估算 estimateTokens"
```

---

## Task 5: 请求层 supportsThinking 门控

**Files:**
- Modify: `src/main/deepseek/api.ts`
- Test: `tests/unit/api-body.test.ts`

- [ ] **Step 1: 写失败测试**

Create: `tests/unit/api-body.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { buildRequestBody } from '../../src/main/deepseek/api'

const base = {
  model: 'gpt-4o',
  messages: [{ role: 'user' as const, content: 'hi' }],
  tools: undefined,
  thinkingMode: true,
  reasoningEffort: 'high' as const,
  temperature: 0.7,
  maxTokens: 1000
}

describe('buildRequestBody', () => {
  it('supportsThinking=false 时只发标准参数，不发 DeepSeek 专属字段', () => {
    const body = buildRequestBody({ ...base, supportsThinking: false })
    expect(body.enable_thinking).toBeUndefined()
    expect(body.reasoning_effort).toBeUndefined()
    expect(body.temperature).toBe(0.7)
  })

  it('supportsThinking=true 且开启思考时发 DeepSeek 专属字段', () => {
    const body = buildRequestBody({ ...base, supportsThinking: true })
    expect(body.enable_thinking).toBe(true)
    expect(body.reasoning_effort).toBe('high')
    expect(body.temperature).toBeUndefined()
  })

  it('supportsThinking=true 但 effort=off 时不发专属字段', () => {
    const body = buildRequestBody({ ...base, supportsThinking: true, reasoningEffort: 'off' })
    expect(body.enable_thinking).toBeUndefined()
    expect(body.temperature).toBe(0.7)
  })

  it('ultra 映射为 max（toApiEffort）', () => {
    const body = buildRequestBody({ ...base, supportsThinking: true, reasoningEffort: 'ultra' })
    expect(body.reasoning_effort).toBe('max')
  })

  it('携带 tools 时按 function schema 包装', () => {
    const body = buildRequestBody({
      ...base, supportsThinking: false,
      tools: [{ name: 'foo', description: 'd', parameters: { type: 'object', properties: {} } }]
    })
    expect(Array.isArray(body.tools)).toBe(true)
    expect((body.tools as unknown[]).length).toBe(1)
    expect(body.tool_choice).toBe('auto')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/api-body.test.ts`
Expected: FAIL（`buildRequestBody` 不存在）

- [ ] **Step 3: 抽取 buildRequestBody 纯函数并接入门控**

Modify `src/main/deepseek/api.ts`：

(a) 在 `toApiEffort` 之后新增纯函数：

```ts
export interface RequestBodyParams {
  model: string
  messages: { role: string; content: string; tool_calls?: unknown; tool_call_id?: string; reasoning_content?: string }[]
  tools?: ToolDefinition[] | undefined
  thinkingMode: boolean
  reasoningEffort: ReasoningEffort
  supportsThinking: boolean
  temperature: number
  maxTokens: number
}

/** 构造 /chat/completions 请求体 — 纯函数便于单测 */
export function buildRequestBody(params: RequestBodyParams): Record<string, unknown> {
  const { model, messages, tools, thinkingMode, reasoningEffort, supportsThinking, temperature, maxTokens } = params
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    max_tokens: maxTokens,
    stream_options: { include_usage: true }
  }

  // A4 工具 schema 字典序归一化排序 — 保持 tools JSON 字节稳定，避免破坏缓存前缀
  if (tools && tools.length > 0) {
    const sortedTools = normalizeToolSchemas(tools)
    body.tools = sortedTools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }))
    body.tool_choice = 'auto'
  }

  // 仅 DeepSeek 系列支持思考链专属参数；其他服务商一律标准 OpenAI 格式
  if (supportsThinking && thinkingMode && reasoningEffort !== 'off') {
    body.enable_thinking = true
    body.reasoning_effort = toApiEffort(reasoningEffort)
  } else {
    body.temperature = temperature
  }

  return body
}
```

(b) 修改 `callDeepSeekStreamOnce`：签名增加 `supportsThinking: boolean` 参数（放在 `thinkingMode` 之后），并将 51-78 行的 body 构造替换为：

```ts
  const body = buildRequestBody({
    model,
    messages: sanitizedMessages,
    tools,
    thinkingMode,
    reasoningEffort,
    supportsThinking,
    temperature,
    maxTokens
  })
```

（删除原有手写 body / A4 归一化 / thinking 分支代码，由 buildRequestBody 接管。）

(c) 修改 `callDeepSeekStream`：签名增加 `supportsThinking: boolean`，传入 `callDeepSeekStreamOnce`。同时 `streamChat` 中调用 `callDeepSeekStream` 处补 `request.supportsThinking ?? true`。

> 默认值 `?? true` 保证旧调用路径行为不变（默认按 DeepSeek 处理）。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/api-body.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 验证既有逻辑未破坏**

Run: `npm run typecheck`
Expected: 通过

- [ ] **Step 6: Commit**

```bash
git add src/main/deepseek/api.ts tests/unit/api-body.test.ts
git commit -m "feat: 请求体构造抽为纯函数并接入 supportsThinking 门控"
```

---

## Task 6: 调用链穿透（agent-loop + supervisor）

**Files:**
- Modify: `src/main/deepseek/agent-loop.ts:97-108`
- Modify: `src/main/deepseek/supervisor.ts:86-147`

- [ ] **Step 1: agent-loop 传递 supportsThinking**

Modify `src/main/deepseek/agent-loop.ts` 中 `callDeepSeekStream(...)` 调用（约 97 行），在 `request.reasoningEffort` 之后、`request.temperature` 之前插入：

```ts
      request.supportsThinking ?? true,
```

（即调用变为 `callDeepSeekStream(apiKey, baseUrl, request.model, messages, tools, request.thinkingMode, request.reasoningEffort, request.supportsThinking ?? true, request.temperature, request.maxTokens, handlers)`）

同时找到 `runSupervisionCheck` 的调用处（约 184 行），补一个参数：

```ts
        supervisionPromise = runSupervisionCheck(apiKey, baseUrl, request.model, request.reasoningEffort, request.supportsThinking ?? true, snapshot, signal)
```

- [ ] **Step 2: supervisor 门控思考参数**

Modify `src/main/deepseek/supervisor.ts`：

(a) `runSupervisionCheck` 签名（86-93 行）增加参数：

```ts
export async function runSupervisionCheck(
  apiKey: string,
  baseUrl: string,
  model: string,
  reasoningEffort: ReasoningEffort,
  supportsThinking: boolean,
  snapshot: AgentRoundSnapshot,
  signal?: AbortSignal
): Promise<SupervisionResult | null> {
```

(b) 修改 143-147 行的思考参数分支：

```ts
  // 监督 Agent 也使用思考模式 — 仅当服务商支持（如 DeepSeek）
  if (supportsThinking && reasoningEffort !== 'off') {
    body.enable_thinking = true
    body.reasoning_effort = toApiEffort(reasoningEffort)
  }
```

- [ ] **Step 3: 验证**

Run: `npm run typecheck`
Expected: 通过

- [ ] **Step 4: Commit**

```bash
git add src/main/deepseek/agent-loop.ts src/main/deepseek/supervisor.ts
git commit -m "feat: agent-loop 与 supervisor 透传 supportsThinking"
```

---

## Task 7: chat-handler 使用 active provider

**Files:**
- Modify: `src/main/ipc/chat-handler.ts`

- [ ] **Step 1: 引入工具函数与取 provider 辅助**

Modify `src/main/ipc/chat-handler.ts`：

(a) 顶部 import 处新增：

```ts
import { PROVIDER_PRESETS, buildPresetProvider } from '../../shared/providers'
import type { ModelProvider } from '../../shared/types'
```

(b) 在 `registerChatHandlers` 函数前新增辅助函数：

```ts
/** 从 settings 解析当前激活的服务商（容错回退：deepseek 预设） */
function getActiveProvider(settings: Awaited<ReturnType<typeof loadSettings>>): ModelProvider {
  const list = settings.providers ?? []
  const active = list.find((p) => p.id === settings.activeProviderId)
  if (active) return active
  const preset = PROVIDER_PRESETS.find((p) => p.id === 'deepseek') ?? PROVIDER_PRESETS[0]
  return buildPresetProvider(preset, settings.apiKey)
}
```

- [ ] **Step 2: 用 provider 替换顶层连接参数**

Modify `chat:start` handler：

(a) 在 `const settings = await loadSettings()` 后新增：

```ts
    const provider = getActiveProvider(settings)
```

(b) 将 `agentLoop(...)` 调用（约 178 行）改为：

```ts
        await agentLoop(provider.apiKey, provider.baseUrl, { ...request, messages: messagesWithEnv, tools: sortedTools, supportsThinking: provider.supportsThinking }, handlers, toolContext, request.sessionId)
```

(c) 将 `streamChat(...)` 调用（约 180 行）改为：

```ts
        await streamChat(provider.apiKey, provider.baseUrl, { ...request, messages: messagesWithEnv, supportsThinking: provider.supportsThinking }, handlers)
```

(d) 将 `ToolContext` 中 `apiKey: settings.apiKey, baseUrl: settings.baseUrl` 改为 `apiKey: provider.apiKey, baseUrl: provider.baseUrl`（约 149-150 行）。

- [ ] **Step 3: 验证**

Run: `npm run typecheck`
Expected: 通过

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/chat-handler.ts
git commit -m "feat: 聊天请求改由 active provider 提供连接参数"
```

---

## Task 8: 获取模型 IPC

**Files:**
- Create: `src/main/ipc/providers-handlers.ts`
- Test: `tests/unit/parse-models.test.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts:583` 附近

- [ ] **Step 1: 写失败测试**

Create: `tests/unit/parse-models.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { parseModelsResponse } from '../../src/main/ipc/providers-handlers'

describe('parseModelsResponse', () => {
  it('解析标准 OpenAI /models 响应并排序去重', () => {
    const raw = { data: [{ id: 'b-model' }, { id: 'a-model' }, { id: 'a-model' }, { id: 42 }] }
    expect(parseModelsResponse(raw)).toEqual(['a-model', 'b-model'])
  })

  it('非对象或 data 非数组时返回空数组', () => {
    expect(parseModelsResponse(null)).toEqual([])
    expect(parseModelsResponse({ data: 'nope' })).toEqual([])
    expect(parseModelsResponse({})).toEqual([])
  })

  it('过滤空 id', () => {
    expect(parseModelsResponse({ data: [{ id: '' }, { id: 'x' }] })).toEqual(['x'])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/parse-models.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 IPC handler**

Create: `src/main/ipc/providers-handlers.ts`

```ts
import { ipcMain } from 'electron'

export interface FetchModelsResult {
  success: boolean
  models?: string[]
  error?: string
}

/** 解析 OpenAI 兼容 /models 响应 → 排序去重的模型 ID 数组（纯函数便于单测） */
export function parseModelsResponse(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return []
  const data = (raw as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  const ids = data
    .map((item) => (item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  return [...new Set(ids)].sort()
}

export function registerProviderHandlers(): void {
  ipcMain.handle('providers:fetchModels', async (_event, baseUrl: string, apiKey: string): Promise<FetchModelsResult> => {
    if (!baseUrl) return { success: false, error: 'Base URL 不能为空' }
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (res.status === 401 || res.status === 403) {
        return { success: false, error: 'API Key 无效或未授权' }
      }
      if (res.status === 404) {
        return { success: false, error: '该服务商不支持 /models 端点，请手动输入模型名' }
      }
      if (!res.ok) {
        return { success: false, error: `请求失败 (${res.status})` }
      }
      const json: unknown = await res.json()
      const models = parseModelsResponse(json)
      if (models.length === 0) {
        return { success: false, error: '接口未返回可用模型' }
      }
      return { success: true, models }
    } catch (e) {
      return { success: false, error: `网络错误：${e instanceof Error ? e.message : String(e)}` }
    }
  })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/parse-models.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: preload 暴露 API**

Modify `src/preload/index.ts`，在 `api` 对象中新增（放在 `settings` 分组后）：

```ts
  providers: {
    fetchModels: (baseUrl: string, apiKey: string): Promise<{ success: boolean; models?: string[]; error?: string }> =>
      ipcRenderer.invoke('providers:fetchModels', baseUrl, apiKey)
  },
```

- [ ] **Step 6: 主进程注册**

Modify `src/main/index.ts`：

(a) import 区新增：

```ts
import { registerProviderHandlers } from './ipc/providers-handlers'
```

(b) 在 `registerChatHandlers()`（约 583 行）附近新增一行：

```ts
registerProviderHandlers()
```

- [ ] **Step 7: 验证**

Run: `npm run typecheck`
Expected: 通过

- [ ] **Step 8: Commit**

```bash
git add src/main/ipc/providers-handlers.ts tests/unit/parse-models.test.ts src/preload/index.ts src/main/index.ts
git commit -m "feat: 新增 providers:fetchModels IPC 获取模型列表"
```

---

## Task 9: Store provider actions

**Files:**
- Modify: `src/renderer/src/store/types.ts`
- Modify: `src/renderer/src/store/useStore.ts`

- [ ] **Step 1: 扩展 StoreState 类型**

Modify `src/renderer/src/store/types.ts`：import 列表加入 `ModelProvider`（来自 `../../../shared/types`），并在 `updateSettings` 声明（约 149 行）附近新增：

```ts
  // ---- 模型服务商 ----
  switchProvider: (providerId: string, model?: string) => Promise<void>
  upsertProvider: (provider: ModelProvider) => Promise<void>
  removeProvider: (providerId: string) => Promise<void>
```

- [ ] **Step 2: 实现 actions**

Modify `src/renderer/src/store/useStore.ts`：在 `updateSettings` 实现（约 98-104 行）之后新增：

```ts
  switchProvider: async (providerId, model) => {
    const current = get().settings
    if (!current) return
    const provider = current.providers?.find((p) => p.id === providerId)
    if (!provider) return
    const nextModel = model ?? provider.models[0] ?? current.model
    const updated = {
      ...current,
      activeProviderId: providerId,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: nextModel
    }
    await window.api.settings.save(updated)
    set({ settings: updated })
  },

  upsertProvider: async (provider) => {
    const current = get().settings
    if (!current) return
    const exists = current.providers?.some((p) => p.id === provider.id)
    const providers = exists
      ? (current.providers ?? []).map((p) => (p.id === provider.id ? provider : p))
      : [...(current.providers ?? []), provider]
    const updated: typeof current = { ...current, providers }
    // 更新的是当前激活服务商时，同步顶层快照
    if (provider.id === current.activeProviderId) {
      updated.baseUrl = provider.baseUrl
      updated.apiKey = provider.apiKey
    }
    await window.api.settings.save(updated)
    set({ settings: updated })
  },

  removeProvider: async (providerId) => {
    const current = get().settings
    if (!current) return
    const providers = (current.providers ?? []).filter((p) => p.id !== providerId)
    const updated: typeof current = { ...current, providers }
    // 删除的是激活服务商时，回退到第一个
    if (current.activeProviderId === providerId) {
      const fallback = providers[0]
      if (fallback) {
        updated.activeProviderId = fallback.id
        updated.baseUrl = fallback.baseUrl
        updated.apiKey = fallback.apiKey
        updated.model = fallback.models[0] ?? current.model
      }
    }
    await window.api.settings.save(updated)
    set({ settings: updated })
  },
```

- [ ] **Step 3: 验证**

Run: `npm run typecheck`
Expected: 通过

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/store/types.ts src/renderer/src/store/useStore.ts
git commit -m "feat: store 新增 switchProvider/upsertProvider/removeProvider"
```

---

## Task 10: ModelTab 服务商管理页

**Files:**
- Modify: `src/renderer/src/components/settings/ModelTab.tsx`（418 行，整体重构）

- [ ] **Step 1: 重构为服务商管理页**

将 `ModelTab.tsx` 整体替换为「模型服务商」管理页。保留现有视觉语言（`SectionTitle` / `Divider` / `bg-bg-elevated` / `border-border-subtle`），核心结构：

```tsx
import { useState } from 'react'
import { Plus, Check, RefreshCw, Trash2, Server } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { AppSettings, ModelProvider } from '../../../../shared/types'
import { genCustomProviderId } from '../../../../shared/providers'
import { SectionTitle, Divider } from './shared-components'

/** 空表单模板 */
function emptyForm(): ModelProvider {
  return { id: '', name: '', kind: 'custom', baseUrl: '', apiKey: '', models: [], supportsThinking: false }
}

export function ModelTab({
  local,
  update
}: {
  local: AppSettings
  update: (patch: Partial<AppSettings>) => void
}): React.ReactElement {
  const switchProvider = useStore((s) => s.switchProvider)
  const upsertProvider = useStore((s) => s.upsertProvider)
  const removeProvider = useStore((s) => s.removeProvider)
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<ModelProvider>(emptyForm())
  const [fetching, setFetching] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const providers = local.providers ?? []

  /** 获取模型：拉取成功后追加去重到该服务商模型列表 */
  const handleFetchModels = async (provider: ModelProvider): Promise<void> => {
    setFetching(provider.id)
    setFetchError(null)
    try {
      const res = await window.api.providers.fetchModels(provider.baseUrl, provider.apiKey)
      if (!res.success || !res.models) {
        setFetchError(res.error ?? '获取失败')
        return
      }
      const merged = [...new Set([...provider.models, ...res.models])]
      await upsertProvider({ ...provider, models: merged })
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e))
    } finally {
      setFetching(null)
    }
  }

  const handleSaveCustom = async (): Promise<void> => {
    if (!draft.name.trim() || !draft.baseUrl.trim()) return
    const provider: ModelProvider = {
      ...draft,
      id: draft.id || genCustomProviderId(providers),
      kind: 'custom',
      supportsThinking: draft.baseUrl.includes('deepseek.com')
    }
    await upsertProvider(provider)
    setShowForm(false)
    setDraft(emptyForm())
  }

  // 每个 provider 卡片 + 「设为当前」「获取模型」「删除(仅 custom)」按钮；
  // 自定义表单（showForm 时）含「获取模型」按钮，拉取后以可勾选列表写入 draft.models。
  // 现有「推理参数」区（思考模式/强度/温度/最大 token）原样保留在页面下方。
  return (
    <div className="space-y-5">
      <SectionTitle title="模型服务商" desc="预设服务商一键切换，自定义服务商支持任意 OpenAI 兼容端点" />
      {providers.map((p) => (
        <div key={p.id} className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server size={14} className="text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">{p.name}</span>
              {p.id === local.activeProviderId && <Check size={14} className="text-accent" />}
            </div>
            <div className="flex items-center gap-1.5">
              {p.id !== local.activeProviderId && (
                <button onClick={() => void switchProvider(p.id)} className="chip text-[11px]">设为当前</button>
              )}
              <button onClick={() => void handleFetchModels(p)} disabled={fetching === p.id} className="chip text-[11px]">
                <RefreshCw size={11} className={fetching === p.id ? 'animate-spin' : ''} />
                {fetching === p.id ? '获取中' : '获取模型'}
              </button>
              {p.kind === 'custom' && (
                <button onClick={() => void removeProvider(p.id)} className="chip text-[11px] text-red-400">
                  <Trash2 size={11} /> 删除
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 space-y-1.5 text-xs text-text-muted">
            <div>Base URL：<span className="font-mono text-text-secondary">{p.baseUrl}</span></div>
            <div>API Key：<input value={p.apiKey} onChange={(e) => void upsertProvider({ ...p, apiKey: e.target.value })} className="rounded border border-border bg-bg-elevated px-2 py-0.5 text-xs text-text-primary w-56" placeholder="sk-..." /></div>
            <div className="flex flex-wrap gap-1">
              {p.models.map((m) => (
                <span key={m} className="chip text-[10px]">{m}
                  <button onClick={() => void upsertProvider({ ...p, models: p.models.filter((x) => x !== m) })} className="ml-1 text-text-muted hover:text-red-400">×</button>
                </span>
              ))}
              {p.models.length === 0 && <span className="text-text-muted">暂无模型，点击「获取模型」或手动添加</span>}
            </div>
          </div>
        </div>
      ))}

      {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="chip text-[11px]"><Plus size={11} /> 添加自定义服务商</button>
      )}

      {showForm && (
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4 space-y-2">
          <SectionTitle title="自定义服务商" desc="填写 OpenAI 兼容端点信息" />
          <div className="grid grid-cols-1 gap-2 text-xs">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="名称（如 我的网关）" className="rounded border border-border bg-bg-elevated px-2 py-1.5" />
            <input value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} placeholder="Base URL（如 https://api.example.com/v1）" className="rounded border border-border bg-bg-elevated px-2 py-1.5" />
            <input value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder="API Key" className="rounded border border-border bg-bg-elevated px-2 py-1.5" />
            <div className="flex items-center gap-1.5">
              <input value={draft.models.join(', ')} onChange={(e) => setDraft({ ...draft, models: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="模型名（逗号分隔，或用下方按钮拉取）" className="flex-1 rounded border border-border bg-bg-elevated px-2 py-1.5" />
              <button onClick={() => void handleFetchModels(draft)} disabled={fetching === draft.id} className="chip text-[11px] shrink-0">获取模型</button>
            </div>
          </div>
          <div className="flex justify-end gap-1.5">
            <button onClick={() => { setShowForm(false); setDraft(emptyForm()) }} className="chip text-[11px]">取消</button>
            <button onClick={() => void handleSaveCustom()} className="chip text-[11px] text-accent">保存</button>
          </div>
        </div>
      )}

      <Divider />
      {/* 下方保留原「推理参数」区：思考模式 / 思考强度 / 温度 / 最大 token，代码从原文件平移 */}
    </div>
  )
}
```

> 实现注意：
> 1. `window.api.providers.fetchModels` 由 Task 8 提供；TS 类型若报 `window.api.providers` 不存在，检查 `src/renderer/src/global.d.ts` 中 `window.api` 的声明并补充 `providers` 字段。
> 2. 原文件 418 行中的「推理参数」区块（`ThinkingMode` 开关、`ReasoningSlider`、温度/最大 token 行）完整保留并置于 `Divider` 下方。
> 3. 若替换后文件超过 400 行，将 ProviderCard 与 ProviderForm 拆出为同目录子组件（`ModelTab.tsx` / `ProviderCard.tsx` / `ProviderForm.tsx`），遵循 AGENTS.md 6.2。

- [ ] **Step 2: 验证**

Run: `npm run typecheck`
Expected: 通过

- [ ] **Step 3: 手动验证（dev 运行）**

Run: `npm run dev`
操作：打开设置 → 模型服务商 → 切换预设服务商（顶部快照字段变化）→ 添加自定义服务商并点「获取模型」→ 删除自定义服务商 → 回到 DeepSeek 发起对话。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/ModelTab.tsx
git commit -m "feat: ModelTab 改造为模型服务商管理页（含获取模型按钮）"
```

---

## Task 11: ModelSelector 两级下拉

**Files:**
- Modify: `src/renderer/src/components/chat-input/ModelSelector.tsx`

- [ ] **Step 1: 改为服务商→模型两级下拉**

替换 `MODEL_OPTIONS` 静态数组与下拉渲染。核心逻辑：

```tsx
import { useState, useEffect, useRef } from 'react'
import { Cpu, ChevronDown, Server } from 'lucide-react'
import { useStore } from '../../store/useStore'

export function ModelSelector(): React.ReactElement {
  const settings = useStore((s) => s.settings)
  const switchProvider = useStore((s) => s.switchProvider)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const providers = settings?.providers ?? []
  const activeProvider = providers.find((p) => p.id === settings?.activeProviderId) ?? providers[0]
  const currentModel = settings?.model ?? ''
  const display = activeProvider ? `${activeProvider.name} · ${currentModel}` : currentModel

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setExpanded(null) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className={`chip flex cursor-pointer items-center gap-1 px-2 py-1 text-[11px] ${open ? 'border-accent/40 text-accent bg-accent/8' : 'text-text-secondary hover:text-text-primary hover:border-border-hover'}`}>
        <Cpu size={11} />
        <span className="max-w-[140px] truncate">{display || '选择模型'}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 min-w-[240px] rounded-xl border border-border-subtle bg-bg-elevated shadow-glass animate-fade-scale overflow-hidden max-h-[60vh] overflow-y-auto">
          {providers.map((p) => {
            const isActive = p.id === activeProvider?.id
            const isExpanded = expanded === p.id
            return (
              <div key={p.id}>
                <button
                  onClick={() => { setExpanded(isExpanded ? null : p.id) }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-bg-hover"
                >
                  <span className="flex items-center gap-2 text-[12px] font-medium">
                    <Server size={12} className={isActive ? 'text-accent' : 'text-text-muted'} />
                    {p.name}
                    {isActive && <span className="text-[9px] text-accent">当前</span>}
                  </span>
                  <span className="text-[10px] text-text-muted">{p.models.length} 模型</span>
                </button>
                {isExpanded && p.models.map((m) => (
                  <button
                    key={m}
                    onClick={() => { void switchProvider(p.id, m); setOpen(false); setExpanded(null) }}
                    className={`flex w-full items-center gap-2 pl-8 pr-3 py-1.5 text-left text-[12px] ${m === currentModel && isActive ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover'}`}
                  >
                    <Cpu size={10} className="shrink-0" />
                    <span className="truncate">{m}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

> 行为说明：点击服务商行展开/收起其模型列表；点击模型 → `switchProvider(p.id, m)`（同步顶层快照 + 保存），关闭下拉。原 `ModelId` 联合类型 import 已不需要（`model` 为 string）。

- [ ] **Step 2: 验证**

Run: `npm run typecheck`
Expected: 通过

- [ ] **Step 3: 手动验证**

Run: `npm run dev`
操作：输入框下拉可见所有服务商与模型；切换模型后顶部快照同步；关闭重开下拉状态正确。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/chat-input/ModelSelector.tsx
git commit -m "feat: ModelSelector 改为服务商-模型两级下拉"
```

---

## Task 12: ApiTab 同步当前服务商

**Files:**
- Modify: `src/renderer/src/components/settings/ApiTab.tsx`

- [ ] **Step 1: Base URL / Key 编辑同步到 active provider**

Modify `ApiTab.tsx`：找到 `local.baseUrl` 输入（约 150 行）与 `local.apiKey` 输入（约 61 行），改为编辑 active provider 并同步顶层快照。新增辅助函数：

```tsx
/** 更新当前激活服务商的连接参数，并同步顶层快照 */
const updateActiveProviderConn = async (patch: Partial<ModelProvider>): Promise<void> => {
  const providers = local.providers ?? []
  const idx = providers.findIndex((p) => p.id === local.activeProviderId)
  if (idx < 0) return
  const next = { ...providers[idx], ...patch }
  const nextProviders = [...providers]
  nextProviders[idx] = next
  update({
    providers: nextProviders,
    baseUrl: next.baseUrl,
    apiKey: next.apiKey
  })
}
```

将 `onChange={(e) => update({ baseUrl: e.target.value })}` 替换为 `onChange={(e) => void updateActiveProviderConn({ baseUrl: e.target.value })}`，`apiKey` 同理。`update` 本身由 `SettingsModal` 传入并持久化（`updateSettings`），无需额外保存。

- [ ] **Step 2: 验证**

Run: `npm run typecheck`
Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/ApiTab.tsx
git commit -m "feat: ApiTab 编辑同步当前服务商"
```

---

## Task 13: 端到端验证与收尾

**Files:**
- 无新增/修改（仅验证）

- [ ] **Step 1: 全量单测**

Run: `npx vitest run`
Expected: 全部 PASS（providers / migrate-settings / api-body / parse-models / estimate-tokens）

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: node + web 全绿

- [ ] **Step 3: 数据迁移实测**

操作：备份 `%APPDATA%/ximo-agent/settings.json`（若存在）→ 手动构造一份旧格式（仅 `apiKey/baseUrl/model`）→ 启动 `npm run dev` → 检查 settings.json 被写回为含 `providers` 的新格式，原 Key/模型保留。

- [ ] **Step 4: 功能回归（手动）**

- DeepSeek 对话：思考链 `reasoning_content` 正常显示
- 切换 OpenAI 预设 + 有效 Key：对话正常、请求不含 `enable_thinking`
- 自定义服务商：添加 → 获取模型 → 对话
- 删除激活服务商：自动回退到剩余第一个
- 子 Agent / Vision / MCP：切换服务商后不受影响

- [ ] **Step 5: 文档同步**

Modify `README.md`：在「快速开始」与「三模式工作台」附近补充多服务商说明（预设列表、自定义、获取模型）。

```bash
git add README.md
git commit -m "docs: README 补充多模型服务商支持说明"
```

- [ ] **Step 6: 最终提交**

```bash
git status
git log --oneline -15
```

确认工作树干净、提交历史完整（预计 12 个功能提交 + 1 个文档提交）。

---

## 自审记录

- **Spec 覆盖**：设计文档第 3-9 节均有对应 Task（数据模型→T1/T9，预设表→T2，请求层→T5/T6/T7，token→T4，迁移→T3，UI→T10/T11/T12，获取模型→T8）。第 11 节验证方式→T13。
- **占位符**：无 TBD/TODO；UI 任务中标注的「平移原推理参数区」指向既有代码，属复用而非占位。
- **类型一致性**：`ModelProvider`（T1）在 T2/T3/T9/T10/T12 使用一致；`supportsThinking` 字段贯穿 ChatRequest/api.ts/supervisor；`estimateTokens(text, providerId)` 签名在 T4 定义、测试使用一致；`parseModelsResponse` 在 T8 定义与测试一致；`switchProvider/upsertProvider/removeProvider` 在 T9 定义、T10/T11 调用一致。
