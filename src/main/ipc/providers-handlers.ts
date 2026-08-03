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
