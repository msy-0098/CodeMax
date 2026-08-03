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
