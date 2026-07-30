import type { ChatMessage } from '../../../shared/types'
import type { StoreState } from './types'

/** Zustand set 函数类型 */
export type SetState = (
  partial: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)
) => void

/** 生成唯一 ID */
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 从用户消息文本生成会话标题 */
export function makeTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 24 ? clean.slice(0, 24) + '…' : clean || '新对话'
}

/** 流式结束后的通用重置字段 */
export const STREAMING_RESET: Partial<StoreState> = {
  isStreaming: false,
  streamingContent: '',
  streamingReasoning: '',
  streamingConversationId: null,
  streamingAssistantId: null,
  streamingTokens: null,
  streamingCacheHitTokens: null,
  streamingPromptTokens: null,
  streamingToolCalls: []
}

/**
 * 构造「持久化 assistant 消息 + 重置流式状态」的 state patch。
 * 消除 cancelStream / runStream 中重复的 conversations.map + streaming reset 代码。
 */
export function buildPersistPatch(
  s: StoreState,
  conversationId: string,
  msgPatch: Partial<ChatMessage>,
  convTokens: { total: number; prompt: number; cacheHit: number } | null,
  error?: string
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
              cacheHitTokens: (c.cacheHitTokens ?? 0) + convTokens.cacheHit
            } : {}),
            updatedAt: Date.now()
          }
        : c
    ),
    ...(error !== undefined ? { error } : {}),
    ...STREAMING_RESET
  }
}
