import { Wand2, SearchCode, Bug, GitBranch, FolderSearch, Terminal, RefreshCw, FlaskConical, FileEdit, BookOpen, FolderOpen, Clock, Rocket } from 'lucide-react'
import { useStore } from './store/useStore'

interface QuickAction {
  icon: React.ReactNode
  label: string
  desc: string
  prompt: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: <SearchCode size={18} />, label: '代码审查', desc: '五维度审查 + 改进建议', prompt: '请审查以下代码，从正确性/安全性/性能/可读性/最佳实践五个维度分析：\n\n```\n[粘贴代码]\n```' },
  { icon: <Bug size={18} />, label: '修复 Bug', desc: '定位问题 + 修复 + 说明', prompt: '以下代码存在问题：[异常现象]\n\n```\n[粘贴代码]\n```\n\n请定位问题、解释根因、给出修复代码。' },
  { icon: <BookOpen size={18} />, label: '解释代码', desc: '逐行解释 + 数据流分析', prompt: '请逐行解释以下代码的工作原理，包括核心逻辑、数据流和设计意图：\n\n```\n[粘贴代码]\n```' },
  { icon: <RefreshCw size={18} />, label: '重构代码', desc: '优化结构 + 说明理由', prompt: '请重构以下代码，提升可读性和可维护性，保持行为不变：\n\n```\n[粘贴代码]\n```' },
  { icon: <FlaskConical size={18} />, label: '编写测试', desc: '正常/边界/异常全覆盖', prompt: '请为以下代码编写单元测试，覆盖正常路径、边界情况和异常情况：\n\n```\n[粘贴代码]\n```' },
  { icon: <FileEdit size={18} />, label: '修改文件', desc: '先读后写精确替换', prompt: '请帮我修改 [文件路径] 中的代码：[描述修改需求]\n\n请先读取文件再做精确替换。' },
  { icon: <Terminal size={18} />, label: '执行命令', desc: '终端命令 + 超时控制', prompt: '请帮我执行以下命令：[命令]\n\n请确认当前目录是否正确。' },
  { icon: <GitBranch size={18} />, label: 'Git 操作', desc: '查看状态/差异/提交', prompt: '请帮我 [git操作描述]\n\n操作前请先确认当前分支状态。' },
]

export function CodingWelcome(): React.ReactElement {
  const sendMessage = useStore((s) => s.sendMessage)
  const openProject = useStore((s) => s.openProject)
  const projectPath = useStore((s) => s.projectPath)
  const recentProjects = useStore((s) => s.settings?.recentProjects ?? [])
  const setProjectPath = useStore((s) => s.setProjectPath)

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-[720px]">
        {/* Hero 区域 */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-muted shadow-xl shadow-accent/20 edge-light animate-float">
            <Wand2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">+Code 编程模式</h1>
          <p className="mt-2 text-sm text-text-secondary max-w-md">
            代码生成 · 审查 · 解释 · 重构 · 测试 — 由 CodeMax 驱动
          </p>
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
              {projectPath ? projectPath : '选择本地文件夹，让 Agent 读取并理解你的项目'}
            </div>
          </div>
          {!projectPath && (
            <div className="ml-auto shrink-0 chip border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              开始
            </div>
          )}
        </button>

        {/* 扫描项目 / 从零开发 — 仅有 projectPath 时显示 */}
        {projectPath && (
          <div className="mb-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => sendMessage(`请使用 project_context 工具扫描以下项目目录，帮我了解项目架构和技术栈：${projectPath}`, { skipNetworkHint: true })}
              className="ios-card group flex items-center gap-3 p-4 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-all duration-300 group-hover:shadow-glow group-hover:scale-105">
                <FolderSearch size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">扫描项目</div>
                <div className="mt-0.5 text-xs text-text-muted">分析结构和关键文件</div>
              </div>
            </button>
            <button
              onClick={() => sendMessage(`当前项目目录是空目录：${projectPath}\n请帮我从零搭建一个新项目。先确认需求后初始化项目结构（创建配置文件、目录结构、入口文件），再安装依赖并验证能正常运行。`, { skipNetworkHint: true })}
              className="ios-card group flex items-center gap-3 p-4 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-all duration-300 group-hover:shadow-glow group-hover:scale-105">
                <Rocket size={18} />
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

        {/* 快捷操作卡片网格 */}
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => sendMessage(action.prompt)}
              className="ios-card group flex items-start gap-3 p-4 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-all duration-300 group-hover:shadow-glow group-hover:scale-105">
                {action.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">{action.label}</div>
                <div className="mt-0.5 text-xs text-text-muted">{action.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
