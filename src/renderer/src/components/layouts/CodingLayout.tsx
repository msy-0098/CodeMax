import { useMemo, useCallback, useState, useEffect, useRef, lazy, Suspense } from 'react'
import { FolderOpen, ArrowRight, ChevronDown, FileCode2, GitBranch, Copy, Check, ExternalLink, Undo2, RotateCcw, Reply, MoreHorizontal } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { ToolPanel } from '../ToolPanel'
import { SessionBar } from '../coding/SessionBar'
import { Transcript } from '../transcript/Transcript'
import { adaptMessages, buildLiveStream } from '../../lib/transcriptAdapter'
import type { ChatMessage } from '../../../../shared/types'
import { getModelLabel } from '../../../../shared/model-label'

// 懒加载检查点浏览器 — 仅在有文件变更时才显示
const CheckpointViewer = lazy(() => import('../coding/CheckpointViewer').then(m => ({ default: m.CheckpointViewer })))
// 懒加载空状态欢迎页
const CodingWelcome = lazy(() => import('../../CodingWelcome').then(m => ({ default: m.CodingWelcome })))

// 变更摘要行
interface ChangeRow {
  fileName: string
  changeDesc: string
  additions: number
  deletions: number
}

/** 从工具结果中提取文件变更列表 */
function extractChangeRows(messages: ChatMessage[]): ChangeRow[] {
  const rows: ChangeRow[] = []
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.toolResults) {
      for (const result of msg.toolResults) {
        if (result.toolName === 'file_edit' || result.toolName === 'file_write' || result.toolName === 'multi_edit' || result.toolName === 'move_file') {
          const meta = result.metadata || {}
          const fileName = (meta.fileName as string) || (meta.filePath as string)?.split(/[/\\]/).pop() || ''
          if (fileName) {
            const additions = (meta.additions as number) ?? 0
            const deletions = (meta.deletions as number) ?? 0
            rows.push({
              fileName,
              changeDesc: result.content.slice(0, 80).replace(/\n/g, ' '),
              additions,
              deletions
            })
          }
        }
      }
    }
  }
  return rows
}

