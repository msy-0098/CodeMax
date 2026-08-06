import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Eye, MessageSquare, Bot, User, Settings, Scissors } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { buildApiMessages } from '../../store/buildApiMessages'
import type { ApiMessage } from '../../../../shared/types'

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Bot }> = {
  system: { label: 'System', color: 'text-purple-400', icon: Settings },
  user: { label: 'User', color: 'text-blue-400', icon: User },
  assistant: { label: 'AI', color: 'text-emerald-400', icon: Bot },
  tool: { label: 'Tool', color: 'text-amber-400', icon: Settings }
}

function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 2)
}

/** 上下文预览器 — 展示发送给模型的完整消息列表 */
export function ContextInspector(): React.ReactElement {
  const conversation = useStore((s) => s.conversations.find((c) => c.id === s.currentConversationId) ?? null)
  const settings = useStore((s) => s.settings)
  const browserOpen = useStore((s) => s.browserOpen)
  const computerUseRunning = useStore((s) => s.computerUseRunning)
  const activeStyleId = useStore((s) => s.activeStyleId)
  const activeExperts = useStore((s) => s.activeExperts)

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [apiMessages, setApiMessages] = useState<ApiMessage[] | null>(null)
  const [loading, setLoading] = useState(false)

  const loadMessages = async (): Promise<void> => {
    if (!conversation || !settings) return
    setLoading(true)
    try {
      const msgs = await buildApiMessages(
        conversation,
        settings.customPrompt,
        activeExperts,
        settings.orchestratorEnforce,
        browserOpen,
        computerUseRunning,
        activeStyleId,
        settings.mainAgentCustomPrompt,
        settings.mainAgentExpertId,
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
      setApiMessages(msgs)
    } catch {
      setApiMessages([])
    } finally {
      setLoading(false)
    }
  }

  const totalTokens = useMemo(() => {
    if (!apiMessages) return 0
    return apiMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
  }, [apiMessages])

  if (!conversation) {
    return <div className="py-8 text-center text-xs text-text-muted">请先选择一个会话</div>
  }

  if (!apiMessages) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Eye size={24} className="text-text-muted" />
        <p className="text-xs text-text-muted">点击下方按钮加载当前会话发送给模型的完整上下文</p>
        <button
          onClick={loadMessages}
          disabled={loading}
          className="rounded-lg border border-border-subtle bg-bg-elevated/50 px-4 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-50"
        >
          {loading ? '加载中...' : '加载上下文预览'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* 汇总栏 */}
      <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-elevated/40 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <MessageSquare size={12} />
          <span>{apiMessages.length} 条消息</span>
          <span className="text-text-muted/60">·</span>
          <span>约 {totalTokens.toLocaleString()} tokens</span>
        </div>
        <button
          onClick={loadMessages}
          className="text-[10px] text-accent hover:underline"
        >
          刷新
        </button>
      </div>

      {/* 消息列表 */}
      <div className="space-y-1">
        {apiMessages.map((msg, idx) => {
          const config = ROLE_CONFIG[msg.role] || ROLE_CONFIG.system
          const Icon = config.icon
          const tokens = estimateTokens(msg.content)
          const isExpanded = expandedIdx === idx
          const isSnipped = msg.content.includes('[...已自动截断') || msg.content.includes('[...已省略') || msg.content.includes('[...上下文已压缩')
          const isSystemPrompt = msg.role === 'system' && idx === 0

          return (
            <button
              key={idx}
              type="button"
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              className="flex w-full flex-col rounded-lg border border-border-subtle bg-bg-elevated/30 px-3 py-2 text-left transition-colors hover:bg-bg-elevated/60"
            >
              <div className="flex w-full items-center gap-2">
                {isExpanded ? <ChevronDown size={12} className="text-text-muted shrink-0" /> : <ChevronRight size={12} className="text-text-muted shrink-0" />}
                <Icon size={12} className={`shrink-0 ${config.color}`} />
                <span className={`text-[11px] font-medium ${config.color} shrink-0`}>{config.label}</span>
                {isSnipped && <span title="此消息已被截断"><Scissors size={10} className="text-amber-500 shrink-0" /></span>}
                {msg.tool_call_id && <span className="text-[9px] text-text-muted/60 truncate">id:{msg.tool_call_id.slice(0, 8)}</span>}
                <span className="flex-1 truncate text-[11px] text-text-muted">
                  {isSystemPrompt ? `System Prompt (${(msg.content.length / 1024).toFixed(1)}KB)` : msg.content.slice(0, 80)}
                </span>
                <span className="shrink-0 text-[10px] font-mono text-text-muted/60">{tokens.toLocaleString()}</span>
              </div>
              {isExpanded && (
                <pre className="mt-2 max-h-64 w-full overflow-auto whitespace-pre-wrap break-all rounded-md bg-bg-surface/80 p-2 text-[11px] text-text-secondary">
                  {msg.content}
                </pre>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
