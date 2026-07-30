import { Activity, Database, TrendingUp, MessagesSquare } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Conversation } from '../../../../shared/types'

interface Props {
  conversation: Conversation | null
}

/**
 * 会话级 Token 统计 — 浮动在输入框底部右侧
 *
 * 始终显示会话累计值：
 * - 流式期间 = 会话已有累计 + 当前流式增量
 * - 非流式 = 会话累计
 */
export function SessionTokenStats({ conversation }: Props): React.ReactElement {
  const isStreaming = useStore((s) => s.isStreaming)
  const streamingConvId = useStore((s) => s.streamingConversationId)
  const streamingTokens = useStore((s) => s.streamingTokens)
  const streamingCacheHit = useStore((s) => s.streamingCacheHitTokens)
  const streamingPrompt = useStore((s) => s.streamingPromptTokens)

  const isThisStreaming = isStreaming && streamingConvId === conversation?.id

  // 流式期间：会话已有累计 + 当前流式增量（始终是单会话累计值）
  const convTotal = conversation?.totalTokens ?? 0
  const convCacheHit = conversation?.cacheHitTokens ?? 0
  const convPrompt = conversation?.promptTokens ?? 0

  const totalTokens = isThisStreaming
    ? convTotal + (streamingTokens ?? 0)
    : convTotal
  const cacheHitTokens = isThisStreaming
    ? convCacheHit + (streamingCacheHit ?? 0)
    : convCacheHit
  const promptTokens = isThisStreaming
    ? convPrompt + (streamingPrompt ?? 0)
    : convPrompt

  const hitRate = promptTokens > 0 ? (cacheHitTokens / promptTokens) * 100 : 0

  // 对话轮数 = 用户消息数（每轮以一次用户提问计）
  const turns = conversation?.messages.filter((m) => m.role === 'user').length ?? 0

  return (
    <div className="flex items-center justify-end gap-2.5 px-1 pt-1 text-[11px] shrink-0">
      {/* 对话轮数 */}
      <div className="flex items-center gap-1">
        <MessagesSquare size={11} className="text-text-muted" />
        <span className="text-text-muted">轮数</span>
        <span className="font-mono text-text-secondary">{turns > 0 ? turns : '—'}</span>
      </div>
      <span className="text-text-muted/20">|</span>
      {/* 总消耗 */}
      <div className="flex items-center gap-1">
        <Activity size={11} className="text-text-muted" />
        <span className="text-text-muted">总消耗</span>
        <span className="font-mono text-text-secondary">{totalTokens > 0 ? totalTokens.toLocaleString() : '—'}</span>
      </div>
      <span className="text-text-muted/20">|</span>
      {/* 缓存命中 */}
      <div className="flex items-center gap-1">
        <Database size={11} className="text-emerald-500/70" />
        <span className="text-text-muted">缓存命中</span>
        <span className="font-mono text-emerald-500/80">{cacheHitTokens > 0 ? cacheHitTokens.toLocaleString() : '—'}</span>
      </div>
      <span className="text-text-muted/20">|</span>
      {/* 命中率 */}
      <div className="flex items-center gap-1">
        <TrendingUp size={11} className={hitRate > 50 ? 'text-emerald-500/70' : 'text-amber-500/70'} />
        <span className="text-text-muted">命中率</span>
        <span className={`font-mono ${hitRate > 50 ? 'text-emerald-500/80' : 'text-amber-500/80'}`}>
          {promptTokens > 0 ? `${hitRate.toFixed(1)}%` : '—'}
        </span>
      </div>
    </div>
  )
}
