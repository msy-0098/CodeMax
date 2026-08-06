import type { ChatMessage, StreamChunk, ToolCall, ToolResult, StreamingSegment } from '../../../shared/types'
import { ensureAgentsLoaded } from '../agents'
import { buildApiMessages } from './buildApiMessages'
import type { StoreState } from './useStore'
import type { AgentTodo } from './useStore'

export type SetState = (
  partial: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)
) => void

/** 流式结束后的通用重置字段 */
export const STREAMING_RESET: Partial<StoreState> = {
  isStreaming: false,
  streamingContent: '',
  streamingReasoning: '',
  streamingSegments: [],
  streamingConversationId: null,
  streamingAssistantId: null,
  streamingTokens: null,
  streamingCacheHitTokens: null,
  streamingCacheMissTokens: null,
  streamingPromptTokens: null,
  streamingContextTokens: null,
  streamingToolCalls: []
}

/**
 * 构造「持久化 assistant 消息 + 重置流式状态」的 state patch。
 * 消除 cancelStream / runStream 中 5 处重复的 conversations.map + streaming reset 代码。
 */
export function buildPersistPatch(
  s: StoreState,
  conversationId: string,
  msgPatch: Partial<ChatMessage>,
  convTokens: { total: number; prompt: number; cacheHit: number; cacheMiss?: number } | null,
  error?: string,
  contextTokens?: number
): Partial<StoreState> {
  const assistantId = s.streamingAssistantId
  return {
    conversations: s.conversations.map((c) =>
      c.id === conversationId
        ? {
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId ? { ...m, ...msgPatch, timestamp: Date.now() } : m
            ),
            ...(convTokens ? {
              totalTokens: (c.totalTokens ?? 0) + convTokens.total,
              promptTokens: (c.promptTokens ?? 0) + convTokens.prompt,
              cacheHitTokens: (c.cacheHitTokens ?? 0) + convTokens.cacheHit,
              cacheMissTokens: (c.cacheMissTokens ?? 0) + (convTokens.cacheMiss ?? 0)
            } : {}),
            ...(contextTokens !== undefined ? { contextTokens: (c.contextTokens ?? 0) + contextTokens } : {}),
            updatedAt: Date.now()
          }
        : c
    ),
    ...(error !== undefined ? { error } : {}),
    ...STREAMING_RESET
  }
}