export function CodingLayout(): React.ReactElement {
  // 精确选择当前会话 — 避免订阅整个 conversations 数组
  const conversation = useStore((s) => s.conversations.find((c) => c.id === s.currentConversationId) ?? null)
  const currentConversationId = useStore((s) => s.currentConversationId)
  const isStreaming = useStore((s) => s.isStreaming)
  const streamingContent = useStore((s) => s.streamingContent)
  const streamingReasoning = useStore((s) => s.streamingReasoning)
  const streamingConversationId = useStore((s) => s.streamingConversationId)
  const streamingTokens = useStore((s) => s.streamingTokens)
  const streamingToolCalls = useStore((s) => s.streamingToolCalls)
  const streamingAssistantId = useStore((s) => s.streamingAssistantId)
  const error = useStore((s) => s.error)
  const regenerate = useStore((s) => s.regenerate)
  const sendMessage = useStore((s) => s.sendMessage)
  const projectPath = useStore((s) => s.projectPath)
  const editMessage = useStore((s) => s.editMessage)

  const fontSize = useStore((s) => s.settings?.fontSize) ?? 'md'
  const settings = useStore((s) => s.settings)
  const modelLabel = settings ? getModelLabel(settings) : '未知模型'

  const isEmpty = !conversation || conversation.messages.length === 0
  const isStreamingThis = isStreaming && streamingConversationId === conversation?.id

  const changeRows = useMemo(() => {
    if (!conversation?.messages) return []
    return extractChangeRows(conversation.messages)
  }, [conversation?.messages])

  const totalAdditions = changeRows.reduce((sum, r) => sum + r.additions, 0)
  const totalDeletions = changeRows.reduce((sum, r) => sum + r.deletions, 0)

  // ── 适配：把 ChatMessage[] 转成扁平 TranscriptItem[] ──────────────────
  // streamingToolCalls 每帧都被 runStream 重建（即使内容未变），
  // 这里按内容做稳定性处理，避免纯文本流式期间 items 全量重建。
  const streamingToolCallsKey = useMemo(() => JSON.stringify(streamingToolCalls), [streamingToolCalls])
  const stableStreamingToolCalls = useMemo(() => streamingToolCalls, [streamingToolCallsKey])
  const items = useMemo(() => {
    if (!conversation) return []
    return adaptMessages(
      conversation.messages,
      isStreamingThis ? stableStreamingToolCalls : undefined,
      isStreamingThis ? streamingAssistantId : undefined,
    )
  }, [conversation, isStreamingThis, stableStreamingToolCalls, streamingAssistantId])

  // ── 流式 LiveStream ──────────────────────────────────────────────────
  const live = useMemo(() => {
    if (!isStreamingThis || !conversation) return undefined
    const lastAssistantId = conversation.messages.length > 0
      ? conversation.messages[conversation.messages.length - 1]?.id
      : undefined
    if (!lastAssistantId) return undefined
    return buildLiveStream(lastAssistantId, streamingContent, streamingReasoning)
  }, [isStreamingThis, conversation, streamingContent, streamingReasoning])

  // ── 编辑消息回调 ──────────────────────────────────────────────────────
  const handleEditMessage = useCallback((_turn: number, text: string) => {
    // 找到对应的用户消息并调用 editMessage
    if (!conversation) return
    // turn 是从 0 开始的用户消息序号
    const userMessages = conversation.messages.filter((m: ChatMessage) => m.role === 'user')
    const target = userMessages[_turn]
    if (target) {
      // editMessage 同步更新 store，之后直接发送新文本即可
      // 保留原消息的 slashCommand 胶囊（如果存在）
      editMessage(target.id)
      void sendMessage(text, target.slashCommand ? { slashCommand: target.slashCommand } : undefined)
    }
  }, [conversation, editMessage, sendMessage])

  // 空状态 — 主入口，输入框由 GlobalChatInput 管理
  if (isEmpty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <SessionBar
          projectPath={projectPath}
          model={modelLabel}
          tokenCount={streamingTokens}
          sessionStartTime={conversation?.createdAt ?? Date.now()}
          toolCalls={streamingToolCalls}
          onRunProject={() => sendMessage('请帮我运行当前项目。先检查 package.json 中的 scripts，然后执行启动命令。', { skipNetworkHint: true })}
        />
        <div className="flex min-h-0 flex-1">
          <div className="flex-1 overflow-hidden">
            <Suspense fallback={null}>
            <CodingWelcome />
          </Suspense>
          </div>
        </div>
      </div>
    )
  }

  // 任务执行状态
  return (
    <div className={`flex min-h-0 flex-1 flex-col chat-fs-${fontSize}`}>
      {/* 头部 — 任务执行详情 */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <FileCode2 size={14} className="text-accent" />
          <span className="text-sm font-medium text-text-primary">CodeMax Code</span>
          <span className="text-xs text-text-muted">· 任务耗时 <SessionTimer startTime={conversation?.createdAt ?? Date.now()} /></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip px-2 py-0.5 text-[11px] text-text-muted">{modelLabel}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 中间主内容区 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ToolPanel />

          {/* 变更摘要区域 — 默认收起，点击展开 */}
          {changeRows.length > 0 && (
            <ChangeSummarySection
              changeRows={changeRows}
              totalAdditions={totalAdditions}
              totalDeletions={totalDeletions}
              projectPath={projectPath}
              sendMessage={sendMessage}
            />
          )}

          {/* 检查点浏览器 */}
          {currentConversationId && changeRows.length > 0 && (
          <div className="px-4 py-1.5">
            <Suspense fallback={null}>
              <CheckpointViewer sessionId={currentConversationId} />
            </Suspense>
          </div>
          )}

          {/* ── 新 Transcript 会话区 ── */}
          <Transcript
            items={items}
            live={live}
            running={isStreamingThis}
            turnStartAt={isStreamingThis ? (conversation?.messages[conversation.messages.length - 1]?.timestamp ?? Date.now()) : undefined}
            onEditMessage={handleEditMessage}
            onRegenerate={regenerate}
            canRegenerate={!isStreamingThis}
          />

          {error && <ErrorBanner message={error} />}

          {/* 操作工具条 */}
          {changeRows.length > 0 && !isStreamingThis && (
            <CodingActionBar
              changeRows={changeRows}
              projectPath={projectPath}
              sendMessage={sendMessage}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/** 会话计时器 — 独立组件避免父级重渲染 */
function SessionTimer({ startTime }: { startTime: number }): React.ReactElement {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  const seconds = Math.floor((Date.now() - startTime) / 1000)
  return <>{seconds}s</>
}

/** 变更摘要区块 — 默认收起，点击展开详情表格 */
function ChangeSummarySection({
  changeRows,
  totalAdditions,
  totalDeletions,
  projectPath,
  sendMessage
}: {
  changeRows: ChangeRow[]
  totalAdditions: number
  totalDeletions: number
  projectPath: string
  sendMessage: (text: string, options?: { skipNetworkHint?: boolean }) => Promise<void>
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-border px-4 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-xs transition-colors hover:bg-bg-hover/30 rounded-lg px-1 py-0.5"
      >
        <FolderOpen size={14} className="text-accent shrink-0" />
        <span className="text-text-secondary shrink-0">变更摘要</span>
        <span className="text-text-muted">{changeRows.length} 个文件</span>
        <span className="text-green-400 font-mono">+{totalAdditions}</span>
        <span className="text-red-400 font-mono">-{totalDeletions}</span>
        <span className="ml-auto flex items-center gap-1 text-text-muted shrink-0">
          <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {expanded && (
        <div className="mt-2">
          <div className="overflow-hidden rounded-xl border border-border-subtle">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-bg-elevated">
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">文件</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">变更</th>
                </tr>
              </thead>
              <tbody>
                {changeRows.map((row, idx) => (
                  <tr key={idx} className="border-t border-border/50">
                    <td className="px-3 py-2 text-text-primary font-mono">{row.fileName}</td>
                    <td className="px-3 py-2 text-text-muted">{row.changeDesc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ios-card mt-1.5 flex items-center gap-3 px-4 py-2">
            <span className="text-sm text-text-primary">{changeRows.length} 个文件已更改</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm font-medium text-green-400">+{totalAdditions}</span>
              <span className="text-sm font-medium text-red-400">-{totalDeletions}</span>
              <button
                onClick={() => sendMessage(`请使用 git_operations 工具查看当前项目的 diff 详细信息。${projectPath ? `仓库路径：${projectPath}` : ''}`, { skipNetworkHint: true })}
                className="icon-btn rounded-lg p-1"
                title="查看详细 Diff"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }): React.ReactElement {
  return (
    <div className="mx-4 mb-1 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-400">
      <span className="text-xs">⚠</span>
      <span className="flex-1">{message}</span>
    </div>
  )
}

/** 编程模式底部操作工具条 */
function CodingActionBar({
  changeRows,
  projectPath,
  sendMessage
}: {
  changeRows: ChangeRow[]
  projectPath: string
  sendMessage: (text: string, options?: { skipNetworkHint?: boolean }) => Promise<void>
}): React.ReactElement {
  const [showMore, setShowMore] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const handleUndo = (): void => {
    sendMessage(
      `请使用 git_operations 工具撤销最近的文件更改。${projectPath ? `仓库路径：${projectPath}` : ''}\n\n请先查看 git status，然后用 git checkout 撤销工作区修改。操作前请先确认。`,
      { skipNetworkHint: true }
    )
  }

  const handleRedo = (): void => {
    sendMessage(
      `请使用 git_operations 工具恢复最近撤销的更改。${projectPath ? `仓库路径：${projectPath}` : ''}\n\n请先查看 git stash list，然后用 git stash pop 恢复。`,
      { skipNetworkHint: true }
    )
  }

  const handleReply = (): void => {
    sendMessage('请继续完成当前任务的后续工作。', { skipNetworkHint: true })
  }

  const handleCopyChanges = (): void => {
    const text = changeRows.map((r) => `${r.fileName}: +${r.additions} -${r.deletions}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleCommit = (): void => {
    const fileList = changeRows.map((r) => r.fileName).join(', ')
    sendMessage(
      `请使用 git_operations 工具提交当前更改。${projectPath ? `仓库路径：${projectPath}` : ''}\n\n涉及的文件：${fileList}\n\n请先 git add 这些文件，然后 git commit，提交信息请根据变更内容自动生成。`,
      { skipNetworkHint: true }
    )
  }

  return (
    <div className="border-t border-border-subtle bg-bg-surface px-4 py-2">
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={handleUndo}
          className="icon-btn flex h-8 w-8 items-center justify-center rounded-full border border-border"
          title="撤销更改 (Git checkout)"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={handleRedo}
          className="icon-btn flex h-8 w-8 items-center justify-center rounded-full border border-border"
          title="重做 (Git stash pop)"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={handleReply}
          className="icon-btn flex h-8 w-8 items-center justify-center rounded-full border border-border"
          title="继续任务"
        >
          <Reply size={14} />
        </button>
        <button
          onClick={handleCopyChanges}
          className="icon-btn flex h-8 w-8 items-center justify-center rounded-full border border-border"
          title="复制变更列表"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
        <button
          onClick={handleCommit}
          className="chip flex h-8 items-center justify-center gap-1 rounded-full border-accent/30 bg-accent/10 px-3 text-accent hover:bg-accent/15 transition-all duration-200 hover:scale-105 active:scale-95"
          title="提交更改 (Git commit)"
        >
          <GitBranch size={13} />
          <span className="text-[11px]">提交</span>
        </button>
        <button
          onClick={() => setShowMore(!showMore)}
          className="icon-btn flex h-8 w-8 items-center justify-center rounded-full border border-border"
          title="更多操作"
        >
          <MoreHorizontal size={14} />
        </button>
        <span className="ml-2 text-[11px] text-text-muted">AI 可能会出错，请核实</span>
      </div>
      {showMore && (
        <div className="mt-2 flex items-center justify-center gap-2 animate-slide-up">
          <button
            onClick={() => {
              sendMessage(`请使用 git_operations 工具查看当前项目的状态。${projectPath ? `仓库路径：${projectPath}` : ''}`, { skipNetworkHint: true })
              setShowMore(false)
            }}
            className="btn-ghost rounded-lg px-2.5 py-1 text-[11px]"
          >
            <GitBranch size={11} /> Git Status
          </button>
          <button
            onClick={() => {
              sendMessage(`请使用 git_operations 工具查看当前项目的 diff。${projectPath ? `仓库路径：${projectPath}` : ''}`, { skipNetworkHint: true })
              setShowMore(false)
            }}
            className="btn-ghost rounded-lg px-2.5 py-1 text-[11px]"
          >
            <ExternalLink size={11} /> Git Diff
          </button>
          <button
            onClick={() => {
              const fileList = changeRows.map((r) => r.fileName).join(', ')
              sendMessage(`请使用 code_lint 工具检查以下文件的代码质量：${fileList}`, { skipNetworkHint: true })
              setShowMore(false)
            }}
            className="btn-ghost rounded-lg px-2.5 py-1 text-[11px]"
          >
            <Check size={11} /> 代码检查
          </button>
        </div>
      )}
    </div>
  )
}
