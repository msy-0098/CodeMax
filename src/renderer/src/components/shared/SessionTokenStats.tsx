import { useEffect, useState } from 'react'
import { Activity, Database, TrendingUp, MessagesSquare, Gauge, BarChart3, Minimize2, Check } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { estimateContextTokens } from '../../../../shared/context-compress'
import type { Conversation } from '../../../../shared/types'

interface Props {
  conversation: Conversation | null
}

/**
 * 会话级 Token 统计 — 浮动在输入框底部右侧
 *
 * 上下文使用率为实时估算（字符数 / 2 ≈ tokens），压缩上下文后实时下降；
 * 其余为会话累计值（D1 不随压缩重置）：流式期间 = 会话已有累计 + 当前流式增量。
 */
export function SessionTokenStats({ conversation }: Props): React.ReactElement {
  const settings = useStore((s) => s.settings)
  const CONTEXT_WINDOW = settings?.maxContextChars ? Math.floor(settings.maxContextChars / 4) : 75_000
  const isStreaming = useStore((s) => s.isStreaming)
  const streamingConvId = useStore((s) => s.streamingConversationId)
  const streamingTokens = useStore((s) => s.streamingTokens)
  const streamingCacheHit = useStore((s) => s.streamingCacheHitTokens)
  const streamingCacheMiss = useStore((s) => s.streamingCacheMissTokens)
  const streamingPrompt = useStore((s) => s.streamingPromptTokens)
  const setShowTokenStats = useStore((s) => s.setShowTokenStats)
  const compressConversation = useStore((s) => s.compressConversation)

  const isThisStreaming = isStreaming && streamingConvId === conversation?.id

  // 压缩反馈：'' | 节省 token 数 | 'none'（无可压缩内容）
  const [compressFeedback, setCompressFeedback] = useState<number | 'none' | null>(null)
  useEffect(() => {
    if (compressFeedback === null) return
    const t = setTimeout(() => setCompressFeedback(null), 2400)
    return () => clearTimeout(t)
  }, [compressFeedback])

  // 上下文使用率 — 基于当前消息内容的实时估算（压缩后下降；不叠加 API 累计值，避免双重计数）
  const estimateTokens = estimateContextTokens(conversation?.messages ?? [])
  const contextTokens = estimateTokens
  const contextPct = (contextTokens / CONTEXT_WINDOW) * 100
  const contextColor = contextPct >= 80 ? '#ef4444'
    : contextPct >= 60 ? '#f97316'
    : contextPct >= 30 ? '#f59e0b'
    : '#22c55e'

  // 流式期间：会话已有累计 + 当前流式增量（始终是单会话累计值）
  const convTotal = conversation?.totalTokens ?? 0
  const convCacheHit = conversation?.cacheHitTokens ?? 0
  const convCacheMiss = conversation?.cacheMissTokens ?? 0
  const convPrompt = conversation?.promptTokens ?? 0

  const totalTokens = isThisStreaming
    ? convTotal + (streamingTokens ?? 0)
    : convTotal
  const cacheHitTokens = isThisStreaming
    ? convCacheHit + (streamingCacheHit ?? 0)
    : convCacheHit
  const cacheMissTokens = isThisStreaming
    ? convCacheMiss + (streamingCacheMiss ?? 0)
    : convCacheMiss
  const promptTokens = isThisStreaming
    ? convPrompt + (streamingPrompt ?? 0)
    : convPrompt

  // D1 聚合命中率 = Σhit / Σ(hit+miss)，比单轮 hit/prompt 更稳定
  const totalCacheDenom = cacheHitTokens + cacheMissTokens
  const hitRate = totalCacheDenom > 0
    ? (cacheHitTokens / totalCacheDenom) * 100
    : (promptTokens > 0 ? (cacheHitTokens / promptTokens) * 100 : 0)

  // 对话轮数 = 用户消息数（每轮以一次用户提问计）
  const turns = conversation?.messages.filter((m) => m.role === 'user').length ?? 0

  const openModal = (): void => setShowTokenStats(true)
  const chip = 'flex items-center gap-1 rounded-md bg-bg-elevated/50 px-1.5 py-0.5 transition-colors hover:bg-bg-elevated/80'

  return (
    <div className="flex w-full items-center justify-end gap-1.5 px-1 pt-1.5 text-[11px] shrink-0">
      {/* 上下文窗口占用 — 实时估算，始终显示 */}
      <button
        type="button"
        onClick={openModal}
        className={chip}
        title={`上下文窗口占用：约 ${contextTokens.toLocaleString()} / ${CONTEXT_WINDOW.toLocaleString()} tokens (${contextPct.toFixed(1)}%)，点击查看详情`}
      >
        <Gauge size={11} className="text-text-muted" />
        <span className="text-text-muted">上下文</span>
        <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-border">
          <span
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            style={{ width: `${contextTokens > 0 ? Math.max(8, Math.min(contextPct, 100)) : 0}%`, backgroundColor: contextColor }}
          />
        </span>
        <span className="font-mono" style={{ color: contextColor }}>
          {contextTokens > 0 ? contextPct.toFixed(1) : '0.0'}%
        </span>
        <span className="font-mono text-text-muted">
          {(contextTokens / 1000).toFixed(1)}k
        </span>
      </button>

      {/* 压缩上下文 */}
      {conversation && (
        <button
          type="button"
          onClick={async () => {
            const saved = await compressConversation(conversation.id)
            setCompressFeedback(saved > 0 ? saved : 'none')
          }}
          className={`${chip} ${
            typeof compressFeedback === 'number'
              ? 'text-emerald-500'
              : compressFeedback === 'none'
                ? 'text-text-muted opacity-70'
                : 'text-text-muted hover:text-accent'
          }`}
          title="压缩当前会话上下文（旧消息正文/思考链/工具结果一律截断，保留最近 6 条完整）"
        >
          {typeof compressFeedback === 'number' ? <Check size={11} /> : <Minimize2 size={11} />}
          <span>
            {typeof compressFeedback === 'number'
              ? `已压缩 -${compressFeedback.toLocaleString()} tok`
              : compressFeedback === 'none'
                ? '无需压缩'
                : '压缩'}
          </span>
        </button>
      )}

      {/* 对话轮数 */}
      <button
        type="button"
        onClick={openModal}
        className={chip}
        title="点击查看 Token 统计详情"
      >
        <MessagesSquare size={11} className="text-text-muted" />
        <span className="text-text-muted">轮数</span>
        <span className="font-mono text-text-secondary">{turns > 0 ? turns : '—'}</span>
      </button>

      {/* 总消耗 */}
      <button
        type="button"
        onClick={openModal}
        className={chip}
        title="点击查看 Token 统计详情"
      >
        <Activity size={11} className="text-text-muted" />
        <span className="text-text-muted">总消耗</span>
        <span className="font-mono text-text-secondary">{totalTokens > 0 ? totalTokens.toLocaleString() : '—'}</span>
      </button>

      {/* 缓存命中 */}
      <button
        type="button"
        onClick={openModal}
        className={chip}
        title={totalCacheDenom > 0 ? `命中 ${cacheHitTokens.toLocaleString()} / 未命中 ${cacheMissTokens.toLocaleString()}` : '点击查看 Token 统计详情'}
      >
        <Database size={11} className="text-emerald-500/70" />
        <span className="text-text-muted">缓存命中</span>
        <span className="font-mono text-emerald-500/80">{cacheHitTokens > 0 ? cacheHitTokens.toLocaleString() : '—'}</span>
      </button>

      {/* 命中率 — D1 聚合公式 */}
      <button
        type="button"
        onClick={openModal}
        className={chip}
        title={totalCacheDenom > 0 ? '聚合命中率 = Σhit / Σ(hit+miss)，不随压缩重置' : '点击查看 Token 统计详情'}
      >
        <TrendingUp size={11} className={hitRate > 50 ? 'text-emerald-500/70' : 'text-amber-500/70'} />
        <span className="text-text-muted">命中率</span>
        <span className={`font-mono ${hitRate > 50 ? 'text-emerald-500/80' : 'text-amber-500/80'}`}>
          {(totalCacheDenom > 0 || promptTokens > 0) ? `${hitRate.toFixed(1)}%` : '—'}
        </span>
      </button>

      {/* 详情入口 */}
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-text-muted transition-colors hover:text-accent"
        title="查看 Token 统计详情"
      >
        <BarChart3 size={11} />
      </button>
    </div>
  )
}