export async function runStream(
  get: () => StoreState,
  set: SetState,
  conversationId: string
): Promise<void> {
  const conversation = get().conversations.find((c) => c.id === conversationId)
  if (!conversation) return
  const settings = get().settings
  if (!settings) return

  // 按需加载专家数据（有激活专家或主 Agent 注入了专家时）
  if (get().activeExperts.length > 0 || settings.mainAgentExpertId) {
    await ensureAgentsLoaded()
  }

  const apiMessages = await buildApiMessages(
    conversation, settings.customPrompt, get().activeExperts, settings.orchestratorEnforce,
    get().browserOpen, get().computerUseRunning, get().activeStyleId,
    settings.mainAgentCustomPrompt, settings.mainAgentExpertId,
    {
      maxToolResultChars: settings.maxToolResultChars ?? 8000,
      maxContextChars: settings.maxContextChars ?? 300000,
      recentKeep: settings.contextRecentKeep ?? 5,
      snippedKeep: settings.contextSnippedKeep ?? 200,
      prunedKeep: settings.contextPrunedKeep ?? 80
    },
    settings.reasoningEffort,
    settings.memoryEnabled
  )
  const request = {
    mode: conversation.mode,
    messages: apiMessages,
    model: settings.model,
    thinkingMode: settings.thinkingMode,
    reasoningEffort: settings.reasoningEffort,
    temperature: settings.temperature,
    maxTokens: 393216,
    sessionId: conversationId,
    autoModeLevel: get().autoModeLevel
  }

  // ── Segments：按时间顺序追踪每轮 Agent Loop 的思考链、正文和工具调用 ──
  // 每轮（toolStatus:'thinking'）开启一个新 segment，确保工作步骤按顺序输出
  const segments: StreamingSegment[] = [{ reasoning: '', content: '', toolCalls: [] }]
  const currentSeg = (): StreamingSegment => segments[segments.length - 1]

  // 累积 usage — 部分服务商在流结束前最后一帧才发 usage
  let tokens: number | null = null
  let totalTokensAccum = 0
  let promptTokensAccum = 0
  let cacheHitTokensAccum = 0
  // D1 会话累计缓存未命中 — 不随压缩重置
  let cacheMissTokensAccum = 0
  // 上下文窗口 token 累计 — 每轮 API 调用的 total_tokens 累加，持久化时叠加到会话已有值
  let contextTokensAccum = 0

  // 收集本轮流式期间发生的所有工具调用和结果，用于持久化到会话
  const collectedToolCalls: ToolCall[] = []
  const collectedToolResults: ToolResult[] = []

  // 流式更新节流：把高频 chunk 合并为 ~12fps 的批量更新。
  // 之前用 rAF（~60fps）会导致流式期间整个 UI（含全部 markdown/代码高亮）每帧重渲染。
  const FLUSH_INTERVAL_MS = 80
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let lastFlushAt = 0
  let dirty = false

  const flushStreamingUpdate = (): void => {
    flushTimer = null
    lastFlushAt = Date.now()
    if (!dirty) return
    dirty = false
    // 深拷贝 segments 供 store 使用
    const segCopy: StreamingSegment[] = segments.map(s => ({
      reasoning: s.reasoning,
      content: s.content,
      toolCalls: s.toolCalls.map(tc => ({ ...tc }))
    }))
    // 同时计算扁平值，保持向后兼容（ToolPanel、CodingLayout 等仍使用扁平字段）
    const flatContent = segments.map(s => s.content).filter(Boolean).join('\n\n')
    const flatReasoning = segments.map(s => s.reasoning).filter(Boolean).join('\n\n')
    const flatToolCalls = segments.flatMap(s => s.toolCalls)
    set({
      streamingSegments: segCopy,
      streamingContent: flatContent,
      streamingReasoning: flatReasoning,
      streamingToolCalls: flatToolCalls
    })
  }

  const scheduleStreamingUpdate = (): void => {
    dirty = true
    if (flushTimer !== null) return
    // 距上次刷新不足 FLUSH_INTERVAL_MS 时延迟到满间隔，保证流式 UI 平滑且低频
    const elapsed = Date.now() - lastFlushAt
    const delay = elapsed >= FLUSH_INTERVAL_MS ? 0 : FLUSH_INTERVAL_MS - elapsed
    flushTimer = setTimeout(flushStreamingUpdate, delay)
  }

  const cancelPendingFlush = (): void => {
    if (flushTimer !== null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    dirty = false
  }

  /** 移除 'thinking' 创建的尾部空 segment */
  const trimTrailingEmpty = (): void => {
    if (segments.length > 1) {
      const last = segments[segments.length - 1]
      if (!last.reasoning && !last.content && last.toolCalls.length === 0) {
        segments.pop()
      }
    }
  }

  /** 计算持久化用的 segments（仅多轮时保留） */
  const computePersistSegments = (): StreamingSegment[] | undefined => {
    const nonEmpty = segments.filter(s => s.reasoning || s.content || s.toolCalls.length > 0)
    if (nonEmpty.length <= 1) return undefined
    return nonEmpty.map(s => ({
      reasoning: s.reasoning,
      content: s.content,
      toolCalls: s.toolCalls.map(tc => ({ ...tc, status: 'done' as const }))
    }))
  }

  const computeFlatContent = (): string => segments.map(s => s.content).filter(Boolean).join('\n\n')
  const computeFlatReasoning = (): string => segments.map(s => s.reasoning).filter(Boolean).join('\n\n')

  try {
    await window.api.chat.stream(request, (chunk: StreamChunk) => {
      // 工具流式输出（toolStatus + content 但无 toolCall）不混入 assistant 正文
      const isToolStreamUpdate = chunk.toolStatus !== undefined && chunk.toolName !== undefined && chunk.toolCall === undefined
      if (chunk.content && !isToolStreamUpdate) {
        currentSeg().content += chunk.content
        scheduleStreamingUpdate()
      }
      if (chunk.reasoningContent) {
        currentSeg().reasoning += chunk.reasoningContent
        scheduleStreamingUpdate()
      }
      if (chunk.usage) {
        tokens = chunk.usage.totalTokens
        totalTokensAccum += chunk.usage.totalTokens
        promptTokensAccum += chunk.usage.promptTokens
        cacheHitTokensAccum += chunk.usage.promptCacheHitTokens ?? 0
        cacheMissTokensAccum += chunk.usage.promptCacheMissTokens ?? 0
        contextTokensAccum += chunk.usage.totalTokens
        set({ streamingTokens: totalTokensAccum, streamingCacheHitTokens: cacheHitTokensAccum, streamingCacheMissTokens: cacheMissTokensAccum, streamingPromptTokens: promptTokensAccum, streamingContextTokens: contextTokensAccum })
      }

      // ── 工具调用状态：操作当前 segment 的 toolCalls ──
      if (chunk.toolStatus === 'calling' && chunk.toolName) {
        if (chunk.toolCall) {
          // 新工具调用 — 收集并新增到当前 segment
          collectedToolCalls.push(chunk.toolCall)
          const args = chunk.toolCall.arguments
          const argsStr = args ? JSON.stringify(args) : undefined
          currentSeg().toolCalls.push({
            name: chunk.toolName!,
            status: 'calling' as const,
            args: argsStr,
            toolCallId: chunk.toolCall.id
          })
          scheduleStreamingUpdate()
        } else {
          // 流式输出更新 — 更新当前 segment 中最后一个同名 calling 条目
          const streamContent = chunk.content
          const seg = currentSeg()
          for (let i = seg.toolCalls.length - 1; i >= 0; i--) {
            if (seg.toolCalls[i].name === chunk.toolName && seg.toolCalls[i].status === 'calling') {
              seg.toolCalls[i] = { ...seg.toolCalls[i], result: streamContent }
              break
            }
          }
          scheduleStreamingUpdate()
        }
      }

      if (chunk.toolResult) {
        // 收集工具结果用于持久化
        collectedToolResults.push(chunk.toolResult)

        // ── 提取 todo_write 工具结果 → 更新对应会话的 agentTodos ──
        if (chunk.toolResult.toolName === 'todo_write' && chunk.toolResult.success && chunk.toolResult.metadata?.todos) {
          const todos = chunk.toolResult.metadata.todos as AgentTodo[]
          if (Array.isArray(todos) && todos.length > 0 && conversationId) {
            set((s) => ({ agentTodosByConv: { ...s.agentTodosByConv, [conversationId]: todos } }))
          }
        }

        // 更新当前 segment 中对应工具调用的状态为 done
        const resultId = chunk.toolResult!.toolCallId
        const seg = currentSeg()
        let matched = false
        // 精确 ID 匹配
        for (let i = 0; i < seg.toolCalls.length; i++) {
          if (resultId && seg.toolCalls[i].toolCallId === resultId) {
            matched = true
            seg.toolCalls[i] = { ...seg.toolCalls[i], status: 'done' as const, result: chunk.toolResult!.content }
            break
          }
        }
        // 降级：按名称匹配最后一个 calling
        if (!matched) {
          for (let i = seg.toolCalls.length - 1; i >= 0; i--) {
            if (seg.toolCalls[i].name === chunk.toolResult!.toolName && seg.toolCalls[i].status === 'calling') {
              seg.toolCalls[i] = { ...seg.toolCalls[i], status: 'done' as const, result: chunk.toolResult!.content }
              break
            }
          }
        }
        scheduleStreamingUpdate()
      }

      // ── 监督审查反馈（ultra 思考强度专用）──
      if (chunk.supervision) {
        const sup = chunk.supervision
        const verdictLabel: Record<string, string> = {
          on_track: '✅ 正常',
          lazy: '⚠️ 偷懒',
          off_track: '⚠️ 跑偏',
          violation: '🚫 违规'
        }
        const formattedLines = [
          `第 ${sup.round} 轮审查：${verdictLabel[sup.verdict] ?? sup.verdict}`,
          `严重程度：${sup.severity}`
        ]
        if (sup.issues.length > 0) {
          formattedLines.push(`问题：\n${sup.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}`)
        }
        if (sup.correction) {
          formattedLines.push(`纠正指令：${sup.correction}`)
        }
        const formattedResult = formattedLines.join('\n')
        const supId = `supervision-${sup.round}`
        collectedToolCalls.push({ id: supId, name: '监督审查', arguments: { round: sup.round, verdict: sup.verdict, severity: sup.severity } })
        collectedToolResults.push({ toolCallId: supId, toolName: '监督审查', content: formattedResult, success: sup.verdict === 'on_track' })
        currentSeg().toolCalls.push({
          name: '监督审查',
          status: 'done' as const,
          args: JSON.stringify({ round: sup.round, verdict: sup.verdict, severity: sup.severity }),
          result: formattedResult,
          toolCallId: supId
        })
        scheduleStreamingUpdate()
      }

      // ── 轮次边界：toolStatus='thinking' 表示一轮结束，下一轮即将开始 ──
      if (chunk.toolStatus === 'thinking') {
        // 将当前 segment 中所有 calling 的工具标记为 done
        const seg = currentSeg()
        for (let i = 0; i < seg.toolCalls.length; i++) {
          if (seg.toolCalls[i].status === 'calling') {
            seg.toolCalls[i] = { ...seg.toolCalls[i], status: 'done' as const }
          }
        }
        // 开启新 segment，下一轮的思考链和正文将写入这里
        segments.push({ reasoning: '', content: '', toolCalls: [] })
        scheduleStreamingUpdate()
      }

      if (chunk.done) {
        // 取消待刷新的 rAF，确保最终内容立即写入
        cancelPendingFlush()
        trimTrailingEmpty()

        const allContent = computeFlatContent()
        const allReasoning = computeFlatReasoning()
        const persistSegments = computePersistSegments()

        if (chunk.error) {
          // 即使出错也持久化已累积的内容和 token 数据
          const hasTokenData = totalTokensAccum > 0
          if (get().streamingAssistantId && (allContent || allReasoning || hasTokenData)) {
            set((s) => buildPersistPatch(s, conversationId, {
              content: allContent,
              reasoningContent: allReasoning || undefined,
              segments: persistSegments,
              tokens: hasTokenData ? totalTokensAccum : undefined,
              cacheHitTokens: cacheHitTokensAccum > 0 ? cacheHitTokensAccum : undefined
            }, hasTokenData ? { total: totalTokensAccum, prompt: promptTokensAccum, cacheHit: cacheHitTokensAccum, cacheMiss: cacheMissTokensAccum } : null, chunk.error, contextTokensAccum || undefined))
            void get()._persist()
          } else {
            set({ error: chunk.error, ...STREAMING_RESET })
          }
          return
        }
        // 原地更新预插入的占位消息 — 不新建不删除，只填充内容
        const finalTokens = tokens ?? get().streamingTokens
        const hasToolData = collectedToolCalls.length > 0 || collectedToolResults.length > 0
        set((s) => buildPersistPatch(s, conversationId, {
          content: allContent || get().streamingContent,
          reasoningContent: allReasoning || undefined,
          segments: persistSegments,
          model: get().settings?.model,
          tokens: finalTokens ?? undefined,
          cacheHitTokens: cacheHitTokensAccum || undefined,
          toolCalls: hasToolData ? collectedToolCalls : undefined,
          toolResults: hasToolData ? collectedToolResults : undefined
        }, { total: totalTokensAccum, prompt: promptTokensAccum, cacheHit: cacheHitTokensAccum, cacheMiss: cacheMissTokensAccum }, undefined, contextTokensAccum || undefined))
        void get()._persist()
      }
    })
  } catch (e) {
    cancelPendingFlush()
    trimTrailingEmpty()

    const msg = e instanceof Error ? e.message : String(e)
    const allContent = computeFlatContent()
    const allReasoning = computeFlatReasoning()
    const persistSegments = computePersistSegments()
    const hasTokenData = totalTokensAccum > 0

    if (conversationId && get().streamingAssistantId && (allContent || allReasoning || hasTokenData)) {
      set((s) => buildPersistPatch(s, conversationId, {
        content: allContent,
        reasoningContent: allReasoning || undefined,
        segments: persistSegments,
        tokens: hasTokenData ? totalTokensAccum : undefined,
        cacheHitTokens: cacheHitTokensAccum > 0 ? cacheHitTokensAccum : undefined
      }, hasTokenData ? { total: totalTokensAccum, prompt: promptTokensAccum, cacheHit: cacheHitTokensAccum, cacheMiss: cacheMissTokensAccum } : null, `发送失败：${msg}`, contextTokensAccum || undefined))
      void get()._persist()
    } else {
      set({ error: `发送失败：${msg}`, ...STREAMING_RESET })
    }
  } finally {
    cancelPendingFlush()
    // 安全网：done 信号因 IPC 竞态丢失时，手动将累积内容写回占位消息
    if (get().isStreaming) {
      trimTrailingEmpty()

      const finalContent = computeFlatContent() || get().streamingContent
      const finalReasoning = computeFlatReasoning() || get().streamingReasoning
      const persistSegments = computePersistSegments()
      const hasToolData = collectedToolCalls.length > 0 || collectedToolResults.length > 0

      if (conversationId && get().streamingAssistantId && (finalContent || finalReasoning)) {
        set((s) => buildPersistPatch(s, conversationId, {
          content: finalContent,
          reasoningContent: finalReasoning || undefined,
          segments: persistSegments,
          model: get().settings?.model,
          tokens: (tokens ?? get().streamingTokens) ?? undefined,
          cacheHitTokens: cacheHitTokensAccum || undefined,
          toolCalls: hasToolData ? collectedToolCalls : undefined,
          toolResults: hasToolData ? collectedToolResults : undefined
        }, { total: totalTokensAccum, prompt: promptTokensAccum, cacheHit: cacheHitTokensAccum, cacheMiss: cacheMissTokensAccum }, undefined, contextTokensAccum || undefined))
        void get()._persist()
      } else {
        set(STREAMING_RESET)
      }
    }
    // 流式结束后：将残留的 in_progress 任务标记为 completed
    get().markTodosComplete()
  }
}
