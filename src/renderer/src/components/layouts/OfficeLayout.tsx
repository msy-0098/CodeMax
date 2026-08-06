import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { MODE_CONFIGS } from '../../modes'
import { MessageItem } from '../MessageItem'
import { ToolPanel } from '../ToolPanel'
import { useCappedMessages } from '../../hooks/useCappedMessages'
import type { Mode } from '../../../../shared/types'
import { getModelLabel } from '../../../../shared/model-label'

// 功能胶囊按钮（空状态下隐藏导出，因为无内容可导出）— 纯文字简约风
const CAPSULE_ACTIONS = [
    { id: 'ppt', label: '生成 PPT', prompt: '请帮我生成一份PPT大纲和内容。主题：[请填写主题]\n\n请先给出PPT的目录结构，然后逐页生成内容（每页包含标题、要点和备注）。' },
    { id: 'data', label: '数据分析', prompt: '请帮我进行数据分析。请先描述数据来源和分析目的，我将使用搜索工具获取相关数据并进行分析：\n\n分析主题：[请填写]\n关注指标：[请填写]' },
    { id: 'research', label: '深度研究', prompt: '请对以下话题进行深度研究：[话题]\n\n请搜索多个来源、综合分析后生成研究摘要，包含背景、现状、趋势和结论。' },
    { id: 'doc', label: '生成文档', prompt: '请帮我生成一份专业文档。\n\n文档类型：[报告/方案/纪要/说明书]\n主题：[请填写]\n受众：[请填写]\n\n请输出结构清晰、专业得体的文档。' }
  ]

/** 技能录制与复用 + 语义化桌面操控 — 后台工具切换（不发 Prompt 给 Agent）— 纯文字简约风 */
const SKILL_CAPSULES = [
{ id: 'record', label: '录制技能', action: 'toggleRecording' as const },
{ id: 'invoke', label: '调用技能', action: 'invokeSkill' as const },
{ id: 'desktop', label: '操控电脑', action: 'toggleComputerUse' as const },
{ id: 'browser', label: '内嵌浏览器', action: 'toggleBrowser' as const },
]

