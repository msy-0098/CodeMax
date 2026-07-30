import { Palette, FolderOpen, Clock, Eye } from 'lucide-react'
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
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-2xl">
        {/* Hero 区域 */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-muted shadow-xl shadow-accent/20 edge-light animate-float">
            <Icon name={config.icon} size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">{config.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">{config.description}</p>
        </div>

        {/* 打开项目 — 主入口 */}
        <button
          onClick={openProject}
          className="ios-card edge-light mb-6 flex w-full items-center gap-4 p-5 text-left"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent group-hover:bg-accent/25 transition-all duration-300 group-hover:shadow-glow group-hover:scale-105">
            <FolderOpen size={24} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-text-primary group-hover:text-accent transition-colors">
              {projectPath ? projectPath.split(/[/\\]/).pop() : '打开项目目录'}
            </div>
            <div className="mt-0.5 text-xs text-text-muted truncate">
              {projectPath ? projectPath : '选择项目文件夹，让 Agent 读取设计文件和组件代码'}
            </div>
          </div>
          {!projectPath && (
            <div className="ml-auto shrink-0 chip border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
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
                    className="ios-card group flex w-full items-center gap-2.5 p-2.5 text-left"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-all">
                      <FolderOpen size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-text-primary truncate">{name}</div>
                      <div className="text-[10px] text-text-muted truncate">{p}</div>
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
              <Palette size={13} className="text-text-muted" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">快捷操作</span>
            </div>
            <QuickActionCards actionGroups={config.actionGroups} onAction={handleAction} />
          </div>
        )}

        {!projectPath && (
          <div className="ios-card border-dashed flex items-center gap-2.5 px-4 py-3 text-center justify-center">
            <Eye size={14} className="text-text-muted" />
            <p className="text-[11px] text-text-muted">选择项目后，Agent 可读取组件代码并生成设计。右侧"模板"面板可随时使用设计模板。</p>
          </div>
        )}
      </div>
    </div>
  )
}
