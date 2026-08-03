import type { AppSettings, ModelProvider } from './types'

/** 返回当前激活服务商；无匹配时返回 undefined */
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
  return settings.model
}
