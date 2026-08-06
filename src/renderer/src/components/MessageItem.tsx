import { memo, useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { Check, ChevronDown, Copy, RotateCcw, Brain, Cpu, Search, Code2, PenTool, Loader2, FileText, Edit3, Pencil, FolderTree, SearchCode, Terminal, GitBranch, CheckCircle, FolderSearch, AlertTriangle } from 'lucide-react'
import type { ChatMessage, StreamingSegment } from '../../../shared/types'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useTypingReveal } from '../hooks/useTypingReveal'

// 懒加载工具结果卡片 — 含 CodeBlock + InlineFileEdit，仅在展开工具结果时才需要
const ToolResultCard = lazy(() => import('./shared/ToolResultCard').then(m => ({ default: m.ToolResultCard })))
// 懒加载截图预览 — 仅在点击截图放大时才需要
const ScreenshotPreview = lazy(() => import('./ScreenshotPreview').then(m => ({ default: m.ScreenshotPreview })))

interface MessageItemProps {
  message: ChatMessage
  isStreaming?: boolean
  streamingContent?: string
  streamingReasoning?: string
  streamingToolCalls?: { name: string; status: 'thinking' | 'calling' | 'done'; args?: string; result?: string }[]
  /** 流式工作步骤（按时间顺序，每轮 Agent Loop 一个 segment） */
  streamingSegments?: StreamingSegment[]
  isLast?: boolean
  canRegenerate?: boolean
  onRegenerate?: () => void
  /** 编辑用户消息回调 */
  onEditMessage?: (messageId: string) => void
  /** 是否在消息内渲染工具结果卡片（ReasonixMessage 设为 false 以避免重复） */
  showToolResults?: boolean
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Search size={14} />,
  code_execute: <Code2 size={14} />,
  ui_generate: <PenTool size={14} />,
  file_read: <FileText size={14} />,
  file_write: <Edit3 size={14} />,
  file_edit: <Pencil size={14} />,
  file_delete: <Edit3 size={14} />,
  multi_edit: <Pencil size={14} />,
  move_file: <FolderTree size={14} />,
  todo_write: <CheckCircle size={14} />,
  file_list: <FolderTree size={14} />,
  file_search: <SearchCode size={14} />,
  terminal_exec: <Terminal size={14} />,
  git_operations: <GitBranch size={14} />,
  code_lint: <CheckCircle size={14} />,
  project_context: <FolderSearch size={14} />,
  screen_capture: <Cpu size={14} />,
  browser_screenshot: <Search size={14} />,
  browser_navigate: <Search size={14} />,
  design_preview: <PenTool size={14} />,
  design_critique: <PenTool size={14} />,
  design_audit: <PenTool size={14} />,
  design_a11y: <PenTool size={14} />,
  design_color: <PenTool size={14} />,
  network_capture: <Search size={14} />,
  web_fetch: <Search size={14} />,
  web_research: <Search size={14} />
}

const TOOL_LABELS: Record<string, string> = {
  web_search: '联网搜索',
  code_execute: '代码执行',
  ui_generate: 'UI 生成',
  file_read: '读取文件',
  file_write: '写入文件',
  file_edit: '编辑文件',
  file_delete: '删除文件',
  multi_edit: '批量编辑',
  move_file: '移动文件',
  todo_write: '任务列表',
  file_list: '列出文件',
  file_search: '搜索文件',
  terminal_exec: '终端执行',
  git_operations: 'Git 操作',
  code_lint: '代码检查',
  project_context: '项目上下文',
  screen_capture: '屏幕截图',
  browser_screenshot: '浏览器截图',
  browser_navigate: '浏览器导航',
  design_preview: '设计预览',
  design_critique: '设计审查',
  design_audit: '质量审计',
  design_a11y: '无障碍检查',
  design_color: '颜色分析',
  network_capture: '网络抓包',
  web_fetch: '网页抓取',
  web_research: '深度研究'
}

