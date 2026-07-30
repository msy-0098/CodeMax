import { useRef, useEffect, useState, useCallback } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, X, Search, Radio, Trash2, Loader2, Plus } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import type { RecordedEvent, SkillStep, CapturedRequest } from '../../../../../shared/types'
import type { TabState, WebviewAPI } from './utils'
import { genTabId, safeCall, normalizeUrl, urlToTitle } from './utils'
import { BrowserTab } from './BrowserTab'

export function EmbeddedBrowserPanel(): React.ReactElement {
  const urlInputRef = useRef<HTMLInputElement>(null)

  const setBrowserUrl = useStore((s) => s.setBrowserUrl)
  const toggleBrowser = useStore((s) => s.toggleBrowser)
  const isBrowserRecording = useStore((s) => s.isBrowserRecording)
  const toggleBrowserRecording = useStore((s) => s.toggleBrowserRecording)
  const capturedRequests = useStore((s) => s.capturedRequests)
  const refreshCapturedRequests = useStore((s) => s.refreshCapturedRequests)
  const clearCapturedRequests = useStore((s) => s.clearCapturedRequests)
  const loadSkills = useStore((s) => s.loadSkills)

  // 标签页列表
  const [tabs, setTabs] = useState<TabState[]>([
    { id: genTabId(), url: 'https://www.bing.com', title: 'Bing', loading: false, canGoBack: false, canGoForward: false }
  ])
  const [activeTabId, setActiveTabId] = useState(tabs[0]!.id)

  // webview 引用映射 — Agent 命令桥通过此映射操作当前活动标签
  const webviewRefs = useRef<Map<string, HTMLElement>>(new Map())
  const webviewReadyRef = useRef(false)

  const [showCapturePanel, setShowCapturePanel] = useState(true)
  const [recordedEvents, setRecordedEvents] = useState<RecordedEvent[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [skillDesc, setSkillDesc] = useState('')
  const [startUrl, setStartUrl] = useState('')

  const eventsRef = useRef<RecordedEvent[]>([])
  const pendingDataRef = useRef<string>('')

  // 当前活动标签
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]

  // activeTabId 的 ref 镜像 — 让命令桥始终操作最新活动标签
  const activeTabIdRef = useRef(activeTabId)
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])

  // 通知主进程内嵌浏览器已激活
  useEffect(() => {
    void window.api.embeddedBrowser.setActive(true)
    return () => { void window.api.embeddedBrowser.setActive(false) }
  }, [])

  // 当活动标签的 webview 变化时更新 readyRef
  useEffect(() => {
    webviewReadyRef.current = !!webviewRefs.current.get(activeTabId)
  }, [activeTabId, tabs])

  // 注册 webview 引用 — 使用 ref 跟踪 activeTabId，避免 useCallback 依赖变化导致子组件重复渲染
  const registerWebview = useCallback((tabId: string, wv: HTMLElement | null): void => {
    if (wv) {
      webviewRefs.current.set(tabId, wv)
      if (tabId === activeTabIdRef.current) webviewReadyRef.current = true
    } else {
      webviewRefs.current.delete(tabId)
      if (tabId === activeTabIdRef.current) webviewReadyRef.current = false
    }
  }, [])

  // Agent ↔ webview 命令桥 — 只注册一次，操作当前活动标签
  useEffect(() => {
    const cleanup = window.api.embeddedBrowser.onCommand(async (data) => {
      const wv = webviewRefs.current.get(activeTabIdRef.current)
      if (!wv || !webviewReadyRef.current) {
        window.api.embeddedBrowser.sendResult({ id: data.id, success: false, error: 'Webview 未就绪' })
        return
      }
      try {
        let result: unknown
        const wvApi = wv as unknown as WebviewAPI
        switch (data.cmd) {
          case 'navigate':
            wvApi.loadURL(data.args.url as string)
            result = { url: data.args.url }
            break
          case 'getURL':
            result = wvApi.getURL()
            break
          case 'getTitle':
            result = wvApi.getTitle()
            break
          case 'executeJS':
            result = await wvApi.executeJavaScript(`(() => { ${data.args.code as string} })()`)
            break
          case 'getContent': {
            const sel = (data.args.selector as string) || 'body'
            result = await wvApi.executeJavaScript(
              `(document.querySelector(${JSON.stringify(sel)}) || document.body).textContent || ''`
            )
            break
          }
          case 'click': {
            const sel = data.args.selector as string
            result = await wvApi.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) { el.click(); return true; } return false; })()`
            )
            break
          }
          case 'type': {
            const sel = data.args.selector as string
            const text = data.args.text as string
            result = await wvApi.executeJavaScript(
              `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) { el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); return true; } return false; })()`
            )
            break
          }
          case 'screenshot': {
            const img = await wvApi.capturePage()
            result = img.toDataURL()
            break
          }
          case 'back':
            wvApi.goBack()
            result = true
            break
          case 'forward':
            wvApi.goForward()
            result = true
            break
          case 'reload':
            wvApi.reload()
            result = true
            break
          case 'getNetwork': {
            const reqs = await window.api.networkCapture.getRequests()
            result = reqs.map((r: CapturedRequest) => ({
              url: r.url, method: r.method, status: r.statusCode || 200,
              type: r.resourceType || 'xhr', timestamp: r.timestamp
            }))
            break
          }
          default:
            throw new Error(`未知命令: ${data.cmd}`)
        }
        window.api.embeddedBrowser.sendResult({ id: data.id, success: true, result })
      } catch (e) {
        window.api.embeddedBrowser.sendResult({ id: data.id, success: false, error: (e as Error).message })
      }
    })
    return cleanup
  }, [])

  // 录制中定时刷新抓包列表
  useEffect(() => {
    if (!isBrowserRecording) return
    const interval = setInterval(() => { void refreshCapturedRequests() }, 1000)
    return () => clearInterval(interval)
  }, [isBrowserRecording, refreshCapturedRequests])

  // URL 栏跟随活动标签
  useEffect(() => {
    if (activeTab && urlInputRef.current) {
      urlInputRef.current.value = activeTab.url
    }
    setBrowserUrl(activeTab?.url || '')
  }, [activeTabId, activeTab, setBrowserUrl])

  // ---- 标签操作 ----

  const handleNewTab = useCallback((url: string): void => {
    const newTab: TabState = {
      id: genTabId(),
      url: url || 'https://www.bing.com',
      title: urlToTitle(url || '新标签页'),
      loading: false,
      canGoBack: false,
      canGoForward: false,
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
  }, [])

  const handleCloseTab = useCallback((tabId: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId)
      if (idx === -1) return prev
      const next = prev.filter((t) => t.id !== tabId)
      if (next.length === 0) {
        // 关闭最后一个标签 → 关闭浏览器
        toggleBrowser()
        return prev
      }
      // 如果关闭的是活动标签，切到相邻标签
      if (tabId === activeTabId) {
        const newActive = next[Math.min(idx, next.length - 1)]!
        setActiveTabId(newActive.id)
      }
      return next
    })
  }, [activeTabId, toggleBrowser])

  const handleNavigate = useCallback((url: string): void => {
    const target = normalizeUrl(url)
    if (!target) return
    const wv = webviewRefs.current.get(activeTabId)
    if (!wv) return
    safeCall(() => (wv as unknown as WebviewAPI).loadURL(target))
  }, [activeTabId])

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleNavigate(urlInputRef.current?.value || activeTab?.url || '')
    }
  }

  // 标签状态回调
  const onNavStateChange = useCallback((tabId: string, state: { url?: string; canGoBack?: boolean; canGoForward?: boolean; loading?: boolean }): void => {
    setTabs((prev) => prev.map((t) =>
      t.id === tabId
        ? {
            ...t,
            url: state.url ?? t.url,
            canGoBack: state.canGoBack ?? t.canGoBack,
            canGoForward: state.canGoForward ?? t.canGoForward,
            loading: state.loading ?? t.loading,
          }
        : t
    ))
  }, [])

  const onTitleChange = useCallback((tabId: string, title: string): void => {
    setTabs((prev) => prev.map((t) => t.id === tabId ? { ...t, title: title || t.title } : t))
  }, [])

  const onRecordedEvent = useCallback((): void => {
    setRecordedEvents([...eventsRef.current])
  }, [])

  // webview 操作辅助
  const goBack = (): void => {
    const wv = webviewRefs.current.get(activeTabId)
    safeCall(() => (wv as unknown as WebviewAPI)?.goBack())
  }
  const goForward = (): void => {
    const wv = webviewRefs.current.get(activeTabId)
    safeCall(() => (wv as unknown as WebviewAPI)?.goForward())
  }
  const reload = (): void => {
    const wv = webviewRefs.current.get(activeTabId)
    safeCall(() => (wv as unknown as WebviewAPI)?.reload())
  }

  // 录制开始时记录起始 URL
  useEffect(() => {
    if (isBrowserRecording && activeTab) {
      setStartUrl(activeTab.url)
    }
  }, [isBrowserRecording]) // eslint-disable-line react-hooks/exhaustive-deps

  // 停止录制并保存技能
  const handleStopRecording = useCallback(async (): Promise<void> => {
    toggleBrowserRecording()
    const latestRequests = await window.api.networkCapture.getRequests()

    const endpoints = [...new Set(latestRequests.map(r => {
      try {
        const u = new URL(r.url)
        return u.origin + u.pathname
      } catch {
        return r.url
      }
    }))]

    const steps: SkillStep[] = eventsRef.current.map(ev => {
      if (ev.type === 'navigate') {
        return { tool: 'browser_navigate', arguments: { url: ev.url }, timestamp: ev.timestamp, description: `导航到 ${ev.url}` }
      }
      if (ev.type === 'click') {
        return { tool: 'browser_click', arguments: { selector: ev.selector }, timestamp: ev.timestamp, description: `点击 ${ev.selector}` }
      }
      if (ev.type === 'input') {
        return { tool: 'browser_type', arguments: { selector: ev.selector, text: ev.value }, timestamp: ev.timestamp, description: `输入 "${ev.value}"` }
      }
      return { tool: 'unknown', arguments: {}, timestamp: ev.timestamp }
    })

    const autoName = `技能_${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
    setSkillName(autoName)
    setSkillDesc(`${startUrl ? `从 ${startUrl} 开始的` : ''}操作序列（${steps.length} 步，${endpoints.length} 个 API 端点）`)

    pendingDataRef.current = JSON.stringify({ steps, apiEndpoints: endpoints })
    setShowSaveDialog(true)
  }, [toggleBrowserRecording, startUrl])

  // 监听外部停止录制事件（来自输入框底部的"停止录制"按钮）— 确保执行完整保存流程
  useEffect(() => {
    const handler = (): void => { void handleStopRecording() }
    window.addEventListener('ximo:stop-recording', handler)
    return () => window.removeEventListener('ximo:stop-recording', handler)
  }, [handleStopRecording])

  const handleSaveSkill = useCallback(async (): Promise<void> => {
    const data = JSON.parse(pendingDataRef.current) as { steps: SkillStep[]; apiEndpoints: string[] }
    await window.api.skillRecording.save({
      name: skillName,
      description: skillDesc,
      steps: data.steps,
      apiEndpoints: data.apiEndpoints,
      startUrl
    })
    await loadSkills()
    setShowSaveDialog(false)
    eventsRef.current = []
    setRecordedEvents([])
    await clearCapturedRequests()
  }, [skillName, skillDesc, startUrl, loadSkills, clearCapturedRequests])

  const handleCancelSave = (): void => {
    setShowSaveDialog(false)
    eventsRef.current = []
    setRecordedEvents([])
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 标签栏 */}
      <div className="flex items-center gap-0.5 border-b border-border-subtle px-1 pt-1 shrink-0 bg-bg-surface/30 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`group flex items-center gap-1.5 rounded-t-md px-2.5 py-1 cursor-pointer max-w-[140px] min-w-[80px] transition-colors ${
              tab.id === activeTabId
                ? 'bg-bg-base text-text-primary border-t border-l border-r border-border-subtle -mb-px'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
            }`}
          >
            {tab.loading ? (
              <Loader2 size={10} className="shrink-0 animate-spin" />
            ) : (
              <span className="shrink-0 h-2.5 w-2.5 rounded-full bg-accent/30" />
            )}
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium" title={tab.url}>
              {tab.title || urlToTitle(tab.url)}
            </span>
            <button
              onClick={(e) => handleCloseTab(tab.id, e)}
              className="shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-bg-hover transition-all"
              title="关闭标签页"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {/* 新建标签按钮 */}
        <button
          onClick={() => handleNewTab('https://www.bing.com')}
          className="shrink-0 rounded-md p-1 text-text-muted hover:text-accent hover:bg-bg-hover/50 transition-colors"
          title="新建标签页"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* URL 导航栏 */}
      <div className="flex items-center gap-1 border-b border-border-subtle px-2 py-1.5 shrink-0">
        <button onClick={goBack} disabled={!activeTab?.canGoBack} className="icon-btn rounded-md p-1 disabled:opacity-30" title="后退">
          <ArrowLeft size={13} />
        </button>
        <button onClick={goForward} disabled={!activeTab?.canGoForward} className="icon-btn rounded-md p-1 disabled:opacity-30" title="前进">
          <ArrowRight size={13} />
        </button>
        <button onClick={reload} className="icon-btn rounded-md p-1" title="刷新">
          {activeTab?.loading ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
        </button>
        <input
          ref={urlInputRef}
          type="text"
          defaultValue={activeTab?.url || ''}
          onKeyDown={handleUrlKeyDown}
          className="min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-base px-2 py-1 text-[11px] text-text-primary focus:border-accent/40 focus:outline-none"
          placeholder="输入 URL 或搜索..."
        />
        <button onClick={() => handleNavigate(urlInputRef.current?.value || activeTab?.url || '')} className="icon-btn rounded-md p-1" title="前往">
          <Search size={13} />
        </button>
        <button onClick={toggleBrowser} className="icon-btn rounded-md p-1 text-red-400 hover:text-red-500" title="关闭浏览器">
          <X size={13} />
        </button>
      </div>

      {/* 录制状态栏 */}
      {isBrowserRecording && (
        <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/8 px-2 py-1 shrink-0">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </div>
          <span className="text-[10px] font-medium text-red-400">录制中</span>
          <span className="text-[9px] text-red-400/70">{recordedEvents.length} 步 · {capturedRequests.length} 个请求</span>
          <button onClick={handleStopRecording} className="ml-auto rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/30 transition-colors">
            停止并保存
          </button>
        </div>
      )}

      {/* webview 浏览器区域 — 所有标签的 webview 都渲染，通过 display 控制可见性 */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
        {tabs.map((tab) => (
          <BrowserTab
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onNewTab={handleNewTab}
            onTitleChange={onTitleChange}
            onNavStateChange={onNavStateChange}
            registerWebview={registerWebview}
            isRecording={isBrowserRecording}
            recordingEventsRef={eventsRef}
            onRecordedEvent={onRecordedEvent}
          />
        ))}
      </div>

      {/* 抓包面板 */}
      {showCapturePanel && (
        <div className="flex max-h-32 flex-col border-t border-border-subtle shrink-0">
          <div className="flex items-center justify-between px-2 py-1 bg-bg-surface/50">
            <div className="flex items-center gap-1.5">
              <Radio size={11} className="text-accent" />
              <span className="text-[10px] font-medium text-text-secondary">API 抓包</span>
              <span className="text-[9px] text-text-muted">{capturedRequests.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => void clearCapturedRequests()} className="icon-btn rounded p-0.5" title="清空">
                <Trash2 size={10} />
              </button>
              <button onClick={() => setShowCapturePanel(false)} className="icon-btn rounded p-0.5" title="收起">
                <X size={10} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {capturedRequests.length === 0 ? (
              <div className="px-3 py-2 text-center text-[10px] text-text-muted">
                {isBrowserRecording ? '等待 API 请求...' : '开启录制后自动捕获 XHR/Fetch 请求'}
              </div>
            ) : (
              capturedRequests.slice(-30).reverse().map((req) => (
                <div key={req.id} className="border-b border-border-subtle/50 px-2 py-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-bold ${
                      req.method === 'GET' ? 'bg-blue-500/15 text-blue-400' :
                      req.method === 'POST' ? 'bg-green-500/15 text-green-400' :
                      req.method === 'PUT' ? 'bg-amber-500/15 text-amber-400' :
                      req.method === 'DELETE' ? 'bg-red-500/15 text-red-400' :
                      'bg-gray-500/15 text-gray-400'
                    }`}>
                      {req.method}
                    </span>
                    {req.statusCode && (
                      <span className={`shrink-0 text-[8px] font-medium ${
                        req.statusCode < 300 ? 'text-green-400' : req.statusCode < 400 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {req.statusCode}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-text-secondary" title={req.url}>
                      {(() => {
                        try {
                          const u = new URL(req.url)
                          return u.pathname + u.search
                        } catch {
                          return req.url
                        }
                      })()}
                    </span>
                    {req.duration !== undefined && (
                      <span className="shrink-0 text-[8px] text-text-muted">{req.duration}ms</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 保存技能对话框 */}
      {showSaveDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="ios-card w-72 p-4 animate-fade-scale">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">保存技能</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-xs text-text-primary focus:border-accent/40 focus:outline-none"
                placeholder="技能名称"
              />
              <textarea
                value={skillDesc}
                onChange={(e) => setSkillDesc(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-xs text-text-primary focus:border-accent/40 focus:outline-none resize-none"
                placeholder="技能描述"
                rows={2}
              />
              <div className="text-[10px] text-text-muted">
                {JSON.parse(pendingDataRef.current || '{"steps":[],"apiEndpoints":[]}').steps.length} 步操作 ·
                {' '}{JSON.parse(pendingDataRef.current || '{"steps":[],"apiEndpoints":[]}').apiEndpoints.length} 个 API 端点
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={handleCancelSave} className="btn-ghost rounded-lg px-3 py-1 text-xs">取消</button>
              <button onClick={handleSaveSkill} className="btn-primary rounded-lg px-3 py-1 text-xs">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
