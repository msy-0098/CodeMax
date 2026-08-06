import { useEffect, useState } from 'react'
import { Minus, X, Briefcase, Code2, PenTool, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Mode } from '../../../shared/types'

function RestoreIcon({ size = 15 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="3" y="5" width="8" height="8" rx="1" />
      <path d="M5.5 5V3.5a1 1 0 0 1 1-1H12a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-1.5" />
    </svg>
  )
}

function MaximizeIcon({ size = 15 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
    </svg>
  )
}

const TAB_ITEMS: { id: Mode; label: string; icon: typeof Briefcase }[] = [
  { id: 'office', label: 'Work', icon: Briefcase },
  { id: 'coding', label: 'Code', icon: Code2 },
  { id: 'design', label: 'Design', icon: PenTool }
]

interface TitleBarProps {
  leftCollapsed?: boolean
  rightCollapsed?: boolean
  onToggleLeft?: () => void
  onToggleRight?: () => void
}

export function TitleBar({
  leftCollapsed = false,
  rightCollapsed = false,
  onToggleLeft,
  onToggleRight
}: TitleBarProps): React.ReactElement {
  const currentMode = useStore((s) => s.currentMode)
  const setMode = useStore((s) => s.setMode)
  const conversations = useStore((s) => s.conversations)
  const currentConversationId = useStore((s) => s.currentConversationId)
  const isStreaming = useStore((s) => s.isStreaming)
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    void window.api.window.isMaximized().then(setIsMaximized)
    const unsubscribe = window.api.window.onMaximizeChange(setIsMaximized)
    return unsubscribe
  }, [])

  const currentConv = conversations.find((c) => c.id === currentConversationId)
  const statusText = currentConv ? currentConv.title : 'CodeMax Workspace'

  return (
    <div className="drag-region relative z-20 flex h-[42px] flex-shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-3 select-none">
      {/* 左侧：折叠按钮 + Google Material Tabs */}
      <div className="no-drag flex items-center gap-3">
        {onToggleLeft && (
          <button
            onClick={onToggleLeft}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary active:scale-[0.96]"
            title={leftCollapsed ? '展开左侧边栏' : '折叠左侧边栏'}
          >
            {leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}

        {/* Google Material Tabs (平整底线高亮，无大圆角) */}
        <div className="flex items-center gap-1 h-full">
          {TAB_ITEMS.map((tab) => {
            const IconCmp = tab.icon
            const isActive = currentMode === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 border-b-2 ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover/50 rounded-t-md'
                }`}
              >
                <IconCmp size={14} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 中间：任务标题状态 */}
      <div className="flex flex-1 items-center justify-center gap-2 overflow-hidden px-4">
        {isStreaming ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent animate-ping" />
        ) : (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        )}
        <span
          className={`truncate font-mono text-[12px] transition-colors ${
            isStreaming ? 'font-medium text-accent' : 'text-text-muted'
          }`}
        >
          {statusText}
        </span>
      </div>

      {/* 右侧：右侧栏折叠按钮 + 窗口控制 */}
      <div className="no-drag flex items-center gap-1">
        {onToggleRight && (
          <button
            onClick={onToggleRight}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary active:scale-[0.96]"
            title={rightCollapsed ? '展开右侧面板' : '折叠右侧面板'}
          >
            {rightCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          </button>
        )}

        <div className="ml-1 flex h-full items-center">
          <button
            onClick={() => void window.api.window.minimize()}
            className="flex h-7 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary active:scale-[0.95]"
            title="最小化"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => void window.api.window.maximize()}
            className="flex h-7 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary active:scale-[0.95]"
            title={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? <RestoreIcon size={14} /> : <MaximizeIcon size={14} />}
          </button>
          <button
            onClick={() => void window.api.window.close()}
            className="flex h-7 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-rose-600 hover:text-white active:scale-[0.95]"
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

