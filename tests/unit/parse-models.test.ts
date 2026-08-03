import { describe, it, expect } from 'vitest'
import { parseModelsResponse } from '../../src/main/ipc/providers-handlers'

describe('parseModelsResponse', () => {
  it('解析标准 OpenAI /models 响应并排序去重', () => {
    const raw = { data: [{ id: 'b-model' }, { id: 'a-model' }, { id: 'a-model' }, { id: 42 }] }
    expect(parseModelsResponse(raw)).toEqual(['a-model', 'b-model'])
  })

  it('非对象或 data 非数组时返回空数组', () => {
    expect(parseModelsResponse(null)).toEqual([])
    expect(parseModelsResponse({ data: 'nope' })).toEqual([])
    expect(parseModelsResponse({})).toEqual([])
  })

  it('过滤空 id', () => {
    expect(parseModelsResponse({ data: [{ id: '' }, { id: 'x' }] })).toEqual(['x'])
  })
})
