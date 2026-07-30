import type { ChatRequest, StreamChunk, TestResult, ToolDefinition } from '../../shared/types'
import { errorResult, collectToolCalls, sanitizeContent } from './context'
import type { StreamHandlers, SingleCallResult } from './types'

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
    // reasoning_effort 控制：high=高, max=最高
    // 根据用户需求，采用 OpenAI 格式 reasoning_effort 参数
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

// ---------- 兼容旧接口：无工具调用的简单流式（向后兼容）----------

/**
 * 简单流式聊天（无 Agent Loop / 无工具调用）
 * 保留用于不需要工具的场景
 */
export async function streamChat(
  apiKey: string,
  baseUrl: string,
  request: ChatRequest,
  handlers: StreamHandlers
): Promise<void> {
  const { onChunk, signal } = handlers

  if (!apiKey) {
    onChunk({ done: true, error: '未配置 API Key，请前往设置填写你的 DeepSeek API 密钥。' })
    return
  }

  const result = await callDeepSeekStream(
    apiKey,
    baseUrl,
    request.model,
    request.messages.map((m) => ({ role: m.role, content: m.content })),
    undefined, // 无工具
    request.thinkingMode,
    request.reasoningEffort,
    request.temperature,
    request.maxTokens,
    { onChunk, signal }
  )

  if (result.finishReason === 'error') {
    onChunk({ done: true, error: result.error })
  } else {
    onChunk({ done: true })
  }
}

// ---------- 连接测试 ----------

export async function testConnection(
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<TestResult> {
  if (!apiKey) {
    return { success: false, message: '未填写 API Key' }
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const start = Date.now()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false
      })
    })

    const latency = Date.now() - start

    if (!response.ok) {
      let errText = ''
      try {
        errText = await response.text()
        const errJson = JSON.parse(errText)
        errText = errJson?.error?.message || errText
      } catch { /* keep raw */ }
      return { success: false, message: `请求失败 (${response.status})：${errText || response.statusText}`, latency }
    }

    const data = await response.json()
    const replyModel = data?.model || model

    return { success: true, message: '连接成功，API Key 有效', latency, model: replyModel }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: `网络错误：${msg}。请检查 Base URL 或网络连接。`, latency: Date.now() - start }
  }
}
