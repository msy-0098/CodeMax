import type { ChatRequest, StreamChunk, ToolCall, ToolResult, ToolContext } from '../../shared/types'
import { toolRegistry } from '../tools'
import { isRecording, appendStep } from '../SkillStore'
import { getCheckpointStore } from '../CheckpointStore'
import { evaluate, extractSubject, getConfigForMode, YOLO_CONFIG, SAFE_CONFIG } from '../Permission'
import { callDeepSeekStream } from './api'
import { agentConfig, truncateToolResult, sanitizeContent } from './context'
import type { StreamHandlers } from './types'
import { ContextManager } from '../../shared/cache'
import type { MutableMessage } from '../../shared/cache'
import { captureShape, compareShape } from '../cache/prefix-shape'
import type { PrefixShape } from '../../shared/cache/types'
import { runSupervisionCheck, needsCorrection, buildCorrectionMessage } from './supervisor'
import type { AgentRoundSnapshot } from './supervisor'

// ---------- Agent Loop：工具调用循环 ----------

/**
 * Agent Loop — 带工具调用的主循环
 * 参考 Reasonix 的 agent.go 设计：
 *   思考 → 工具调用 → 观察 → 思考 → ... → 最终回答
 *
 * 缓存优化集成（参考 Reasonix）：
 * - A1 字节稳定前缀：消息只追加不重排
 * - A2 reasoning_content 本地保留请求剥离（空字符串 key）
 * - B1/B2 四档 compaction + stuck 暂停
 * - D2 PrefixShape 哈希诊断
 */
