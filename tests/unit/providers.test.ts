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
