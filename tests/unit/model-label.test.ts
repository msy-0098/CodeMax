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