/** 单个工具调用卡片（优化版：默认展开完成的工具，减少点击） */
function ToolCallCard({ tc }: { tc: { name: string; status: string; args?: string; result?: string } }): React.ReactElement {
  const isDone = tc.status === 'done'
  const isCalling = tc.status === 'calling'

  // 优化：完成的工具默认展开结果，减少用户点击
  const [expanded, setExpanded] = useState(isDone)

  let queryLabel = ''
  if (tc.args) {
    try {
      const parsed = JSON.parse(tc.args)
      queryLabel = parsed.query || parsed.question || parsed.url || ''
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs cursor-pointer transition-all duration-200 ${
          isDone
            ? 'border-green-500/30 bg-green-500/10 text-green-400'
            : isCalling
              ? 'border-accent/30 bg-accent/10 text-accent'
              : 'border-border-subtle bg-bg-surface/60 text-text-muted'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {isCalling ? (
          <Loader2 size={13} className="animate-spin text-accent" />
        ) : isDone ? (
          <Check size={13} className="text-green-400" />
        ) : (
          <span className="text-text-muted">{TOOL_ICONS[tc.name] || <Cpu size={14} />}</span>
        )}
        <span className="font-medium">{TOOL_LABELS[tc.name] || tc.name}</span>
        {queryLabel && (
          <span className="text-text-muted/70 truncate max-w-[150px] text-[11px]">"{queryLabel}"</span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <span className={`text-[11px] ${isDone ? 'text-green-400' : isCalling ? 'text-accent' : 'text-text-muted'}`}>
            {isCalling ? '执行中' : isDone ? '完成' : '准备'}
          </span>
          {(tc.args || tc.result) && (
            <ChevronDown size={11} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          )}
        </span>
      </div>
      {expanded && (tc.args || tc.result) && (
        <div className="mt-1.5 rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-xs animate-fade-in">
          {tc.args && (
            <div className="mb-2">
              <span className="font-medium text-text-secondary">参数：</span>
              <code className="block mt-1 text-[11px] text-text-muted break-all">{tc.args}</code>
            </div>
          )}
          {tc.result && (
            <div>
              <span className="font-medium text-text-secondary">结果：</span>
              <p className="mt-1 text-[11px] text-text-muted whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {tc.result.length > 800 ? tc.result.slice(0, 800) + '\n\n...' : tc.result}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 工具结果分组 — 收纳 ToolResultCard 列表，默认收起 */
function CollapsedToolResults({ results }: { results: import('../../../shared/types').ToolResult[] }): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const count = results.length
  // 摘要：提取文件名列表
  const fileNames = results
    .map(r => (r.metadata?.fileName as string) || (r.metadata?.filePath as string)?.split(/[/\\]/).pop() || r.toolName)
    .filter(Boolean)
  const summary = fileNames.slice(0, 2).join(', ') + (fileNames.length > 2 ? ` 等${fileNames.length}项` : '')

  return (
    <div className="mt-2 rounded-xl border border-border-subtle bg-bg-surface/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-bg-hover/50"
      >
        <CheckCircle size={13} className="text-green-500/70 shrink-0" />
        <span className="text-text-secondary shrink-0">工具结果</span>
        <span className="text-text-muted">{count}</span>
        {summary && (
          <span className="text-text-muted/70 truncate">· {summary}</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-text-muted shrink-0">
          <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border-subtle/50 px-2 py-1.5 space-y-1">
          {results.map((result, i) => (
            <Suspense key={`${result.toolCallId}-${i}`} fallback={null}>
              <ToolResultCard result={result} />
            </Suspense>
          ))}
        </div>
      )}
    </div>
  )
}

/** 工具错误分组 — 将失败的工具结果收纳为可折叠区块，去重避免刷屏 */
function CollapsedToolErrors({ results }: { results: import('../../../shared/types').ToolResult[] }): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

  // 按错误内容去重，统计每个错误出现的次数
  const deduped = useMemo(() => {
    const map = new Map<string, { error: string; toolName: string; count: number }>()
    for (const r of results) {
      const key = r.error || r.content || ''
      const existing = map.get(key)
      if (existing) {
        existing.count++
      } else {
        map.set(key, { error: key, toolName: r.toolName, count: 1 })
      }
    }
    return Array.from(map.values())
  }, [results])

  const totalErrors = results.length
  const uniqueErrors = deduped.length

  return (
    <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-red-500/8"
      >
        <AlertTriangle size={13} className="text-red-400/70 shrink-0" />
        <span className="text-red-400 shrink-0">工具错误</span>
        <span className="text-red-400/60">{totalErrors}</span>
        {uniqueErrors < totalErrors && (
          <span className="text-red-400/50">（{uniqueErrors} 种）</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-red-400/50 shrink-0">
          <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {expanded && (
        <div className="border-t border-red-500/10 px-2 py-1.5 space-y-1">
          {deduped.map((err, i) => (
            <div key={i} className="rounded-lg bg-red-500/5 px-2.5 py-1.5 text-xs text-red-400">
              {err.count > 1 && (
                <span className="text-red-400/50 mr-1">[{err.count}×]</span>
              )}
              {err.error}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 工具调用分组 — 将多个 ToolCallCard 收纳为一个可折叠区块 */
function ToolCallGroup({ calls }: { calls: { name: string; status: string; args?: string; result?: string }[] }): React.ReactElement {
  const callingCount = calls.filter(c => c.status === 'calling').length
  const doneCount = calls.filter(c => c.status === 'done').length
  const thinkingCount = calls.filter(c => c.status === 'thinking').length
  const total = calls.length
  const allDone = doneCount === total && callingCount === 0 && thinkingCount === 0

  // 正在调用时默认展开，完成后自动折叠 — 跟踪用户手动操作以避免覆盖
  const [expanded, setExpanded] = useState(callingCount > 0)
  const userOverridden = useRef(false)
  const prevActive = useRef(callingCount > 0 || thinkingCount > 0)

  useEffect(() => {
    const wasActive = prevActive.current
    const nowActive = callingCount > 0 || thinkingCount > 0
    prevActive.current = nowActive

    if (nowActive && !wasActive) userOverridden.current = false

    if (nowActive) {
      if (!userOverridden.current) setExpanded(true)
    } else if (allDone && !userOverridden.current) {
      setExpanded(false)
    }
  }, [callingCount, thinkingCount, allDone])

  // 摘要：最近一次工具名
  const lastCall = calls[calls.length - 1]
  const lastLabel = TOOL_LABELS[lastCall?.name] || lastCall?.name || ''

  // 摘要状态文本
  let statusText: string
  if (callingCount > 0) {
    statusText = `执行中…`
  } else if (thinkingCount > 0) {
    statusText = `思考中…`
  } else {
    statusText = `${doneCount}/${total} 完成`
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface/40 overflow-hidden">
      {/* 摘要栏 */}
      <button
        onClick={() => { userOverridden.current = true; setExpanded(!expanded) }}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-bg-hover/50"
      >
        {callingCount > 0 || thinkingCount > 0 ? (
          <Loader2 size={13} className="animate-spin text-accent shrink-0" />
        ) : (
          <CheckCircle size={13} className="text-green-500/70 shrink-0" />
        )}
        <span className="text-text-secondary shrink-0">工具调用</span>
        <span className="text-text-muted">{total}</span>
        {lastLabel && (
          <span className="text-text-muted/70 truncate">· {lastLabel}</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-text-muted shrink-0">
          {statusText}
          <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {/* 展开后的详细列表 */}
      {expanded && (
        <div className="border-t border-border-subtle/50 px-2 py-1.5 space-y-1.5">
          {calls.map((tc, i) => (
            <ToolCallCard key={`${tc.name}-${i}`} tc={tc} />
          ))}
        </div>
      )}
    </div>
  )
}

/** 单个工作步骤区块 — 渲染一轮的思考链、工具调用和正文 */
function SegmentBlock({
  segment,
  isStreaming,
  showReasoning,
  onToggleReasoning
}: {
  segment: StreamingSegment
  isStreaming: boolean
  showReasoning: boolean
  onToggleReasoning: () => void
}): React.ReactElement {
  return (
    <>
      {/* 思考过程（可折叠） */}
      {segment.reasoning && (
        <div className="mb-2 overflow-hidden rounded-xl border border-border-subtle bg-bg-surface">
          <button
            onClick={onToggleReasoning}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            <Brain size={13} className="text-accent" />
            <span>思考过程</span>
            <ChevronDown
              size={13}
              className={`ml-auto transition-transform ${showReasoning ? 'rotate-180' : ''}`}
            />
          </button>
          {(showReasoning || isStreaming) && (
            <div className="border-t border-border-subtle px-3 py-2 text-xs leading-relaxed text-text-muted">
              <p className="whitespace-pre-wrap">{segment.reasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* 工具调用指示器 */}
      {segment.toolCalls.length > 0 && (
        <div className="mb-2">
          <ToolCallGroup calls={segment.toolCalls} />
        </div>
      )}

      {/* 内容 */}
      <div className="overflow-x-auto">
        {segment.content ? (
          <MarkdownRenderer content={segment.content} />
        ) : isStreaming && !segment.reasoning ? (
          <div className="flex items-center gap-1 py-2">
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60" />
          </div>
        ) : null}
      </div>

      {/* 流式光标 */}
      {isStreaming && segment.content && (
        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-full bg-accent align-middle shadow-[0_0_8px_var(--glow-color)]" />
      )}
    </>
  )
}

export const MessageItem = memo(function MessageItem({
  message,
  isStreaming = false,
  streamingContent = '',
  streamingReasoning = '',
  streamingToolCalls = [],
  streamingSegments = [],
  canRegenerate = false,
  onRegenerate,
  onEditMessage,
  showToolResults = true
}: MessageItemProps): React.ReactElement {
  // 正文内容：流式期间用累积的 streamingContent，结束后用最终 message.content
  const content = isStreaming ? streamingContent : message.content
  // 打字机平滑显示 — 纯展示层，流式期间逐字 reveal
  const revealedContent = useTypingReveal(content, isStreaming)

  const [copied, setCopied] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const handleCopy = (): void => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  // 收集消息中的截图 — memoized 避免每次 render 重建数组
  const screenshots = useMemo<string[]>(() => {
    if (!message.toolResults) return []
    const result: string[] = []
    for (const r of message.toolResults) {
      if (r.screenshot) result.push(r.screenshot)
    }
    return result
  }, [message.toolResults])

  // 用户消息
  if (message.role === 'user') {
    return (
      <div className="group/msg flex justify-end animate-fade-scale">
        <div className="max-w-[80%] rounded-[22px] rounded-br-md bg-gradient-to-br from-accent to-accent-hover px-4 py-3 text-white shadow-lg shadow-accent/20 edge-light">
          {message.slashCommand && (
            <span
              className="mb-1.5 inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium"
              title={message.slashCommand.systemHint}
            >
              {message.slashCommand.cmd.replace(/^\//, '')}
            </span>
          )}
          <p className="whitespace-pre-wrap break-words leading-relaxed" style={{ fontSize: 'var(--chat-font-size, 15px)' }}>
            {message.content}
          </p>
        </div>
        {onEditMessage && (
          <button
            onClick={() => onEditMessage(message.id)}
            className="ml-1 self-center opacity-0 group-hover/msg:opacity-100 icon-btn rounded-lg p-1 text-text-muted hover:text-accent transition-all"
            title="编辑消息"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
    )
  }

  // 助手消息
  const reasoning = isStreaming ? streamingReasoning : message.reasoningContent

  // 确定是否按 segment 顺序渲染（多轮 Agent Loop 时）
  const segmentsToRender: StreamingSegment[] | null = (() => {
    if (isStreaming && streamingSegments) {
      const nonEmpty = streamingSegments.filter(s => s.reasoning || s.content || s.toolCalls.length > 0)
      if (nonEmpty.length > 1) return nonEmpty
    }
    if (!isStreaming && message.segments && message.segments.length > 1) {
      return message.segments
    }
    return null
  })()

  return (
    <div className="flex gap-3 animate-fade-in">
      {/* 头像 */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-muted shadow-md shadow-accent/25 edge-light">
        <Cpu size={16} className="text-white" />
      </div>

      <div className="min-w-0 flex-1">
        {/* 模型标签 */}
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary">
            CodeMax
          </span>
          {message.model && !isStreaming && (
            <span className="chip px-1.5 py-0.5 text-[10px] text-text-muted">
              {message.model}
            </span>
          )}
        </div>

        {segmentsToRender ? (
          /* ── 多轮工作步骤：按时间顺序渲染每个 segment ── */
          <>{segmentsToRender.map((seg, idx) => (
            <SegmentBlock
              key={idx}
              segment={seg}
              isStreaming={isStreaming && idx === segmentsToRender.length - 1}
              showReasoning={showReasoning}
              onToggleReasoning={() => setShowReasoning(!showReasoning)}
            />
          ))}</>
        ) : (
          /* ── 单轮：原有布局（思考链 → 工具调用 → 正文） ── */
          <>
            {/* 思考过程（可折叠） */}
            {reasoning && (
              <div className="mb-2 overflow-hidden rounded-xl border border-border-subtle bg-bg-surface">
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary transition-colors hover:text-text-primary"
                >
                  <Brain size={13} className="text-accent" />
                  <span>思考过程</span>
                  <ChevronDown
                    size={13}
                    className={`ml-auto transition-transform ${showReasoning ? 'rotate-180' : ''}`}
                  />
                </button>
                {(showReasoning || isStreaming) && (
                  <div className="border-t border-border-subtle px-3 py-2 text-xs leading-relaxed text-text-muted">
                    <p className="whitespace-pre-wrap">{reasoning}</p>
                  </div>
                )}
              </div>
            )}

            {/* 工具调用指示器 — 收纳为可折叠分组 */}
            {streamingToolCalls.length > 0 && (
              <div className="mb-2">
                <ToolCallGroup calls={streamingToolCalls} />
              </div>
            )}

            {/* 内容 */}
            <div className="overflow-x-auto">
              {content ? (
                <MarkdownRenderer content={revealedContent} streaming={isStreaming} />
              ) : isStreaming && !reasoning ? (
                <div className="flex items-center gap-1 py-2">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60" />
                </div>
              ) : null}
            </div>

            {/* 流式光标 */}
            {isStreaming && content && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-full bg-accent align-middle shadow-[0_0_8px_var(--glow-color)]" />
            )}
          </>
        )}

        {/* 截图预览缩略图 */}
        {screenshots.length > 0 && !isStreaming && (
          <div className="mt-2 flex flex-wrap gap-2">
            {screenshots.map((dataUrl, i) => (
              <button
                key={i}
                onClick={() => setScreenshotUrl(dataUrl)}
                className="overflow-hidden rounded-lg border border-border hover:border-accent/40 transition-colors"
              >
                <img src={dataUrl} alt={`截图 ${i + 1}`} className="h-24 w-auto object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* 工具结果中的错误 — 收纳为可折叠分组，避免大量重复错误刷屏 */}
        {message.toolResults && !isStreaming && (() => {
          const errorResults = message.toolResults.filter(r => !r.success && r.error && !r.screenshot)
          if (errorResults.length === 0) return null
          return <CollapsedToolErrors results={errorResults} />
        })()}

        {/* 内联工具结果卡片 — 收纳为可折叠分组（仅非 segment 消息时渲染） */}
        {showToolResults && !segmentsToRender && message.toolResults && !isStreaming && (() => {
          const visibleResults = message.toolResults.filter(r => r.success && (r.content?.trim() || r.screenshot))
          if (visibleResults.length === 0) return null
          return <CollapsedToolResults results={visibleResults} />
        })()}

        {/* 操作栏 */}
        {!isStreaming && content && (
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="icon-btn flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
            >
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              {copied ? '已复制' : '复制'}
            </button>
            {canRegenerate && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="icon-btn flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
              >
                <RotateCcw size={13} />
                重新生成
              </button>
            )}
            {message.tokens && (
              <span className="chip ml-1 px-1.5 py-0.5 text-[10px] text-text-muted">
                {message.tokens} tokens
              </span>
            )}
          </div>
        )}
      </div>

      {/* 截图全屏预览弹窗 */}
      {screenshotUrl && (
        <Suspense fallback={null}>
          <ScreenshotPreview
            dataUrl={screenshotUrl}
            onClose={() => setScreenshotUrl(null)}
          />
        </Suspense>
      )}
    </div>
  )
})
