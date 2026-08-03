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
})
