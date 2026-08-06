import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { useStore } from './store/useStore'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { RightSidebar } from './components/RightSidebar'
import { ResizableDivider } from './components/ResizableDivider'
import { ConfirmDialog } from './components/ConfirmDialog'
import { StartupAnimation } from './components/StartupAnimation'
import { TaskListPanel } from './components/TaskListPanel'

// 懒加载布局组件 — 只有当前模式的布局被加载
const OfficeLayout = lazy(() => import('./components/layouts/OfficeLayout').then(m => ({ default: m.OfficeLayout })))
const CodingLayout = lazy(() => import('./components/layouts/CodingLayout').then(m => ({ default: m.CodingLayout })))
const DesignLayout = lazy(() => import('./components/layouts/DesignLayout').then(m => ({ default: m.DesignLayout })))

// 懒加载弹窗组件 — 首次打开时才加载
const SettingsPage = lazy(() => import('./components/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AgentExpertPanel = lazy(() => import('./components/AgentExpertPanel').then(m => ({ default: m.AgentExpertPanel })))
const MemoryPanel = lazy(() => import('./components/MemoryPanel').then(m => ({ default: m.MemoryPanel })))
const PlanSpecDialog = lazy(() => import('./components/PlanSpecDialog').then(m => ({ default: m.PlanSpecDialog })))
const TokenStatsModal = lazy(() => import('./components/TokenStatsModal').then(m => ({ default: m.TokenStatsModal })))

// 懒加载输入框 — 1193 行 + 大量 lucide 图标 + agents 数据，首屏不需要
const GlobalChatInput = lazy(() => import('./components/GlobalChatInput').then(m => ({ default: m.GlobalChatInput })))

interface ConfirmState {
  toolName: string
  message: string
}

export default function App(): React.ReactElement {
  const init = useStore((s) => s.init)
  const settings = useStore((s) => s.settings)
  const currentMode = useStore((s) => s.currentMode)
  const [loaded, setLoaded] = useState(false)
  const [animationDone, setAnimationDone] = useState(false)

  // ---- 危险操作确认弹窗 ----
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  useEffect(() => {
    const cleanup = window.api.confirm.onRequest((data) => {
      // 会话级 YOLO 模式检查
      if (localStorage.getItem('codemax-yolo') === 'true') {
        window.api.confirm.respond(true)
        return
      }
      setConfirmState(data)
    })
    return cleanup
  }, [])

  const handleConfirm = useCallback((): void => {
    window.api.confirm.respond(true)
    setConfirmState(null)
  }, [])

  const handleCancel = useCallback((): void => {
    window.api.confirm.respond(false)
    setConfirmState(null)
  }, [])

  // ---- 全局键盘快捷键 ----
  const newConversation = useStore((s) => s.newConversation)
  const setMode = useStore((s) => s.setMode)
  const showSettings = useStore((s) => s.showSettings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const setShowAgentPanel = useStore((s) => s.setShowAgentPanel)
  const setShowMemoryPanel = useStore((s) => s.setShowMemoryPanel)
  const regenerate = useStore((s) => s.regenerate)
  const isStreaming = useStore((s) => s.isStreaming)
  const openProject = useStore((s) => s.openProject)
  const projectPath = useStore((s) => s.projectPath)

  // ---- 侧栏拖拽宽度与折叠状态 ----
  const [leftWidth, setLeftWidth] = useState(240)
  const [rightWidth, setRightWidth] = useState(280)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  const toggleLeftSidebar = useCallback(() => setLeftCollapsed((prev) => !prev), [])
  const toggleRightSidebar = useCallback(() => setRightCollapsed((prev) => !prev), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+N — 新建对话
      if (ctrl && e.key === 'n' && !e.shiftKey) {
        e.preventDefault()
        // coding/design 模式下无项目时先选项目
        const mode = useStore.getState().currentMode
        const path = useStore.getState().projectPath
        if ((mode === 'coding' || mode === 'design') && !path) {
          void openProject()
        } else {
          newConversation()
        }
        return
      }
      // Ctrl+1/2/3 — 切换模式
      if (ctrl && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault()
        setMode(e.key === '1' ? 'office' : e.key === '2' ? 'coding' : 'design')
        return
      }
      // Ctrl+, — 打开设置
      if (ctrl && e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
        return
      }
      // Ctrl+Shift+R — 重新生成
      if (ctrl && e.shiftKey && e.key === 'R') {
        e.preventDefault()
        if (!isStreaming) void regenerate()
        return
      }
      // Escape — 关闭弹窗
      if (e.key === 'Escape') {
        setShowSettings(false)
        setShowAgentPanel(false)
        setShowMemoryPanel(false)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [newConversation, setMode, setShowSettings, setShowAgentPanel, setShowMemoryPanel, regenerate, isStreaming, openProject, projectPath])

  useEffect(() => {
    void init().then(() => setLoaded(true))
  }, [init])

  // 上报流式状态给主进程：空闲时允许后台节流，流式时放开（保证后台 Agent 流畅）
  useEffect(() => {
    window.api.streaming.setActive(isStreaming)
  }, [isStreaming])

  // 窗口最大化状态 — 最大化时移除圆角（全屏不应有圆角）
  useEffect(() => {
    const applyMaximized = (maximized: boolean): void => {
      document.documentElement.classList.toggle('window-maximized', maximized)
    }
    void window.api.window.isMaximized().then(applyMaximized)
    return window.api.window.onMaximizeChange(applyMaximized)
  }, [])

  // 窗口显示：等 init 完成且启动动画/主界面渲染到 DOM 后再通知主进程 show
  // 确保 show 时表面已有首帧内容，避免 DWM 渲染纯黑画面
  useEffect(() => {
    if (!loaded || !settings) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.api.window.ready()
      })
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [loaded, settings])

  // 应用主题色到 CSS 变量
  useEffect(() => {
    if (settings?.themeColor) {
      document.documentElement.style.setProperty('--theme-color', settings.themeColor)
    }
  }, [settings?.themeColor])

  // 应用明暗主题
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('theme-transition')
    if (settings?.theme === 'light') {
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
    }
    const t = setTimeout(() => root.classList.remove('theme-transition'), 300)
    return () => clearTimeout(t)
  }, [settings?.theme])

  // 启动动画完成回调 — useCallback 保证引用稳定，避免 StartupAnimation 内定时器被重置
  const handleAnimationComplete = useCallback((): void => setAnimationDone(true), [])

  // 开屏动画总开关 — 关闭时直接进入主界面
  const showStartupAnimation = settings?.startupAnimationEnabled ?? true

  // 主界面内容 — 启动动画期间作为 children 隐藏挂载，溶解转场时逐步显现
  const mainContent = (loaded && settings) ? (
    <div className="relative flex h-full flex-col overflow-hidden bg-bg-base font-sans selection:bg-[#ff6b00]/20">
      {/* 顶部导航栏 — 支持侧边栏折叠控制 */}
      <TitleBar
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        onToggleLeft={toggleLeftSidebar}
        onToggleRight={toggleRightSidebar}
      />

      {/* 主体区域：左侧边栏 + 主内容区（含输入框）+ 右侧辅助栏 */}
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {/* 左侧边栏 — 支持一键折叠与平滑过渡 */}
        {!leftCollapsed && (
          <>
            <div style={{ width: `${leftWidth}px`, flexShrink: 0 }} className="h-full transition-all duration-200 ease-out">
              <Sidebar onToggleCollapse={toggleLeftSidebar} />
            </div>
            <ResizableDivider
              side="left"
              width={leftWidth}
              minWidth={180}
              maxWidth={480}
              onResize={setLeftWidth}
            />
          </>
        )}

        {/* 主内容区 — 内容 + 底部输入框 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-base">
          {/* 可滚动内容区 — flex column 确保内部滚动容器高度正确 */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Suspense fallback={null}>
              {currentMode === 'office' && <OfficeLayout />}
              {currentMode === 'coding' && <CodingLayout />}
              {currentMode === 'design' && <DesignLayout />}
            </Suspense>
          </div>
          {/* Agent 任务列表面板 — 可折叠，由 todo_write 工具驱动 */}
          <TaskListPanel />
          {/* 底部全局 AI 聊天输入区 — 只在左右侧边栏之间 */}
          <Suspense fallback={null}>
            <GlobalChatInput />
          </Suspense>
        </div>

        {/* 右侧辅助栏 — 支持一键折叠 */}
        {!rightCollapsed && (
          <>
            <ResizableDivider
              side="right"
              width={rightWidth}
              minWidth={240}
              maxWidth={800}
              onResize={setRightWidth}
            />
            <div style={{ width: `${rightWidth}px`, flexShrink: 0 }} className="h-full transition-all duration-200 ease-out">
              <RightSidebar onToggleCollapse={toggleRightSidebar} />
            </div>
          </>
        )}
      </div>

      {/* AI 专家库面板 */}
      <Suspense fallback={null}>
        <AgentExpertPanel />
      </Suspense>
      {/* 模式记忆面板 */}
      <Suspense fallback={null}>
        <MemoryPanel />
      </Suspense>
      {/* Plan 提问 / Spec 审核弹窗 */}
      <Suspense fallback={null}>
        <PlanSpecDialog />
      </Suspense>
      {/* 危险操作确认弹窗 */}
      <ConfirmDialog
        open={confirmState !== null}
        title="确认执行操作"
        message={confirmState?.message ?? ''}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      {/* Token 用量统计面板 */}
      <Suspense fallback={null}>
        <TokenStatsModal />
      </Suspense>
    </div>
  ) : (
    <div className="h-full bg-bg-base" />
  )

  // 应用内全屏设置页 — 打开时替代主界面渲染
  if (showSettings && loaded && settings) {
    return (
      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>
    )
  }

  // 启动动画 — 等 settings 加载完成后再决定是否播放
  if (!animationDone && loaded && settings && showStartupAnimation) {
    return (
      <StartupAnimation onComplete={handleAnimationComplete} config={settings}>
        {mainContent}
      </StartupAnimation>
    )
  }

  return mainContent
}
