import type { StreamChunk, ToolDefinition, ToolCall } from '../shared/types'

// ---------- 类型 ----------

export interface StreamHandlers {
  onChunk: (chunk: StreamChunk) => void
  signal?: AbortSignal
  /** 敏感工具执行前的用户确认回调，返回 true=允许执行，false=取消 */
  requestConfirmation?: (toolName: string, message: string) => Promise<boolean>
  /** YOLO 模式：跳过所有确认 */
  yoloMode?: boolean
  /** Auto Mode 等级：off=手动确认, safe=读操作自动, yolo=全部自动 */
  autoModeLevel?: 'off' | 'safe' | 'yolo'
}

/** 单次 API 调用的结果 */
export interface SingleCallResult {
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error'
  content: string
  reasoningContent: string
  toolCalls: ToolCall[]
  usage?: StreamChunk['usage']
  error?: string
}

// ---------- 工具函数 ----------

/** 构造错误返回值 */
export function errorResult(error: string): SingleCallResult {
  return { finishReason: 'error', content: '', reasoningContent: '', toolCalls: [], error }
}

/** 从流式累积的 toolCallsAcc 中收集最终 ToolCall[] */
export function collectToolCalls(acc: Map<number, { id: string; name: string; arguments: string }>): ToolCall[] {
  return Array.from(acc.values()).map((tc) => {
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(tc.arguments) } catch { /* keep empty */ }
    return { id: tc.id, name: tc.name, arguments: args } as ToolCall
  })
}

/**
 * 净化文本内容，移除会导致 API JSON 解析失败的不可见字符。
 */
export function sanitizeContent(text: string): string {
  if (!text) return text
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '\uFFFD')
}

// ---------- 底层：单次流式 API 调用 ----------

/**
 * 调用 DeepSeek Chat Completions API（流式，支持 tools）
 * 返回完整结果，同时通过 onChunk 实时推送内容增量
 */
export async function callDeepSeekStream(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: { role: string; content: string; tool_calls?: unknown; tool_call_id?: string }[],
  tools: ToolDefinition[] | undefined,
  thinkingMode: boolean,
  reasoningEffort: 'off' | 'high' | 'max',
  temperature: number,
  maxTokens: number,
  handlers: StreamHandlers
): Promise<SingleCallResult> {
  const { onChunk, signal } = handlers

  if (!apiKey) {
    return errorResult('未配置 API Key。')
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`

  // 净化所有消息内容，移除不可见字符防止 API JSON 解析失败
  const sanitizedMessages = messages.map((m) => ({
    ...m,
    content: sanitizeContent(m.content)
  }))

  const body: Record<string, unknown> = {
    model,
    messages: sanitizedMessages,
    stream: true,
    max_tokens: maxTokens,
    stream_options: { include_usage: true }
  }

  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))
    body.tool_choice = 'auto'
  }

  if (!thinkingMode || reasoningEffort === 'off') {
    body.temperature = temperature
  } else {
    body.enable_thinking = true
    body.reasoning_effort = reasoningEffort
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return errorResult(`网络请求失败：${msg}`)
  }

  if (!response.ok) {
    let errText = ''
    try {
      errText = await response.text()
      const errJson = JSON.parse(errText)
      errText = errJson?.error?.message || errText
    } catch { /* keep raw */ }
    return errorResult(`API 请求失败 (${response.status})：${errText || response.statusText}`)
  }

  if (!response.body) {
    return errorResult('API 返回了空响应体。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  // 累积结果
  let content = ''
  let reasoningContent = ''
  const toolCallsAcc = new Map<number, { id: string; name: string; arguments: string }>()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let lineEnd: number
      while ((lineEnd = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEnd).trim()
        buffer = buffer.slice(lineEnd + 1)

        if (!line || line.startsWith(':')) continue
        if (!line.startsWith('data:')) continue

        const data = line.slice(5).trim()
        if (data === '[DONE]') {
          // 流结束
          const tcArray = collectToolCalls(toolCallsAcc)

          if (tcArray.length > 0) {
            return { finishReason: 'tool_calls', content, reasoningContent, toolCalls: tcArray }
          }
          return { finishReason: 'stop', content, reasoningContent, toolCalls: [] }
        }

        try {
          const json = JSON.parse(data)
          const choice = json.choices?.[0]
          const delta = choice?.delta

          // 文本内容
          if (delta?.content) {
            content += delta.content
            onChunk({ content: delta.content })
          }
          // 思考链
          if (delta?.reasoning_content) {
            reasoningContent += delta.reasoning_content
            onChunk({ reasoningContent: delta.reasoning_content })
          }

          // 工具调用增量（流式累积）
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolCallsAcc.has(idx)) {
                toolCallsAcc.set(idx, { id: tc.id ?? '', name: '', arguments: '' })
              }
              const acc = toolCallsAcc.get(idx)!
              if (tc.id) acc.id = tc.id
              if (tc.function?.name) acc.name += tc.function.name
              if (tc.function?.arguments) acc.arguments += tc.function.arguments
            }
          }

          // usage — 解析缓存命中 token
          if (json.usage) {
            const cachedTokens = json.usage.prompt_tokens_details?.cached_tokens ?? 0
            onChunk({
              usage: {
                promptTokens: json.usage.prompt_tokens ?? 0,
                completionTokens: json.usage.completion_tokens ?? 0,
                totalTokens: json.usage.total_tokens ?? 0,
                promptCacheHitTokens: cachedTokens
              }
            })
          }

          // finish_reason
          if (choice?.finish_reason) {
            const fr = choice.finish_reason

            // 收集最终的 tool_calls
            const tcArray = collectToolCalls(toolCallsAcc)

            if (fr === 'tool_calls' || tcArray.length > 0) {
              return { finishReason: 'tool_calls', content, reasoningContent, toolCalls: tcArray }
            }
            if (fr === 'stop') {
              return { finishReason: 'stop', content, reasoningContent, toolCalls: [] }
            }
            if (fr === 'length') {
              return { finishReason: 'length', content, reasoningContent, toolCalls: [] }
            }
          }
        } catch {
          // 不完整的 JSON，跳过
        }
      }
    }
    // 流自然结束（无 finish_reason）
    const tcArray = collectToolCalls(toolCallsAcc)
    if (tcArray.length > 0) {
      return { finishReason: 'tool_calls', content, reasoningContent, toolCalls: tcArray }
    }
    return { finishReason: 'stop', content, reasoningContent, toolCalls: [] }
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return { finishReason: 'stop', content, reasoningContent, toolCalls: [] }
    }
    const msg = e instanceof Error ? e.message : String(e)
    return { finishReason: 'error', content, reasoningContent, toolCalls: [], error: `流式读取中断：${msg}` }
  }
}
