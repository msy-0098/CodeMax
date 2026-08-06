import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Paperclip, AtSign, Globe, ArrowUp, Zap, X, Square, FileText, Play, Palette, Box, Image } from 'lucide-react'
import { useStore } from '../store/useStore'
import { SessionTokenStats } from './shared/SessionTokenStats'
import { getAgentById, ensureAgentsLoaded } from '../agents'
import type { Mode, FileTreeNode, Skill } from '../../../shared/types'
import { MODE_PLACEHOLDERS, getSlashCommands, STYLE_CATALOG, COMPONENT_CATALOG } from './chat-input/constants'
import { ModelSelector } from './chat-input/ModelSelector'
import { ReasoningSlider } from './chat-input/ReasoningSliderStarfield'
import { ExpertPicker } from './chat-input/ExpertPicker'
import { StylePicker } from './chat-input/StylePicker'
import { ComponentPicker } from './chat-input/ComponentPicker'

export function GlobalChatInput(): React.ReactElement {
  const sendMessage = useStore((s) => s.sendMessage)
  const cancelStream = useStore((s) => s.cancelStream)
  const isStreaming = useStore((s) => s.isStreaming)
  const currentMode = useStore((s) => s.currentMode)
  const networkSearchOn = useStore((s) => s.networkSearchOn)
  const setNetworkSearchOn = useStore((s) => s.setNetworkSearchOn)
  const autoModeLevel = useStore((s) => s.autoModeLevel)
  const setAutoModeLevel = useStore((s) => s.setAutoModeLevel)
  const projectPath = useStore((s) => s.projectPath)
  const openProject = useStore((s) => s.openProject)
  const setProjectPath = useStore((s) => s.setProjectPath)
  const addAttachedFile = useStore((s) => s.addAttachedFile)
  const attachedFiles = useStore((s) => s.attachedFiles)
  const removeAttachedFile = useStore((s) => s.removeAttachedFile)
  const addPastedImage = useStore((s) => s.addPastedImage)
  const pastedImagePaths = useStore((s) => s.pastedImagePaths)
  const clearPastedImages = useStore((s) => s.clearPastedImages)
  const activeExperts = useStore((s) => s.activeExperts)
  const toggleExpert = useStore((s) => s.toggleExpert)
  const activeStyleId = useStore((s) => s.activeStyleId)
  const setActiveStyleId = useStore((s) => s.setActiveStyleId)
  const selectedComponentIds = useStore((s) => s.selectedComponentIds)
  const toggleComponent = useStore((s) => s.toggleComponent)
  const clearSelectedComponents = useStore((s) => s.clearSelectedComponents)
  const pendingDraft = useStore((s) => s.pendingDraft)
  const clearDraft = useStore((s) => s.clearDraft)
  const conversation = useStore((s) => s.conversations.find((c) => c.id === s.currentConversationId) ?? null)

  // 办公模式：内嵌浏览器 + 录制 + 技能 + 操控电脑
  const browserOpen = useStore((s) => s.browserOpen)
  const toggleBrowser = useStore((s) => s.toggleBrowser)
  const isBrowserRecording = useStore((s) => s.isBrowserRecording)
  const toggleBrowserRecording = useStore((s) => s.toggleBrowserRecording)
  const computerUseRunning = useStore((s) => s.computerUseRunning)
  const toggleComputerUse = useStore((s) => s.toggleComputerUse)
  const refreshComputerUseStatus = useStore((s) => s.refreshComputerUseStatus)

  const [textByMode, setTextByMode] = useState<Record<Mode, string>>({ office: '', coding: '', design: '' })
  const text = textByMode[currentMode]
  const setText = (t: string): void => setTextByMode((prev) => ({ ...prev, [currentMode]: t }))
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [agentsReady, setAgentsReady] = useState(false)

  // 斜杠命令胶囊状态 — 激活后在输入框上方显示小胶囊，不填充提示词到 textarea
  const [activeSlashCmd, setActiveSlashCmd] = useState<{ cmd: string; systemHint: string } | null>(null)

  // 技能选择器
  const [showSkillPicker, setShowSkillPicker] = useState(false)
  const [skills, setSkills] = useState<Skill[]>([])
  const skillPickerRef = useRef<HTMLDivElement>(null)

  // @file 引用相关状态
  const [showFileMention, setShowFileMention] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [projectFiles, setProjectFiles] = useState<string[]>([])
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const fileMentionRef = useRef<HTMLDivElement>(null)

  // 芯片显示用的计算值
  const activeStyle = useMemo(() => STYLE_CATALOG.find((s) => s.id === activeStyleId) ?? null, [activeStyleId])
  const selectedComponents = useMemo(
    () => COMPONENT_CATALOG.filter((c) => selectedComponentIds.includes(c.id)),
    [selectedComponentIds]
  )

  // 扁平化文件树为路径列表
  const flattenTree = useCallback((nodes: FileTreeNode[], prefix = ''): string[] => {
    const result: string[] = []
    for (const node of nodes) {
      const fullPath = prefix ? `${prefix}/${node.name}` : node.name
      if (node.type === 'file') {
        result.push(fullPath)
      }
      if (node.children && node.children.length > 0) {
        result.push(...flattenTree(node.children, fullPath))
      }
    }
    return result
  }, [])

  // 加载项目文件列表
  useEffect(() => {
    if (currentMode !== 'coding' || !projectPath) {
      setProjectFiles([])
      return
    }
    let cancelled = false
    const loadFiles = async (): Promise<void> => {
      try {
        const tree = await window.api.fs.listDir(projectPath)
        if (!cancelled && tree) {
          setProjectFiles(flattenTree(tree))
        }
      } catch {
        // 静默处理
      }
    }
    void loadFiles()
    return () => { cancelled = true }
  }, [projectPath, currentMode, flattenTree])

  // 检测 @file 引用
  useEffect(() => {
    if (currentMode !== 'coding' || !projectPath) {
      setShowFileMention(false)
      return
    }
    const ta = textareaRef.current
    if (!ta) return
    const cursorPos = ta.selectionStart
    const beforeCursor = text.slice(0, cursorPos)
    const atMatch = beforeCursor.match(/@([^\s@]*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setShowFileMention(true)
      setSelectedMentionIndex(0)
    } else {
      setShowFileMention(false)
    }
  }, [text, currentMode, projectPath])

  // 过滤匹配的文件
  const matchedFiles = useMemo(() => {
    if (!mentionQuery) return projectFiles.slice(0, 10)
    const lower = mentionQuery.toLowerCase()
    return projectFiles
      .filter((f) => f.toLowerCase().includes(lower))
      .slice(0, 10)
  }, [mentionQuery, projectFiles])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'
  }, [text])

  // 拾取 pendingDraft — 编辑用户消息时回填输入框（含斜杠命令胶囊）
  useEffect(() => {
    if (pendingDraft !== null) {
      setText(pendingDraft.text)
      setActiveSlashCmd(pendingDraft.slashCommand ?? null)
      clearDraft()
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [pendingDraft, clearDraft])

  // 粘贴图片 — Ctrl+V 时检测剪贴板中的图片
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent): Promise<void> => {
      // 如果剪贴板有图片（如截图），保存为临时文件并附加
      const items = e.clipboardData?.items
      if (!items) return
      let hasImage = false
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          hasImage = true
          break
        }
      }
      if (!hasImage) return

      // 使用主进程剪贴板 API 保存图片到 userData 目录（避免 Windows 8.3 短路径）
      e.preventDefault()
      try {
        const filePath = await window.api.clipboard.saveImage()
        if (filePath) {
          addAttachedFile(filePath)
          addPastedImage(filePath)
        }
      } catch {
        // 静默处理
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [addAttachedFile, addPastedImage])

  // 流式结束后：询问用户是否删除本次粘贴的截图
  const prevStreamingRef = useRef(false)
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && pastedImagePaths.length > 0) {
      const shouldDelete = window.confirm(
        `本次任务使用了 ${pastedImagePaths.length} 张粘贴的截图，是否删除这些临时图片？`
      )
      if (shouldDelete) {
        void window.api.clipboard.deleteImages(pastedImagePaths)
      }
      clearPastedImages()
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, pastedImagePaths, clearPastedImages])

  // 拖拽图片到输入框
  const [isDragOver, setIsDragOver] = useState(false)
  const handleDragOver = (e: React.DragEvent): void => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      setIsDragOver(true)
    }
  }
  const handleDragLeave = (e: React.DragEvent): void => {
    if (e.currentTarget === e.target) setIsDragOver(false)
  }
  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsDragOver(false)
    // Electron 拖拽文件提供 path 属性
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        // Electron 的 File 对象有 path 属性
        const filePath = (file as unknown as { path?: string }).path
        if (filePath) {
          addAttachedFile(filePath)
        }
      }
    }
  }

  // 斜杠命令匹配 — 所有模式都支持
  useEffect(() => {
    if (text === '/') {
      setShowSlashMenu(true)
    } else {
      setShowSlashMenu(false)
    }
  }, [text])

  // 按需加载专家数据 — 有激活专家时才加载（用于芯片显示）
  useEffect(() => {
    if (activeExperts.length > 0 && !agentsReady) {
      ensureAgentsLoaded().then(() => setAgentsReady(true))
    }
  }, [activeExperts.length, agentsReady])

  // 技能选择器 click-outside
  useEffect(() => {
    if (!showSkillPicker) return
    const handler = (e: MouseEvent): void => {
      if (skillPickerRef.current && !skillPickerRef.current.contains(e.target as Node)) setShowSkillPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSkillPicker])

  // 办公模式：加载技能列表 + 初始化操控电脑状态
  useEffect(() => {
    if (currentMode !== 'office') return
    void refreshComputerUseStatus()
    const loadSkills = async (): Promise<void> => {
      try {
        const loaded = await window.api.skills.load()
        setSkills(loaded)
      } catch { /* ignore */ }
    }
    void loadSkills()
  }, [currentMode, refreshComputerUseStatus])

  // 流式结束后刷新技能列表（录制完成可能新增技能）
  useEffect(() => {
    if (!isStreaming && currentMode === 'office') {
      window.api.skills.load().then(setSkills).catch(() => {})
    }
  }, [isStreaming, currentMode])

  const handleSend = (): void => {
    if (isStreaming) return
    const trimmed = text.trim()
    if (!trimmed) return
    sendMessage(trimmed, activeSlashCmd ? { slashCommand: activeSlashCmd } : undefined)
    setText('')
    setActiveSlashCmd(null)
    setShowSlashMenu(false)
    setShowFileMention(false)
  }

  const insertFileMention = (filePath: string): void => {
    const ta = textareaRef.current
    if (!ta) return
    const cursorPos = ta.selectionStart
    const beforeCursor = text.slice(0, cursorPos)
    const afterCursor = text.slice(cursorPos)
    const newText = beforeCursor.replace(/@([^\s@]*)$/, `@${filePath} `) + afterCursor
    setText(newText)
    setShowFileMention(false)
    requestAnimationFrame(() => {
      ta.focus()
      const newPos = beforeCursor.replace(/@([^\s@]*)$/, `@${filePath} `).length
      ta.setSelectionRange(newPos, newPos)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (showFileMention && matchedFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex((prev) => (prev + 1) % matchedFiles.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex((prev) => (prev - 1 + matchedFiles.length) % matchedFiles.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertFileMention(matchedFiles[selectedMentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowFileMention(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSlashCommand = (cmd: string, systemHint: string): void => {
    setActiveSlashCmd({ cmd, systemHint })
    setText('')
    setShowSlashMenu(false)
    textareaRef.current?.focus()
  }

  const handleAttachFile = async (): Promise<void> => {
    try {
      // 所有模式都支持选择图片 + 通用文件
      const filters = [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
      const files = await window.api.dialog.openFile(filters)
      if (!files || !Array.isArray(files)) return
      for (const f of files) {
        addAttachedFile(f)
      }
    } catch {
      // 用户取消或 IPC 异常时静默处理
    }
  }

  const placeholder = MODE_PLACEHOLDERS[currentMode]

  return (
    <div className="relative z-10 px-4 py-3">
      <div className="mx-auto max-w-4xl">
        {/* 附加文件标签 */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachedFiles.map((f) => {
              const name = f.split(/[/\\]/).pop() || f
              const ext = f.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
              const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext)
              return (
                <span key={f} className="chip px-2 py-0.5 text-[11px] text-accent animate-scale-in">
                  {isImage ? <Image size={10} /> : <Paperclip size={10} />}
                  {name}
                  <button onClick={() => removeAttachedFile(f)} className="ml-0.5 hover:text-red-400 transition-colors">
                    <X size={10} />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* 已激活的 AI 专家标签（非设计模式） */}
        {currentMode !== 'design' && activeExperts.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {activeExperts.map((id) => {
              const agent = getAgentById(id)
              if (!agent) return null
              return (
                <span key={id} className="chip flex items-center gap-1 px-2 py-0.5 text-[11px] text-accent border-accent/30 bg-accent/10 animate-scale-in">
                  {agent.emoji} {agent.name}
                  <button onClick={() => toggleExpert(id)} className="ml-0.5 hover:text-red-400 transition-colors">
                    <X size={10} />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* 已绑定的设计风格标签（设计模式） */}
        {currentMode === 'design' && activeStyle && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            <span className="chip flex items-center gap-1 px-2 py-0.5 text-[11px] text-accent border-accent/30 bg-accent/10 animate-scale-in">
              <Palette size={10} />
              {activeStyle.name}
              <button onClick={() => setActiveStyleId(null)} className="ml-0.5 hover:text-red-400 transition-colors" title="解除风格绑定">
                <X size={10} />
              </button>
            </span>
          </div>
        )}

        {/* 已选择的 UI 组件标签（设计模式） */}
        {currentMode === 'design' && selectedComponents.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedComponents.map((c) => (
              <span key={c.id} className="chip flex items-center gap-1 px-2 py-0.5 text-[11px] text-accent border-accent/30 bg-accent/10 animate-scale-in">
                <Box size={10} />
                {c.nameCn}
                <button onClick={() => toggleComponent(c.id)} className="ml-0.5 hover:text-red-400 transition-colors" title="移除组件">
                  <X size={10} />
                </button>
              </span>
            ))}
            <button onClick={clearSelectedComponents} className="text-[10px] text-text-muted hover:text-red-400 transition-colors px-1">
              清空
            </button>
          </div>
        )}

        {/* 斜杠命令胶囊 — 激活后显示小胶囊，hover 显示提示词摘要 */}
        {activeSlashCmd && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            <span
              className="chip flex items-center gap-1 px-2 py-0.5 text-[11px] text-accent border-accent/30 bg-accent/10 animate-scale-in cursor-default"
              title={activeSlashCmd.systemHint}
            >
              {activeSlashCmd.cmd.replace(/^\//, '')}
              <button
                onClick={() => setActiveSlashCmd(null)}
                className="ml-0.5 hover:text-red-400 transition-colors"
                title="移除"
              >
                <X size={10} />
              </button>
            </span>
          </div>
        )}

        {/* 输入框区域 — Google Material Style 输入框 */}
        <div
          className={`rounded-xl border bg-bg-surface transition-all duration-200 ${
            isStreaming
              ? 'border-accent/40 ring-1 ring-accent/20'
              : isDragOver
                ? 'border-accent border-2'
                : 'border-border-subtle hover:border-border-hover focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="no-drag w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
            style={{ maxHeight: '180px' }}
          />

          {/* @file 引用弹出菜单 */}
          {showFileMention && matchedFiles.length > 0 && (
            <div
              ref={fileMentionRef}
              className="panel mx-3 mb-1 flex max-h-48 flex-col animate-scale-in"
            >
              <div className="panel__header">
                <span>文件引用</span>
                <span className="text-[10px] text-text-muted">↑↓ 导航 · Enter/Tab 确认 · Esc 取消</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {matchedFiles.map((file, i) => {
                  const fileName = file.split('/').pop() || file
                  const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
                  return (
                    <button
                      key={file}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        insertFileMention(file)
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                        i === selectedMentionIndex ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:bg-bg-hover'
                      }`}
                    >
                      <span className="truncate flex-1 font-mono">{fileName}</span>
                      {dir && <span className="truncate text-[10px] text-text-muted">{dir}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 拖拽提示层 */}
          {isDragOver && (
            <div className="mx-3.5 mb-2 rounded-lg border-2 border-dashed border-accent/40 bg-accent/5 p-2 text-center text-xs font-medium text-accent">
              松开鼠标添加图片 / 文本文件
            </div>
          )}

          {/* 工具条：模型/芯片/思维链 */}
          <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-1 border-t border-border-subtle/50">
            {/* 左侧：附件与引用 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) {
                      addAttachedFile((file as any).path || file.name)
                    }
                  }
                  input.click()
                }}
                className="chip flex items-center gap-1 px-2 py-1 text-[11px] text-text-muted hover:text-text-secondary hover:bg-bg-hover rounded-md transition-colors"
                title="上传附件（也可直接拖拽文件）"
              >
                <Paperclip size={12} />
                附件
              </button>

              <button
                onClick={() => {
                  setText(text + '@')
                  textareaRef.current?.focus()
                }}
                className="chip flex items-center gap-1 px-2 py-1 text-[11px] text-text-muted hover:text-text-secondary hover:bg-bg-hover rounded-md transition-colors"
                title="引用文件 (@)"
              >
                <AtSign size={12} />
                引用
              </button>
              {/* AI 专家选择 */}
              {currentMode === 'design' ? (
                <>
                  <StylePicker />
                  <ComponentPicker />
                </>
              ) : (
                <ExpertPicker />
              )}

              <button
                onClick={() => setNetworkSearchOn(!networkSearchOn)}
                className={`chip flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors ${
                  networkSearchOn
                    ? 'border-accent/40 text-accent bg-accent/10'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
                }`}
                title="联网搜索"
              >
                <Globe size={12} />
                联网
              </button>

              {/* Auto Mode */}
              <button
                onClick={() => {
                  const next = autoModeLevel === 'off' ? 'safe' : autoModeLevel === 'safe' ? 'yolo' : 'off'
                  setAutoModeLevel(next)
                }}
                className={`chip flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  autoModeLevel === 'yolo'
                    ? 'border-rose-500/40 text-rose-500 bg-rose-500/10'
                    : autoModeLevel === 'safe'
                    ? 'border-accent/40 text-accent bg-accent/10'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
                }`}
                title={autoModeLevel === 'off' ? '手动确认' : autoModeLevel === 'safe' ? '安全模式：仅读操作自动执行' : 'YOLO 模式：全部自动执行'}
              >
                <Zap size={11} />
                {autoModeLevel === 'off' ? '手动' : autoModeLevel === 'safe' ? 'Safe' : 'YOLO'}
              </button>
            </div>

            {/* 右侧：模型选择 + Google 标准发送按钮 */}
            <div className="flex items-center gap-2">
              <StreamingTokenCount />
              <ModelSelector />
              <ReasoningSlider />
              {isStreaming ? (
                <button
                  onClick={cancelStream}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-700 active:scale-[0.96]"
                  title="取消"
                >
                  <Square size={12} />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white dark:text-[#121212] shadow-sm transition-colors hover:brightness-105 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-30"
                  title="发送"
                >
                  <ArrowUp size={14} strokeWidth={2.2} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Token 统计 */}
        <SessionTokenStats conversation={conversation} />

        {/* 斜杠命令弹出菜单 */}
        {showSlashMenu && (
          <div className="panel mt-2 animate-scale-in">
            <div className="flex-1 p-1.5">
              {getSlashCommands(currentMode).map(({ cmd, label, systemHint }) => (
                <button
                  key={cmd}
                  onClick={() => handleSlashCommand(cmd, systemHint)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  <span className="font-mono text-accent">{cmd}</span>
                  <span className="text-text-muted">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 模式专属底部工具区 */}
        <div className="mt-1.5">
          {/* Office 模式：项目目录 + 内嵌浏览器 + 录制 + 技能 + 操控电脑开关 — 纯文字简约风 */}
          {currentMode === 'office' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={openProject}
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
              <span className="mx-1 text-text-muted/30">|</span>

              {/* 内嵌浏览器 */}
              <button
                onClick={() => {
                  if (browserOpen && isBrowserRecording) {
                    window.dispatchEvent(new CustomEvent('codemax:stop-recording'))
                  } else {
                    toggleBrowser()
                  }
                }}
                className={`chip px-2.5 py-1 text-[11px] transition-all duration-200 active:scale-95 ${
                  browserOpen
                    ? 'border-accent/30 text-accent bg-accent/10'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
                title={browserOpen ? (isBrowserRecording ? '正在录制，点击先保存录制内容' : '关闭内嵌浏览器') : '打开内嵌浏览器'}
              >
                浏览器
              </button>

              {/* 录制技能 */}
              <button
                onClick={() => {
                  if (isBrowserRecording) {
                    window.dispatchEvent(new CustomEvent('codemax:stop-recording'))
                  } else {
                    toggleBrowserRecording()
                  }
                }}
                disabled={!browserOpen}
                className={`chip px-2.5 py-1 text-[11px] transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
                  isBrowserRecording
                    ? 'border-red-500/30 text-red-400 bg-red-500/10'
                    : browserOpen
                      ? 'text-text-secondary hover:text-red-400 hover:border-red-500/30'
                      : ''
                }`}
                title={browserOpen ? (isBrowserRecording ? '停止录制' : '录制浏览器操作') : '需先打开浏览器'}
              >
                {isBrowserRecording ? '停止录制' : '录制'}
              </button>

              {/* 调用技能 */}
              <div className="relative" ref={skillPickerRef}>
                <button
                  onClick={() => setShowSkillPicker(!showSkillPicker)}
                  className={`chip px-2.5 py-1 text-[11px] transition-all duration-200 active:scale-95 ${
                    showSkillPicker ? 'border-accent/40 text-accent bg-accent/8' : 'text-text-muted hover:text-accent hover:border-accent/30'
                  }`}
                  title="调用已录制的技能"
                >
                  技能
                  {skills.length > 0 && <span className="text-[9px] opacity-60">({skills.length})</span>}
                </button>

                {/* 技能列表弹出面板 */}
                {showSkillPicker && (
                  <div className="panel absolute bottom-full left-0 mb-2 w-[320px] max-h-[320px] flex flex-col z-50 animate-fade-scale">
                    <div className="panel__header">已录制技能 — 点击调用</div>
                    <div className="flex-1 overflow-y-auto">
                      {skills.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-text-muted">
                          暂无已录制技能
                          <br />
                          <span className="text-[10px]">打开浏览器后点击「录制」按钮开始录制</span>
                        </div>
                      ) : (
                        skills.map((skill) => (
                          <button
                            key={skill.id}
                            onClick={() => {
                              sendMessage(`请使用 skill_invoke(skill_name="${skill.name}") 调用技能 "${skill.name}"。`, { skipNetworkHint: true })
                              setShowSkillPicker(false)
                            }}
                            className="panel__item"
                          >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                              <Play size={9} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-text-primary">{skill.name}</p>
                              <p className="truncate text-[10px] text-text-muted">{skill.description || `${skill.steps.length} 步操作`}</p>
                            </div>
                            <span className="shrink-0 text-[9px] text-text-muted">{skill.invokeCount}次</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 操控电脑 */}
              <button
                onClick={() => void toggleComputerUse()}
                className={`chip px-2.5 py-1 text-[11px] transition-all duration-200 active:scale-95 ${
                  computerUseRunning
                    ? 'border-green-500/30 text-green-400 bg-green-500/10'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
                title={computerUseRunning ? '操控电脑运行中 — 点击关闭' : '启动操控电脑'}
              >
                操控电脑
                <span
                  className={`relative inline-flex h-3 w-5 items-center rounded-full transition-colors duration-200 ${
                    computerUseRunning ? 'bg-green-500/40' : 'bg-border'
                  }`}
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform duration-200 ${
                      computerUseRunning ? 'translate-x-2' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>
            </div>
          )}

          {/* Code 模式：打开项目 + 斜杠命令快捷行 */}
          {currentMode === 'coding' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={openProject}
                className="chip px-2.5 py-1 text-[11px] border-accent/25 text-accent hover:bg-accent/10 transition-all duration-200 active:scale-95"
              >
                {projectPath ? projectPath.split(/[/\\]/).pop() : '打开项目'}
              </button>
              {projectPath && (
                <button
                  onClick={() => setProjectPath('')}
                  className="text-[11px] text-text-muted hover:text-red-400 transition-colors"
                  title="解除项目绑定"
                >
                  <X size={9} />
                </button>
              )}
              <span className="mx-1 text-text-muted/30">|</span>
              {getSlashCommands(currentMode).map(({ cmd, label }) => (
                <button
                  key={cmd}
                  onClick={() => {
                    const found = getSlashCommands(currentMode).find(c => c.cmd === cmd)
                    if (found) handleSlashCommand(cmd, found.systemHint)
                  }}
                  className="chip px-2 py-1 text-[11px] text-text-muted hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all duration-200 active:scale-95"
                  title={label}
                >
                  {cmd}
                </button>
              ))}
            </div>
          )}

          {/* Design 模式：设计提示 */}
          {currentMode === 'design' && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-text-muted">试试：生成一个登录页面、设计一套颜色系统、审查 UI · 点击「风格」绑定设计风格 · 点击「组件」多选 UI 组件</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 流式 token 计数 — 独立订阅 streamingTokens。
 * streamingTokens 每个流式 flush 都变化（~12fps），若由 GlobalChatInput 订阅，
 * 会导致整个输入区（10+ 个子选择器）每次 flush 都全量重渲染。
 */
function StreamingTokenCount(): React.ReactElement | null {
  const streamingTokens = useStore((s) => s.streamingTokens)
  const isStreaming = useStore((s) => s.isStreaming)
  if (streamingTokens === null || !isStreaming) return null
  return <span className="text-[11px] text-text-muted">{streamingTokens.toLocaleString()} tokens</span>
}
