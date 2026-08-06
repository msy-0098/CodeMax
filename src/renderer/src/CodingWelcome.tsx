import { useState } from 'react'
import { SearchCode, Bug, BookOpen, RefreshCw, FolderSearch, Rocket, FolderOpen, Clock, ChevronDown } from 'lucide-react'
import { useStore } from './store/useStore'

interface QuickAction {
  icon: React.ReactNode
  label: string
  desc: string
  prompt: string
}

/** 全部预设任务 — 默认折叠，仅展示前 4 个核心任务 */
const QUICK_ACTIONS: QuickAction[] = [
  { icon: <SearchCode size={15} />, label: '代码审查', desc: '五维度审查 + 改进建议', prompt: '请审查以下代码，从正确性/安全性/性能/可读性/最佳实践五个维度分析：\n\n```\n[粘贴代码]\n```' },
  { icon: <Bug size={15} />, label: '修复 Bug', desc: '定位问题 + 修复 + 说明', prompt: '以下代码存在问题：[异常现象]\n\n```\n[粘贴代码]\n```\n\n请定位问题、解释根因、给出修复代码。' },
  { icon: <BookOpen size={15} />, label: '解释代码', desc: '逐行解释 + 数据流分析', prompt: '请逐行解释以下代码的工作原理，包括核心逻辑、数据流和设计意图：\n\n```\n[粘贴代码]\n```' },
  { icon: <RefreshCw size={15} />, label: '重构代码', desc: '优化结构 + 说明理由', prompt: '请重构以下代码，提升可读性和可维护性，保持行为不变：\n\n```\n[粘贴代码]\n```' },
  { icon: <Bug size={15} />, label: '编写测试', desc: '正常/边界/异常全覆盖', prompt: '请为以下代码编写单元测试，覆盖正常路径、边界情况和异常情况：\n\n```\n[粘贴代码]\n```' },
  { icon: <Bug size={15} />, label: '修改文件', desc: '先读后写精确替换', prompt: '请帮我修改 [文件路径] 中的代码：[描述修改需求]\n\n请先读取文件再做精确替换。' }
]

export function CodingWelcome(): React.ReactElement {
  const sendMessage = useStore((s) => s.sendMessage)
  const openProject = useStore((s) => s.openProject)
  const projectPath = useStore((s) => s.projectPath)
  const recentProjects = useStore((s) => s.settings?.recentProjects ?? [])
  const setProjectPath = useStore((s) => s.setProjectPath)
  const [expanded, setExpanded] = useState(false)

  const coreActions = QUICK_ACTIONS.slice(0, 4)
  const moreActions = QUICK_ACTIONS.slice(4)

  return (
    <div className="mode-bg-coding flex h-full flex-col items-center justify-center px-6 py-10 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-[720px]">
        {/* Hero — 简约，去 AI 化视觉 */}
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold text-text-primary">+Code 编程模式</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            代码生成 · 审查 · 解释 · 重构 · 测试 — 由 CodeMax 驱动
          </p>
        </div>

        {/* 打开项目 — 主入口 */}
        <button
          onClick={openProject}
          className="mb-6 flex w-full items-center gap-4 rounded-xl border border-border-subtle bg-bg-surface p-4 text-left transition-all hover:border-accent/35 hover:shadow-sm active:scale-[0.995]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <FolderOpen size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-text-primary">
              {projectPath ? projectPath.split(/[/\\]/).pop() : '打开项目目录'}
            </div>
            <div className="mt-0.5 truncate text-xs text-text-muted">
              {projectPath ? projectPath : '选择本地文件夹，让 Agent 读取并理解你的项目'}
            </div>
          </div>
          {!projectPath && (
            <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              开始
            </span>
          )}
        </button>

        {/* 扫描项目 / 从零开发 — 仅有 projectPath 时显示 */}
        {projectPath && (
          <div className="mb-6 grid grid-cols-2 gap-2.5">
            <button
              onClick={() => sendMessage(`请使用 project_context 工具扫描以下项目目录，帮我了解项目架构和技术栈：${projectPath}`, { skipNetworkHint: true })}
              className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface p-3.5 text-left transition-all hover:border-accent/35 hover:shadow-sm active:scale-[0.995]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <FolderSearch size={15} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">扫描项目</div>
                <div className="mt-0.5 text-xs text-text-muted">分析结构和关键文件</div>
              </div>
            </button>
            <button
              onClick={() => sendMessage(`当前项目目录是空目录：${projectPath}\n请帮我从零搭建一个新项目。先确认需求后初始化项目结构（创建配置文件、目录结构、入口文件），再安装依赖并验证能正常运行。`, { skipNetworkHint: true })}
              className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface p-3.5 text-left transition-all hover:border-accent/35 hover:shadow-sm active:scale-[0.995]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Rocket size={15} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">从零创建项目</div>
                <div className="mt-0.5 text-xs text-text-muted">空目录初始化完整项目</div>
              </div>
            </button>
          </div>
        )}

        {/* 最近项目列表 */}
        {!projectPath && recentProjects.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-1.5">
              <Clock size={12} className="text-text-muted" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">最近项目</span>
            </div>
            <div className="space-y-1.5">
              {recentProjects.slice(0, 5).map((p) => {
                const name = p.split(/[/\\]/).pop() || p
                return (
                  <button
                    key={p}
                    onClick={() => setProjectPath(p)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-transparent bg-bg-surface p-2.5 text-left transition-all hover:border-border-subtle hover:bg-bg-hover"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <FolderOpen size={13} />
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

        {/* 预设任务 — 折叠显示，仅展示 4 个核心任务 */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">核心任务</span>
          {moreActions.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-accent"
            >
              {expanded ? '收起' : `展开全部 (${QUICK_ACTIONS.length})`}
              <ChevronDown size={11} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* 简约任务列表 */}
        <div className="grid grid-cols-2 gap-2">
          {coreActions.map((action) => (
            <button
              key={action.label}
              onClick={() => sendMessage(action.prompt)}
              className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface p-3.5 text-left transition-all hover:border-accent/35 hover:shadow-sm active:scale-[0.995]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
                {action.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">{action.label}</div>
                <div className="mt-0.5 truncate text-xs text-text-muted">{action.desc}</div>
              </div>
            </button>
          ))}
          {expanded &&
            moreActions.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface p-3.5 text-left transition-all hover:border-accent/35 hover:shadow-sm active:scale-[0.995] animate-scale-in"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
                  {action.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary">{action.label}</div>
                  <div className="mt-0.5 truncate text-xs text-text-muted">{action.desc}</div>
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