export function OfficeLayout(): React.ReactElement {
  // 精确选择当前会话 — 避免订阅整个 conversations 数组
  const conversation = useStore((s) => s.conversations.find((c) => c.id === s.currentConversationId) ?? null)
  const currentMode = useStore((s) => s.currentMode)
  const isStreaming = useStore((s) => s.isStreaming)
  const streamingContent = useStore((s) => s.streamingContent)
  const streamingReasoning = useStore((s) => s.streamingReasoning)
  const streamingConversationId = useStore((s) => s.streamingConversationId)
  const streamingToolCalls = useStore((s) => s.streamingToolCalls)
  const streamingSegments = useStore((s) => s.streamingSegments)
  const error = useStore((s) => s.error)
  const regenerate = useStore((s) => s.regenerate)
  const editMessage = useStore((s) => s.editMessage)
  const fontSize = useStore((s) => s.settings?.fontSize) ?? 'md'
  const sendMessage = useStore((s) => s.sendMessage)
  const openProject = useStore((s) => s.openProject)
  const setProjectPath = useStore((s) => s.setProjectPath)
  const projectPath = useStore((s) => s.projectPath)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 只渲染最近 N 条消息，长对话下避免 DOM 无限增长 / 流式时全量遍历历史
  const { visible, hiddenCount, loadEarlier } = useCappedMessages(conversation?.messages ?? [], scrollRef)

  // 后台工具切换 actions
  const toggleBrowser = useStore((s) => s.toggleBrowser)
  const toggleBrowserRecording = useStore((s) => s.toggleBrowserRecording)
  const toggleComputerUse = useStore((s) => s.toggleComputerUse)
  const browserOpen = useStore((s) => s.browserOpen)
  const isBrowserRecording = useStore((s) => s.isBrowserRecording)
  const computerUseRunning = useStore((s) => s.computerUseRunning)

  const handleSkillAction = (action: string): void => {
    switch (action) {
      case 'toggleBrowser':
        toggleBrowser()
        break
      case 'toggleRecording':
        toggleBrowserRecording()
        break
      case 'toggleComputerUse':
        void toggleComputerUse()
        break
      case 'invokeSkill':
        sendMessage('请使用 skill_record(action="status") 查看已有技能列表，然后根据我的任务需求调用最匹配的技能。', { skipNetworkHint: true })
        break
    }
  }

  // 导出最后一条 assistant 消息为 Markdown 文件
  const handleExportDoc = (): void => {
    if (!conversation) return
    const lastAssistant = [...conversation.messages].reverse().find((m) => m.role === 'assistant' && m.content)
    if (!lastAssistant) return
    const blob = new Blob([lastAssistant.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${conversation.title || 'codemax-doc'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [conversation?.messages.length, streamingContent, streamingReasoning, streamingSegments])

  const isEmpty = !conversation || conversation.messages.length === 0
  const isStreamingThis = isStreaming && streamingConversationId === conversation?.id

  const handleOpenFolder = (): void => {
    void openProject()
  }

  // 主入口状态 — 只展示内容，输入框由 GlobalChatInput 统一管理
  if (isEmpty) {
    return (
      <div className="mode-bg-office flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 animate-fade-in">
          <div className="w-full max-w-2xl">
            {/* 大标题 */}
            <h1 className="mb-6 text-center text-3xl font-bold text-text-primary">
              Work with <span className="text-accent">CodeMax</span>
            </h1>

            {/* 输入框下方下拉配置项 — 纯文字 */}
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                onClick={handleOpenFolder}
                className="chip px-2.5 py-1 text-[11px] text-text-secondary hover:text-text-primary transition-all duration-200 active:scale-95"
              >
                {projectPath ? projectPath.split(/[/\\]/).pop() : '打开项目目录'}
              </button>
              {projectPath && (
                <button
                  onClick={() => setProjectPath('')}
                  className="text-[11px] text-text-muted hover:text-red-400 transition-colors"
                  title="清除路径"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* 功能胶囊 — 纯文字 */}
            <div className="mt-6 flex items-center justify-center gap-3">
              {CAPSULE_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    sendMessage(action.prompt, { skipNetworkHint: true })
                  }}
                  className="chip group px-4 py-2 text-sm text-text-secondary transition-all duration-200 hover:border-accent/40 hover:text-text-primary hover:scale-[1.02] active:scale-95"
                >
                  <span>{action.label}</span>
                </button>
              ))}
            </div>

            {/* 技能录制与浏览器 — 后台工具切换 */}
            <div className="mt-3 flex items-center justify-center gap-3">
              {SKILL_CAPSULES.map((capsule) => {
                const isRecording = capsule.action === 'toggleRecording' && isBrowserRecording
                const isActive = (capsule.action === 'toggleBrowser' && browserOpen) ||
                                 (capsule.action === 'toggleComputerUse' && computerUseRunning) ||
                                 isRecording
                const isDisabled = capsule.action === 'toggleRecording' && !browserOpen
                return (
                  <button
                    key={capsule.id}
                    onClick={() => handleSkillAction(capsule.action)}
                    disabled={isDisabled}
                    className={`chip group px-4 py-2 text-sm transition-all duration-200 hover:border-accent/40 hover:text-text-primary hover:scale-[1.02] active:scale-95 ${
                      isActive ? 'border-accent/40 text-accent' : 'text-text-secondary'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span>{capsule.label}</span>
                    {isActive && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* 提示标语 */}
            <p className="mt-3 text-center text-[11px] text-text-muted">
              后台工具 · Agent 可随时调用 · 录制操作自动生成技能 · 相似任务一键复用
            </p>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}
      </div>
    )
  }

  // 对话状态 — 只展示消息列表，输入框由 GlobalChatInput 管理
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatHeader mode={(conversation?.mode ?? currentMode) as Mode} title={conversation?.title} onExport={handleExportDoc} />
      <ToolPanel />
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className={`mx-auto max-w-3xl space-y-5 px-4 py-6 chat-fs-${fontSize}`}>
          {hiddenCount > 0 && (
            <div className="flex justify-center pt-1">
              <button onClick={loadEarlier} className="chip px-3 py-1 text-[11px] text-accent border-accent/25 bg-accent/10 hover:bg-accent/15 transition-colors">
                查看更早的 {hiddenCount} 条消息
              </button>
            </div>
          )}
          {visible.map((msg, idx) => {
            const isLast = idx === visible.length - 1
            const isStreamingMsg = isStreamingThis && isLast && msg.role === 'assistant' && !msg.content
            return (
              <MessageItem
                key={msg.id}
                message={msg}
                isStreaming={isStreamingMsg}
                streamingContent={isStreamingMsg ? streamingContent : undefined}
                streamingReasoning={isStreamingMsg ? streamingReasoning : undefined}
                streamingToolCalls={isStreamingMsg ? streamingToolCalls : undefined}
                streamingSegments={isStreamingMsg ? streamingSegments : undefined}
                canRegenerate={!isStreaming && msg.role === 'assistant' && isLast}
                onRegenerate={regenerate}
                onEditMessage={editMessage}
              />
            )
          })}
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
    </div>
  )
}

function ChatHeader({ mode, title, onExport }: { mode: Mode; title?: string; onExport: () => void }): React.ReactElement {
  const thinkingMode = useStore((s) => s.settings?.thinkingMode)
  const settings = useStore((s) => s.settings)
  const model = useStore((s) => s.settings?.model)
  const modelLabel = settings ? getModelLabel(settings) : model
  const config = MODE_CONFIGS[mode]
  return (
    <div className="flex items-center justify-between border-b border-border-subtle bg-bg-surface px-5 py-2.5 shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <span className="text-sm font-medium text-text-secondary">{config.name}</span>
        {title && <><span className="text-text-muted">·</span><span className="text-sm text-text-primary">{title}</span></>}
      </div>
      <div className="flex items-center gap-2 no-drag">
        <button onClick={onExport} className="btn-ghost rounded-lg px-2.5 py-1 text-[11px]" title="导出最后一条回复为 Markdown">
          导出
        </button>
        {thinkingMode !== undefined && model && <span className="chip px-2 py-0.5 text-[11px] text-text-muted">{thinkingMode ? '思考' : '快速'} · {modelLabel}</span>}
      </div>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }): React.ReactElement {
  return <div className="mx-4 mb-1 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-400"><span className="text-xs">⚠</span><span className="flex-1">{message}</span></div>
}
