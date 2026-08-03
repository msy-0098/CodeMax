import { describe, it, expect } from 'vitest'
import { estimateTokens } from '../../src/main/deepseek/tokenizer'

describe('estimateTokens', () => {
  it('非 deepseek 服务商按 字符数/4 近似', () => {
    expect(estimateTokens('', 'openai')).toBe(0)
    expect(estimateTokens('hello world', 'openai')).toBe(3) // ceil(11/4)
    expect(estimateTokens('中文测试文本长度较长这个示例文本内容', 'qwen')).toBe(5) // ceil(18/4)
  })

  it('deepseek 服务商走 BPE；分词器不可用时回退近似', () => {
    const n = estimateTokens('你好，世界', 'deepseek')
    expect(n).toBeGreaterThan(0)
  })
})
