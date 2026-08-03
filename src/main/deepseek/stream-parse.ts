/** 单个 SSE chunk 解析出的内容（纯函数，便于单测） */
export interface ParsedChunk {
  content?: string
  reasoningContent?: string
  toolCalls?: { index: number; id?: string; name?: string; arguments?: string }[]
  finishReason?: string
  usage?: unknown
}

export function parseStreamChunk(json: unknown): ParsedChunk | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const j = json as Record<string, unknown>
  const choices = j.choices
  if (!Array.isArray(choices) || choices.length === 0) {
    if (j.usage) return { usage: j.usage }
    return null
  }
  const choice = choices[0] as Record<string, unknown>
  const delta = (choice.delta ?? choice.message) as Record<string, unknown> | undefined
  const out: ParsedChunk = {}
  if (delta && typeof delta === 'object') {
    const content = delta.content ?? delta.text
    if (typeof content === 'string' && content) out.content = content
    const rc = delta.reasoning_content
    if (typeof rc === 'string' && rc) out.reasoningContent = rc
    if (Array.isArray(delta.tool_calls)) {
      out.toolCalls = delta.tool_calls.map((tc) => {
        const t = tc as Record<string, unknown>
        const fn = (t.function ?? {}) as Record<string, unknown>
        return {
          index: typeof t.index === 'number' ? t.index : 0,
          id: typeof t.id === 'string' ? t.id : undefined,
          name: typeof fn.name === 'string' ? fn.name : undefined,
          arguments: typeof fn.arguments === 'string' ? fn.arguments : undefined
        }
      })
    }
  }
  // 非流式完整响应：choices[0].text 或 choices[0].message.content
  if (!out.content) {
    const alt = choice.text ?? (choice.message as Record<string, unknown> | undefined)?.content
    if (typeof alt === 'string' && alt) out.content = alt
  }
  if (typeof choice.finish_reason === 'string') out.finishReason = choice.finish_reason
  if (j.usage) out.usage = j.usage
  return out
}