export async function agentLoop(
  apiKey: string,
  baseUrl: string,
  request: ChatRequest,
  handlers: StreamHandlers,
  context?: ToolContext,
  sessionId?: string
): Promise<void> {
  const { onChunk, signal } = handlers

  if (!apiKey) {
    onChunk({ done: true, error: '未配置 API Key，请前往设置填写你的 API 密钥。' })
    return
  }

  // Checkpoint: 开启新轮次（记录用户消息的检查点）
  if (sessionId && agentConfig.checkpointEnabled) {
    const store = getCheckpointStore(sessionId)
    const lastUserMsg = [...request.messages].reverse().find(m => m.role === 'user')
    const prompt = lastUserMsg?.content?.slice(0, 200) || ''
    const turn = store.nextTurn()
    store.begin(turn, prompt, request.messages.length)
  }

  // 获取该模式对应的工具
  const tools = request.tools && request.tools.length > 0 ? request.tools : undefined

  // A1 字节稳定前缀 — 消息列表只追加，不重排序、不重写字段
  const messages: MutableMessage[] = [
    ...request.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {})
    }))
  ]

  // 监督审查 — ultra 思考强度时启用
  const supervisionEnabled = request.reasoningEffort === 'ultra'
  const originalTask = messages.find(m => m.role === 'user')?.content?.slice(0, 1000) || ''

  // B1/B2 四档 compaction + stuck 保护
  const ctxManager = new ContextManager()

  // D2 PrefixShape 哈希诊断
  let lastPrefixShape: PrefixShape | null = null

  // 上下文窗口估算（tokens）— 从 maxContextChars 近似推导
  const contextWindow = agentConfig.maxContextChars > 0
    ? Math.floor(agentConfig.maxContextChars / 4)
    : 0

  let round = 0

  while (round < agentConfig.maxToolRounds) {
    if (signal?.aborted) {
      onChunk({ done: true })
      return
    }

    round++

    // D2 捕获前缀形状 — 在 API 调用前
    const systemPrompt = messages.find(m => m.role === 'system')?.content || ''
    const prefixShape = captureShape(systemPrompt, tools || [], ctxManager.rewriteVersion)
    const prevShape = lastPrefixShape ?? prefixShape

    // 单次 API 调用
    const result = await callDeepSeekStream(
      apiKey,
      baseUrl,
      request.model,
      messages,
      tools,
      request.thinkingMode,
      request.reasoningEffort,
      request.supportsThinking ?? true,
      request.temperature,
      request.maxTokens,
      handlers
    )

    // D2 诊断对比 — 每轮 API 调用后
    const cacheDiag = compareShape(prevShape, prefixShape, result.usage)
    if (cacheDiag.prefixChanged || result.usage) {
      onChunk({ cacheDiagnostics: cacheDiag })
    }
    lastPrefixShape = prefixShape

    // B1/B2 maybeCompact — 每轮 API 调用后根据 usage 决定是否压缩
    if (result.usage && contextWindow > 0) {
      const compactStats = ctxManager.maybeCompact({
        messages,
        config: {
          maxToolResultChars: agentConfig.maxToolResultChars,
          maxContextChars: agentConfig.maxContextChars,
          recentKeep: agentConfig.recentKeep,
          snippedKeep: agentConfig.snippedKeep,
          prunedKeep: agentConfig.prunedKeep
        },
        promptTokens: result.usage.promptTokens,
        contextWindow
      })
      if (compactStats.tier === 'soft') {
        onChunk({ toolStatus: 'thinking', toolName: 'context' })
      }
    }

    // 错误处理
    if (result.finishReason === 'error') {
      onChunk({ done: true, error: result.error })
      return
    }

    // LLM 直接返回文本（无工具调用） → 结束
    if (result.finishReason === 'stop' || result.finishReason === 'length') {
      onChunk({ done: true })
      return
    }

    // LLM 请求调用工具
    if (result.finishReason === 'tool_calls' && result.toolCalls.length > 0) {
      // 通知前端：正在执行工具
      for (const tc of result.toolCalls) {
        onChunk({ toolStatus: 'calling', toolName: tc.name, toolCall: tc })
      }

      // A2 reasoning_content 本地保留请求剥离（空字符串 key）
      // thinking 模式下 assistant tool_calls turn 缺 reasoning_content key 会 400
      // 策略：key 必存在，值恒为空字符串 — 既满足 API 又不污染前缀
      const assistantMsg: MutableMessage = {
        role: 'assistant',
        content: result.content || '',
        tool_calls: result.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
        }))
      }
      // thinking 模式下 tool_calls turn 必须带 reasoning_content key（空字符串）
      if (request.thinkingMode && request.reasoningEffort !== 'off') {
        assistantMsg.reasoning_content = ''
      }
      messages.push(assistantMsg)

      // 监督审查 — 在工具执行期间并行运行（非阻塞）
      let supervisionPromise: ReturnType<typeof runSupervisionCheck> | null = null
      if (supervisionEnabled && !signal?.aborted) {
        const snapshot: AgentRoundSnapshot = {
          round,
          originalTask,
          reasoning: result.reasoningContent,
          content: result.content,
          toolCalls: result.toolCalls.map(tc => ({ name: tc.name, args: JSON.stringify(tc.arguments).slice(0, 300) })),
          toolResults: []
        }
        supervisionPromise = runSupervisionCheck(apiKey, baseUrl, request.model, request.reasoningEffort, request.supportsThinking ?? true, snapshot, signal)
      }

      // 权限引擎 — 按规则评估每个工具调用：allow / ask / deny
      const permConfig = handlers.autoModeLevel === 'yolo' || handlers.yoloMode
        ? YOLO_CONFIG
        : handlers.autoModeLevel === 'safe'
          ? SAFE_CONFIG
          : getConfigForMode(request.mode)
      const cancelledIds = new Set<string>()
      for (const tc of result.toolCalls) {
        const subject = extractSubject(tc.name, tc.arguments)
        const decision = evaluate(permConfig, tc.name, subject)

        if (decision === 'deny') {
          cancelledIds.add(tc.id)
          const deniedResult: ToolResult = {
            toolCallId: tc.id,
            toolName: tc.name,
            content: '此工具在当前模式下被禁止执行',
            success: false,
            error: '权限拒绝：该工具在当前模式下不可用'
          }
          onChunk({ toolResult: deniedResult, toolStatus: 'done', toolName: tc.name })
          messages.push({
            role: 'tool',
            content: '此工具在当前模式下被禁止执行',
            tool_call_id: tc.id
          })
        } else if (decision === 'ask' && handlers.requestConfirmation) {
          const toolLabel = tc.name.replace(/_/g, ' ')
          const argSummary = Object.entries(tc.arguments)
            .slice(0, 3)
            .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v)?.slice(0, 60)}`)
            .join(', ')
          const confirmed = await handlers.requestConfirmation(tc.name, `工具: ${toolLabel}\n参数: ${argSummary || '(无)'}`)
          if (!confirmed) {
            cancelledIds.add(tc.id)
            const cancelledResult: ToolResult = {
              toolCallId: tc.id,
              toolName: tc.name,
              content: '用户取消了此操作',
              success: false,
              error: '用户取消执行'
            }
            onChunk({ toolResult: cancelledResult, toolStatus: 'done', toolName: tc.name })
            messages.push({
              role: 'tool',
              content: '用户取消了此操作',
              tool_call_id: tc.id
            })
          }
        }
      }

      // 并行执行所有未取消的工具调用
      const activeCalls = result.toolCalls.filter((tc) => !cancelledIds.has(tc.id))
      const execResults = await Promise.allSettled(
        activeCalls.map(async (tc): Promise<{ tc: ToolCall; result: ToolResult }> => {
          const tool = toolRegistry.get(tc.name)
          if (!tool) {
            return { tc, result: { toolCallId: tc.id, toolName: tc.name, content: '', success: false, error: `未知工具：${tc.name}` } }
          }

          // Checkpoint: writer 工具执行前记录文件快照
          if (sessionId && agentConfig.checkpointEnabled) {
            const store = getCheckpointStore(sessionId)
            const writerTools = ['file_edit', 'file_write', 'multi_edit', 'move_file', 'file_delete']
            if (writerTools.includes(tc.name)) {
              const filePath = (tc.arguments.filePath as string) || (tc.arguments.sourcePath as string) || ''
              if (filePath) {
                const { resolve, normalize } = await import('path')
                await store.snapshot(normalize(resolve(filePath)))
              }
            }
          }

          const toolResult = await tool.execute(tc, onChunk, signal, context)
          return { tc, result: toolResult }
        })
      )

      // 按顺序处理结果
      for (let i = 0; i < execResults.length; i++) {
        const item = execResults[i]
        const tc = activeCalls[i]

        if (item.status === 'fulfilled') {
          const { result: toolResult } = item.value
          onChunk({ toolResult, toolStatus: 'done', toolName: tc.name })

          // 录制钩子
          if (isRecording() && tc.name !== 'skill_record' && tc.name !== 'skill_invoke') {
            appendStep({
              tool: tc.name,
              arguments: tc.arguments,
              description: toolResult.success ? undefined : toolResult.error
            })
          }

          // 工具执行失败时，将 error 信息作为 content 传给 LLM
          const toolContent = toolResult.success
            ? toolResult.content
            : (toolResult.error || toolResult.content || '工具执行失败')
          messages.push({
            role: 'tool',
            content: sanitizeContent(truncateToolResult(toolContent)),
            tool_call_id: tc.id
          })
        } else {
          const msg = item.reason instanceof Error ? item.reason.message : String(item.reason)
          const errorResult: ToolResult = {
            toolCallId: tc.id,
            toolName: tc.name,
            content: '',
            success: false,
            error: msg
          }
          onChunk({ toolResult: errorResult, toolStatus: 'done', toolName: tc.name })
          messages.push({
            role: 'tool',
            content: `Error: ${msg}`,
            tool_call_id: tc.id
          })
        }
      }

      // 监督审查 — 收集并行运行的监督结果（工具执行期间已完成或即将完成）
      if (supervisionPromise) {
        const supervisionResult = await supervisionPromise
        if (supervisionResult) {
          onChunk({
            supervision: {
              verdict: supervisionResult.verdict,
              issues: supervisionResult.issues,
              correction: supervisionResult.correction,
              severity: supervisionResult.severity,
              round
            }
          })
          if (needsCorrection(supervisionResult)) {
            messages.push({
              role: 'system',
              content: buildCorrectionMessage(supervisionResult, round)
            })
          }
        }
      }

      // 工具执行完毕，继续下一轮循环
      onChunk({ toolStatus: 'thinking' })
      continue
    }

    // 理论上不应该到这里
    onChunk({ done: true })
    return
  }

  // 达到最大轮次，强制再请求一次让 LLM 总结（不传 tools，防止再次触发工具调用）
  onChunk({ toolStatus: 'thinking' })
  messages.push({
    role: 'user',
    content: '你已经完成了所有工具调用。请基于已有信息直接给出最终回答，不要再调用任何工具。'
  })
  const finalResult = await callDeepSeekStream(
    apiKey, baseUrl, request.model, messages, undefined,
    request.thinkingMode, request.reasoningEffort, request.supportsThinking ?? true, request.temperature, request.maxTokens, handlers
  )
  if (finalResult.finishReason === 'error') {
    onChunk({ done: true, error: finalResult.error })
  } else {
    onChunk({ done: true })
  }
}
