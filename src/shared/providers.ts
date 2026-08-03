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
