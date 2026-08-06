import { FolderOpen, Clock, Eye } from 'lucide-react'
import { MODE_CONFIGS } from './modes'
import { QuickActionCards } from './components/shared/QuickActionCards'
import { Icon } from './components/Icon'
import type { QuickAction } from '../../shared/types'
import { useStore } from './store/useStore'

export function DesignWelcome(): React.ReactElement {
  const config = MODE_CONFIGS.design
  const sendMessage = useStore((s) => s.sendMessage)
  const openProject = useStore((s) => s.openProject)
  const projectPath = useStore((s) => s.projectPath)
  const recentProjects = useStore((s) => s.settings?.recentProjects ?? [])
  const setProjectPath = useStore((s) => s.setProjectPath)
  const handleAction = (action: QuickAction): void => { sendMessage(action.prompt) }

  return (
    <div className="mode-bg-design flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-10 animate-fade-in">
      <div className="w-full max-w-2xl">
        {/* Hero 区域 */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-subtle bg-bg-surface">
            <Icon name={config.icon} size={26} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">{config.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">{config.description}</p>
        </div>

        {/* 打开项目 — 主入口 */}
        <button
          onClick={openProject}
          className="group mb-6 flex w-full items-center gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5 text-left transition-all hover:border-accent/35 hover:shadow-sm active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
            <FolderOpen size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-text-primary transition-colors group-hover:text-accent">
              {projectPath ? projectPath.split(/[/\\]/).pop() : '打开项目目录'}
            </div>
            <div className="mt-0.5 truncate text-xs text-text-muted">
              {projectPath ? projectPath : '选择项目文件夹，让 Agent 读取设计文件和组件代码'}
            </div>
          </div>
          {!projectPath && (
            <div className="ml-auto shrink-0 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              开始
            </div>
          )}
        </button>

        {/* 最近项目列表 */}
        {!projectPath && recentProjects.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-1.5">
              <Clock size={13} className="text-text-muted" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">最近项目</span>
            </div>
            <div className="space-y-1.5">
              {recentProjects.slice(0, 5).map((p) => {
                const name = p.split(/[/\\]/).pop() || p
                return (
                  <button
                    key={p}
                    onClick={() => setProjectPath(p)}
                    className="group flex w-full items-center gap-2.5 rounded-xl border border-border-subtle bg-bg-surface p-2.5 text-left transition-all hover:border-accent/35 hover:shadow-sm active:scale-[0.99]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
                      <FolderOpen size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-text-primary">{name}</div>
                      <div className="truncate text-[10px] text-text-muted">{p}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 快捷操作卡片 */}
        {projectPath && config.actionGroups && (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Icon name={config.icon} size={13} className="text-text-muted" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">快捷操作</span>
            </div>
            <QuickActionCards actionGroups={config.actionGroups} onAction={handleAction} />
          </div>
        )}

        {!projectPath && (
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border-subtle bg-bg-surface/50 px-4 py-3">
            <Eye size={14} className="shrink-0 text-text-muted" />
            <p className="text-[11px] text-text-muted">选择项目后，Agent 可读取组件代码并生成设计。右侧「组件」面板可随时使用设计模板。</p>
          </div>
        )}
      </div>
    </div>
  )
}
