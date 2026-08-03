import { describe, it, expect } from 'vitest'
import { parseStreamChunk, shouldRetryWithoutStreamOptions } from '../../src/main/deepseek/stream-parse'

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
