import { useMemo, useState } from 'react'
import { BarChart3, X, TrendingUp, MessageSquare, Coins, Database, Cpu } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Conversation, Mode } from '../../../shared/types'
import { ContextInspector } from './shared/ContextInspector'

const MODE_LABELS: Record<Mode, string> = {
  office: '办公',
  coding: '编程',
  design: '设计'
}

const MODE_COLORS: Record<Mode, string> = {
  office: 'text-blue-400',
  coding: 'text-emerald-400',
  design: 'text-purple-400'
}

/** 会话级 token 权威值：优先会话累计（含全部 API 调用，覆盖自定义中转站等），缺失时回退到消息级累计 */
function convTokenTotal(conv: Conversation): number {
  if (conv.totalTokens && conv.totalTokens > 0) return conv.totalTokens
  return conv.messages.reduce((s, m) => s + (m.tokens ?? 0), 0)
}

interface Stats {
  totalTokens: number
  totalMessages: number
  totalAssistant: number
  cacheHit: number
  cacheMiss: number
  byMode: Record<Mode, number>
  byModel: { model: string; tokens: number }[]
  sortedDays: [string, number][]
  maxDayTokens: number
}

/** Token 统计面板 — 汇总全量对话的 token 用量（含缓存命中、按模型/中转站分布） */
export function TokenStatsModal(): React.ReactElement | null {
  const show = useStore((s) => s.showTokenStats)
  const setShow = useStore((s) => s.setShowTokenStats)
  const conversations = useStore((s) => s.conversations)

  const [activeTab, setActiveTab] = useState<'stats' | 'context'>('stats')

  const stats: Stats = useMemo(() => {
    let totalTokens = 0
    let totalMessages = 0
    let totalAssistant = 0
    let cacheHit = 0
    let cacheMiss = 0
    const byMode: Record<Mode, number> = { office: 0, coding: 0, design: 0 }
    const byModel: Record<string, number> = {}
    const byDay: Record<string, number> = {}

    for (const conv of conversations) {
      // 会话级权威 token 累计（自定义中转站等所有 API 调用都计入）
      const convTokens = convTokenTotal(conv)
      totalTokens += convTokens
      byMode[conv.mode] = (byMode[conv.mode] ?? 0) + convTokens
      cacheHit += conv.cacheHitTokens ?? 0
      cacheMiss += conv.cacheMissTokens ?? 0

      for (const msg of conv.messages) {
        totalMessages++
        if (msg.role === 'assistant') totalAssistant++
        // 按模型/中转站归类（消息记录中带模型名）
        if (msg.tokens && msg.tokens > 0) {
          const key = msg.model && msg.model !== 'unknown' ? msg.model : '其他'
          byModel[key] = (byModel[key] ?? 0) + msg.tokens
          const day = new Date(msg.timestamp).toLocaleDateString('zh-CN')
          byDay[day] = (byDay[day] ?? 0) + msg.tokens
        }
      }
    }

    const sortedDays = Object.entries(byDay).sort((a, b) => b[1] - a[1]).slice(0, 7)
    const maxDayTokens = sortedDays.length > 0 ? sortedDays[0][1] : 1

    return {
      totalTokens,
      totalMessages,
      totalAssistant,
      cacheHit,
      cacheMiss,
      byMode,
      byModel: Object.entries(byModel)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([model, tokens]) => ({ model, tokens })),
      sortedDays,
      maxDayTokens
    }
  }, [conversations])

  if (!show) return null

  const cacheDenom = stats.cacheHit + stats.cacheMiss
  const hitRate = cacheDenom > 0 ? (stats.cacheHit / cacheDenom) * 100 : 0
  const maxModelTokens = stats.byModel.length > 0 ? stats.byModel[0].tokens : 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      onClick={() => setShow(false)}
    >
      <div
        className="mx-4 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-xl animate-fade-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <BarChart3 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {activeTab === 'stats' ? 'Token 用量统计' : '上下文预览'}
              </h3>
              <p className="text-[11px] text-text-muted">
                {activeTab === 'stats' ? '会话累计 · 含自定义中转站等全部 API 调用' : '查看发送给模型的完整消息列表'}
              </p>
            </div>
          </div>
          <button onClick={() => setShow(false)} className="icon-btn rounded-lg p-1.5 hover:bg-bg-hover">
            <X size={16} />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex shrink-0 border-b border-border-subtle px-5">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-2 text-xs font-medium transition-colors ${activeTab === 'stats' ? 'border-b-2 border-accent text-accent' : 'text-text-muted hover:text-text-primary'}`}
          >
            统计概览
          </button>
          <button
            onClick={() => setActiveTab('context')}
            className={`px-3 py-2 text-xs font-medium transition-colors ${activeTab === 'context' ? 'border-b-2 border-accent text-accent' : 'text-text-muted hover:text-text-primary'}`}
          >
            上下文预览
          </button>
        </div>

        {/* 滚动内容 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {activeTab === 'context' ? (
            <ContextInspector />
          ) : (
            <>
          {/* 汇总卡片 */}
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border-subtle bg-bg-elevated/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <Coins size={13} className="text-accent" />
                总 Tokens（API 累计）
              </div>
              <div className="mt-1 text-xl font-bold text-text-primary">{stats.totalTokens.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-elevated/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <MessageSquare size={13} className="text-blue-400" />
                消息数 / AI 回复
              </div>
              <div className="mt-1 text-xl font-bold text-text-primary">
                {stats.totalMessages}
                <span className="ml-1 text-xs font-normal text-text-muted">/ {stats.totalAssistant}</span>
              </div>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-elevated/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <Database size={13} className="text-emerald-500/80" />
                缓存命中
              </div>
              <div className="mt-1 text-xl font-bold text-emerald-500/90">{stats.cacheHit.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-elevated/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <TrendingUp size={13} className="text-amber-500/80" />
                命中率
              </div>
              <div className="mt-1 text-xl font-bold text-text-primary">
                {cacheDenom > 0 ? `${hitRate.toFixed(1)}%` : '—'}
                <span className="ml-1 text-xs font-normal text-text-muted">未命中 {stats.cacheMiss.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 按模式分布 */}
          <div className="mb-4">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">按模式分布</h4>
            <div className="space-y-2">
              {(['office', 'coding', 'design'] as Mode[]).map((mode) => {
                const tokens = stats.byMode[mode] ?? 0
                const percent = stats.totalTokens > 0 ? (tokens / stats.totalTokens) * 100 : 0
                return (
                  <div key={mode} className="flex items-center gap-2">
                    <span className={`w-10 text-xs font-medium ${MODE_COLORS[mode]}`}>{MODE_LABELS[mode]}</span>
                    <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-bg-elevated border border-border-subtle">
                      <div
                        className="absolute inset-y-0 left-0 rounded-lg bg-accent/20 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-text-secondary">
                        {tokens.toLocaleString()} ({percent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 按模型/中转站分布 */}
          {stats.byModel.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">按模型 / 中转站分布</h4>
              <div className="space-y-1.5">
                {stats.byModel.map(({ model, tokens }) => {
                  const percent = (tokens / maxModelTokens) * 100
                  return (
                    <div key={model} className="flex items-center gap-2">
                      <span className="flex w-40 min-w-0 items-center gap-1 text-[11px] text-text-secondary">
                        <Cpu size={11} className="shrink-0 text-accent" />
                        <span className="truncate">{model}</span>
                      </span>
                      <div className="relative h-4 flex-1 overflow-hidden rounded bg-bg-elevated border border-border-subtle">
                        <div
                          className="absolute inset-y-0 left-0 rounded bg-accent/15 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-20 text-right text-[10px] text-text-secondary">{tokens.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 按天分布 */}
          {stats.sortedDays.length > 0 && (
            <div>
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">近 7 天用量</h4>
              <div className="space-y-1.5">
                {stats.sortedDays.map(([day, tokens]) => (
                  <div key={day} className="flex items-center gap-2">
                    <span className="w-20 text-[11px] text-text-muted">{day}</span>
                    <div className="relative h-4 flex-1 overflow-hidden rounded bg-bg-elevated border border-border-subtle">
                      <div
                        className="absolute inset-y-0 left-0 rounded bg-accent/15 transition-all duration-500"
                        style={{ width: `${(tokens / stats.maxDayTokens) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-[10px] text-text-secondary">{tokens.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.totalTokens === 0 && (
            <div className="py-8 text-center text-xs text-text-muted">
              暂无 Token 使用记录
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
