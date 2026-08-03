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

  // 仅 deepseek 端点匹配预设（旧版默认即 deepseek 服务商）；其他 URL 一律按自定义服务商迁移
  const preset = PROVIDER_PRESETS.find((p) => p.baseUrl === baseUrl && isDeepSeek)
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
