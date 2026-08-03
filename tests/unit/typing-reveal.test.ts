import { describe, it, expect } from 'vitest'
import { nextRevealLength } from '../../src/renderer/src/hooks/useTypingReveal'

describe('nextRevealLength', () => {
  it('未赶上全量时按步进推进', () => {
    expect(nextRevealLength(0, 10, 3)).toBe(3)
    expect(nextRevealLength(6, 10, 3)).toBe(9)
  })
  it('不超过全量长度', () => {
    expect(nextRevealLength(9, 10, 3)).toBe(10)
    expect(nextRevealLength(12, 10, 3)).toBe(12)
  })
  it('空内容返回 0', () => {
    expect(nextRevealLength(0, 0, 3)).toBe(0)
  })
})
