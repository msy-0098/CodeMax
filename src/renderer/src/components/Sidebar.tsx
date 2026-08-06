import { memo, useState, useMemo } from 'react'
import { Plus, Users, Brain, RefreshCw, MoreHorizontal, Trash2, Pencil, Settings, BarChart3, ChevronRight, ChevronDown, Folder, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { MODE_CONFIGS } from '../modes'
import { estimateContextTokens } from '../../../shared/context-compress'
import type { Conversation } from '../../../shared/types'

interface SidebarProps {
  onToggleCollapse?: () => void
}

export function Sidebar({ onToggleCollapse: _onToggleCollapse }: SidebarProps): React.ReactElement {
  const allConversations = useStore((s) => s.conversations)
  const currentConversationId = useStore((s) => s.currentConversationId)
  const currentMode = useStore((s) => s.currentMode)
  const newConversation = useStore((s) => s.newConversation)
  const selectConversation = useStore((s) => s.selectConversation)
  const deleteConversation = useStore((s) => s.deleteConversation)
  const renameConversation = useStore((s) => s.renameConversation)
  const reloadConversations = useStore((s) => s.reloadConversations)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const setShowTokenStats = useStore((s) => s.setShowTokenStats)
  const openProject = useStore((s) => s.openProject)
  const memoryEnabled = useStore((s) => s.settings?.memoryEnabled ?? true)
  const collapsedProjects = useStore((s) => s.collapsedProjects)
  const toggleProjectCollapsed = useStore((s) => s.toggleProjectCollapsed)
  const newConversationForProject = useStore((s) => s.newConversationForProject)
  const removeProject = useStore((s) => s.removeProject)

  const conversations = allConversations.filter((c) => c.mode === currentMode)
  const modeConfig = MODE_CONFIGS[currentMode]
  const isProjectMode = currentMode === 'coding' || currentMode === 'design'

  const handleNew = (): void => {
    if (isProjectMode) {
      void openProject()
    } else {
      newConversation()
    }
  }

  const [contextMenuId, setContextMenuId] = useState<string | null>(null)

  const handleRefresh = async (): Promise<void> => {
    await reloadConversations()
  }

  const handleAgentPanel = (): void => {
    useStore.getState().setShowAgentPanel(true)
  }

  const handleMemory = (): void => {
    useStore.getState().setShowMemoryPanel(true)
  }

  const projectGroups = useMemo(() => {
    if (!isProjectMode) return []
    const groups: Record<string, Conversation[]> = {}
    for (const conv of conversations) {
      const path = conv.projectPath || ''
      if (!groups[path]) groups[path] = []
      groups[path].push(conv)
    }
    for (const path of Object.keys(groups)) {
      groups[path].sort((a, b) => b.updatedAt - a.updatedAt)
    }
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aLatest = a[0]?.updatedAt ?? 0
      const bLatest = b[0]?.updatedAt ?? 0
      return bLatest - aLatest
    })
  }, [conversations, isProjectMode])

  return (
    <aside className="flex h-full w-full flex-col border-r border-border-subtle bg-bg-surface select-none">
      {/* 谷歌标准按钮区 */}
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
        <button
          onClick={handleNew}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent text-white dark:text-[#121212] px-3 py-2 text-xs font-medium shadow-sm transition-all hover:brightness-105 active:scale-[0.98]"
        >
          <Plus size={14} strokeWidth={2.2} />
          <span>{isProjectMode ? '打开项目' : '新建任务'}</span>
        </button>
        <button
          onClick={handleAgentPanel}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-bg-surface text-text-secondary transition-colors hover:border-accent/40 hover:text-accent active:scale-[0.96]"
          title="AI 专家库"
        >
          <Users size={14} />
        </button>
        {memoryEnabled && (
          <button
            onClick={handleMemory}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-bg-surface text-text-secondary transition-colors hover:border-accent/40 hover:text-accent active:scale-[0.96]"
            title="记忆"
          >
            <Brain size={14} />
          </button>
        )}
      </div>

      {/* 标题 */}
      <div className="flex items-center justify-between px-3.5 pt-2 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {modeConfig.name} · {isProjectMode ? '项目' : '任务'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="icon-btn rounded-md p-1"
            title="刷新列表"
          >
            <RefreshCw size={12} />
          </button>
          {!isProjectMode && (
            <button
              onClick={handleNew}
              className="icon-btn rounded-md p-1"
              title="新增任务"
            >
              <Plus size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 列表内容 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isProjectMode ? (
          <>
            {projectGroups.map(([projectPath, convs]) => {
              const isCollapsed = collapsedProjects[projectPath] ?? false
              const folderName = projectPath ? projectPath.split(/[/\\]/).pop() || projectPath : '未分组'
              return (
                <ProjectGroup
                  key={projectPath || '__ungrouped__'}
                  projectPath={projectPath}
                  folderName={folderName}
                  conversations={convs}
                  isCollapsed={isCollapsed}
                  activeId={currentConversationId}
                  onSelect={selectConversation}
                  onDelete={deleteConversation}
                  onRename={renameConversation}
                  onToggle={toggleProjectCollapsed}
                  onNewConversation={() => newConversationForProject(projectPath)}
                  onRemove={() => removeProject(projectPath)}
                  contextMenuId={contextMenuId}
                  onContextMenu={setContextMenuId}
                />
              )
            })}
            {projectGroups.length === 0 && (
              <div className="mt-8 flex flex-col items-center gap-3 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-surface text-accent">
                  <Folder size={18} />
                </div>
                <div>
                  <p className="text-xs font-medium text-text-secondary">还没有项目</p>
                  <p className="mt-0.5 text-[11px] text-text-muted">点击上方「打开项目」开始</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                activeId={currentConversationId}
                onSelect={selectConversation}
                onDelete={deleteConversation}
                onRename={renameConversation}
                contextMenuId={contextMenuId}
                onContextMenu={setContextMenuId}
              />
            ))}
            {conversations.length === 0 && (
              <div className="mt-8 flex flex-col items-center gap-3 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-surface text-accent">
                  <Plus size={18} />
                </div>
                <div>
                  <p className="text-xs font-medium text-text-secondary">还没有任务</p>
                  <p className="mt-0.5 text-[11px] text-text-muted">点击上方「新建任务」开始</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部：Google 简约工具栏 */}
      <div className="flex-shrink-0 border-t border-border-subtle p-2 space-y-1">
        <button
          onClick={() => setShowTokenStats(true)}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary active:scale-[0.98]"
        >
          <span className="flex h-5 w-5 items-center justify-center text-text-secondary">
            <BarChart3 size={14} />
          </span>
          <span className="truncate">Token 统计</span>
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary active:scale-[0.98]"
        >
          <span className="flex h-5 w-5 items-center justify-center text-text-secondary">
            <Settings size={14} />
          </span>
          <span className="truncate">系统设置</span>
        </button>
      </div>
    </aside>
  )
}

const ProjectGroup = memo(function ProjectGroup({
  projectPath,
  folderName,
  conversations,
  isCollapsed,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onToggle,
  onNewConversation,
  onRemove,
  contextMenuId,
  onContextMenu
}: {
  projectPath: string
  folderName: string
  conversations: Conversation[]
  isCollapsed: boolean
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onToggle: (projectPath: string) => void
  onNewConversation: () => void
  onRemove: () => void
  contextMenuId: string | null
  onContextMenu: (id: string | null) => void
}): React.ReactElement {
  return (
    <div className="mb-1">
      <div className="group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-bg-hover transition-colors">
        <button
          onClick={() => onToggle(projectPath)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {isCollapsed ? <ChevronRight size={12} className="text-text-muted shrink-0" /> : <ChevronDown size={12} className="text-text-muted shrink-0" />}
          <Folder size={13} className="text-accent shrink-0" />
          <span className="truncate text-xs font-medium text-text-primary">{folderName}</span>
          <span className="shrink-0 text-[10px] text-text-muted">({conversations.length})</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onNewConversation()
          }}
          className="shrink-0 text-text-muted hover:text-accent rounded p-0.5 hover:bg-bg-hover transition-colors"
          title="在此项目下新建会话"
        >
          <Plus size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="shrink-0 text-text-muted hover:text-red-400 rounded p-0.5 hover:bg-bg-hover transition-colors"
          title="从列表中移除项目"
        >
          <X size={12} />
        </button>
      </div>
      {!isCollapsed && (
        <div className="ml-[16px] border-l border-border-subtle pl-1">
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              activeId={activeId}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              contextMenuId={contextMenuId}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
})

const ConversationItem = memo(function ConversationItem({
  conv,
  activeId,
  onSelect,
  onDelete,
  onRename,
  contextMenuId,
  onContextMenu
}: {
  conv: {
    id: string
    title: string
    mode: string
    projectPath?: string
    contextTokens?: number
    messages?: { content?: string; reasoningContent?: string; toolResults?: { content?: string }[] }[]
  }
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  contextMenuId: string | null
  onContextMenu: (id: string | null) => void
}): React.ReactElement {
  const isActive = conv.id === activeId

  const settings = useStore((s) => s.settings)
  const CONTEXT_WINDOW = settings?.maxContextChars ? Math.floor(settings.maxContextChars / 4) : 75_000
  const ctxTokens = estimateContextTokens(conv.messages ?? [])
  const ctxPct = ctxTokens > 0 ? (ctxTokens / CONTEXT_WINDOW) * 100 : 0
  const ctxColor = ctxPct >= 80 ? '#ef4444'
    : ctxPct >= 60 ? '#f97316'
    : ctxPct >= 30 ? '#f59e0b'
    : '#1a73e8'

  return (
    <div className="relative">
      <button
        onClick={() => onSelect(conv.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu(contextMenuId === conv.id ? null : conv.id)
        }}
        className={`group flex w-full items-center gap-2 rounded-lg py-1.5 px-2.5 text-left text-[13px] transition-colors ${
          isActive
            ? 'bg-accent/10 text-accent font-medium'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isActive ? 'bg-accent' : 'bg-text-muted/40'
        }`} />
        <span className="truncate flex-1">{conv.title}</span>
        <span
          className="shrink-0 h-1 w-6 rounded-full bg-border-subtle overflow-hidden inline-flex"
          title={`上下文占用约 ${ctxPct.toFixed(1)}% (${ctxTokens.toLocaleString()} / ${CONTEXT_WINDOW.toLocaleString()} tokens)`}
        >
          <span
            className="h-full rounded-full transition-all duration-200"
            style={{ width: `${ctxTokens > 0 ? Math.max(15, Math.min(ctxPct, 100)) : 0}%`, backgroundColor: ctxColor }}
          />
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onContextMenu(contextMenuId === conv.id ? null : conv.id)
          }}
          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary shrink-0 rounded p-0.5 hover:bg-bg-hover transition-opacity"
        >
          <MoreHorizontal size={12} />
        </button>
      </button>
      {contextMenuId === conv.id && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-border-subtle bg-bg-surface py-1 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const newTitle = prompt('重命名：', conv.title)
              if (newTitle?.trim()) {
                onRename(conv.id, newTitle.trim())
              }
              onContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <Pencil size={11} /> 重命名
          </button>
          <button
            onClick={() => {
              onDelete(conv.id)
              onContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 size={11} /> 删除
          </button>
        </div>
      )}
    </div>
  )
})
