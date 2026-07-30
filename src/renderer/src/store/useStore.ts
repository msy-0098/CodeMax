import { create } from 'zustand'
import type {
  AppSettings,
  ChatMessage,
  Conversation,
  Mode,
  Skill,
  RecordingSession,
  ReasoningEffort,
  CapturedRequest,
  StreamingSegment,
} from '../../../shared/types'
import { runStream, STREAMING_RESET, buildPersistPatch } from './runStream'
import { createDesignSlice } from './slices/designSlice'
import { createBrowserSlice } from './slices/browserSlice'
import { createSkillsSlice } from './slices/skillsSlice'
import { createAgentSlice } from './slices/agentSlice'

// StoreState 统一由 ./types 定义，此处 re-export 保持向后兼容
export type { StoreState, AgentTodo, CanvasItem, StreamingToolCall, ComponentMeta } from './types'
import type { StoreState } from './types'

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function makeTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 24 ? clean.slice(0, 24) + '…' : clean || '新对话'
}

export const useStore = create<StoreState>()((...args) => {
  const [set, get] = args
  return {
  // ---- Slices ----
  ...createDesignSlice(...args),
  ...createBrowserSlice(...args),
  ...createSkillsSlice(...args),
  ...createAgentSlice(...args),

  // ---- 核心状态 ----
  settings: null,
  conversations: [],
  currentMode: 'office',
  currentConversationId: null,
  currentConversationIds: { office: null, coding: null, design: null },
  isStreaming: false,
  streamingContent: '',
  streamingReasoning: '',
  streamingSegments: [],
  streamingConversationId: null,
  streamingTokens: null,
  streamingCacheHitTokens: null,
  streamingPromptTokens: null,
  streamingToolCalls: [],
  streamingAssistantId: null,
  showSettings: false,
  error: null,
  networkSearchOn: false,
  autoModeLevel: 'off',
  projectPath: '',
  attachedFiles: [],
  pastedImagePaths: [],
  collapsedProjects: {},

  _persist: async () => {
    await window.api.conversations.save(get().conversations)
  },

  init: async () => {
    const [settings, conversations] = await Promise.all([
      window.api.settings.load(),
      window.api.conversations.load()
    ])
    // 为每个模式找到最近的会话作为默认选中
    const currentConversationIds: Record<Mode, string | null> = { office: null, coding: null, design: null }
    for (const mode of ['office', 'coding', 'design'] as Mode[]) {
      const latest = conversations
        .filter((c) => c.mode === mode)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
      if (latest) currentConversationIds[mode] = latest.id
    }
    const currentConversationId = currentConversationIds.office
    const currentConv = conversations.find((c) => c.id === currentConversationId) ?? null
    set({
      settings,
      conversations,
      currentConversationIds,
      currentConversationId,
      projectPath: currentConv?.projectPath || '',
      autoModeLevel: settings.defaultAutoModeLevel ?? 'off',
      networkSearchOn: settings.defaultNetworkSearchOn ?? false
    })
  },

  updateSettings: async (partial) => {
    const current = get().settings
    if (!current) return
    const updated = { ...current, ...partial }
    await window.api.settings.save(updated)
    set({ settings: updated })
  },

  setShowSettings: (show) => set({ showSettings: show }),

  setMode: (mode) => {
    const ids = get().currentConversationIds
    const convId = ids[mode] ?? null
    const conv = convId ? get().conversations.find((c) => c.id === convId) : null
    set({
      currentMode: mode,
      currentConversationId: convId,
      projectPath: conv?.projectPath || '',
      error: null
    })
    get().restoreAgentTodos()
  },

  newConversation: (mode) => {
    const useMode = mode ?? get().currentMode
    const id = genId()
    const currentProjectPath = get().projectPath
    const conversation: Conversation = {
      id,
      title: '新对话',
      mode: useMode,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      projectPath: (useMode === 'coding' || useMode === 'design') && currentProjectPath ? currentProjectPath : undefined
    }
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversationId: id,
      currentConversationIds: { ...state.currentConversationIds, [useMode]: id },
      currentMode: useMode,
      error: null
    }))
    void get()._persist()
    return id
  },

  selectConversation: (id) => {
    const conv = get().conversations.find((c) => c.id === id)
    if (conv) {
      set({
        currentConversationId: id,
        currentConversationIds: { ...get().currentConversationIds, [conv.mode]: id },
        currentMode: conv.mode,
        projectPath: conv.projectPath || '',
        error: null
      })
      get().restoreAgentTodos()
    }
  },

  deleteConversation: (id) => {
    const remaining = get().conversations.filter((c) => c.id !== id)
    const state = get()
    const ids = { ...state.currentConversationIds }
    for (const mode of Object.keys(ids) as Mode[]) {
      if (ids[mode] === id) ids[mode] = null
    }
    const nextTodos = { ...state.agentTodosByConv }
    delete nextTodos[id]
    set({
      conversations: remaining,
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
      currentConversationIds: ids,
      agentTodosByConv: nextTodos
    })
    void get()._persist()
  },

  renameConversation: (id, title) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      )
    }))
    void get()._persist()
  },

  clearAllConversations: () => {
    set({
      conversations: [],
      currentConversationId: null,
      currentConversationIds: { office: null, coding: null, design: null }
    })
    void get()._persist()
  },

  sendMessage: async (text, options) => {
    const state = get()
    if (state.isStreaming) return
    let trimmed = text.trim()
    if (!trimmed) return

    // 联网搜索提示注入
    if (state.networkSearchOn && !options?.skipNetworkHint) {
      if (!trimmed.includes('联网搜索') && !trimmed.includes('web_search')) {
        trimmed = `[联网搜索模式] 请优先使用 web_search 工具搜索最新信息来回答以下问题：\n\n${trimmed}`
      }
    }

    // 附加文件信息注入 — 区分图片文件和普通文件
    if (state.attachedFiles.length > 0) {
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
      const imageFiles = state.attachedFiles.filter((f) => {
        const ext = f.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
        return imageExts.includes(ext)
      })
      const otherFiles = state.attachedFiles.filter((f) => !imageFiles.includes(f))
      const parts: string[] = []
      if (imageFiles.length > 0) {
        const imgList = imageFiles.map((f) => `- ${f}`).join('\n')
        parts.push(`📎 附加图片：\n${imgList}\n请使用 vision_analyze(file_path="图片路径", prompt="分析指令") 工具来分析以上图片内容。`)
      }
      if (otherFiles.length > 0) {
        const fileList = otherFiles.map((f) => `- ${f}`).join('\n')
        parts.push(`📎 附加文件：\n${fileList}\n请先使用 file_read 工具读取以上文件内容，再根据内容回答。`)
      }
      trimmed = `${trimmed}\n\n${parts.join('\n\n')}`
      get().clearAttachedFiles()
    }

    // UI 组件选择注入 — 设计模式下，将用户选择的组件列表附在消息中
    if (state.selectedComponentIds.length > 0 && state.currentMode === 'design') {
      const compList = state.selectedComponentIds.map((id, i) =>
        `${i + 1}. design_component(action="get", component_id="${id}")`
      ).join('\n')
      trimmed = `${trimmed}\n\n🧩 请使用以下 ${state.selectedComponentIds.length} 个 UI 组件来生成页面，先逐个获取源码再组合到 HTML 中：\n${compList}`
      get().clearSelectedComponents()
    }

    // @file 引用解析 — 直接读取文件内容注入上下文（避免浪费工具轮次）
    const mentionMatches = [...trimmed.matchAll(/@([^\s@]+\.\w+)/g)]
    if (mentionMatches.length > 0 && state.projectPath) {
      const sep = state.projectPath.includes('\\') ? '\\' : '/'
      const fileContents: string[] = []
      for (const match of mentionMatches) {
        const relativePath = match[1]
        const absPath = `${state.projectPath}${sep}${relativePath.replace(/\//g, sep)}`
        try {
          const result = await window.api.fs.readFileContent(absPath, 300)
          if (result.success && result.content) {
            const ext = relativePath.split('.').pop() || ''
            fileContents.push(`### \`${relativePath}\` (${result.totalLines} 行)\n\`\`\`${ext}\n${result.content}\n\`\`\``)
          } else {
            fileContents.push(`### \`${relativePath}\`\n⚠️ ${result.error || '读取失败'}`)
          }
        } catch {
          fileContents.push(`### \`${relativePath}\`\n⚠️ 读取异常`)
        }
      }
      if (fileContents.length > 0) {
        trimmed = trimmed.replace(/@([^\s@]+\.\w+)/g, '`$1`')
        trimmed = `${trimmed}\n\n📎 引用文件内容：\n${fileContents.join('\n\n')}`
      }
    }

    // 确保有当前会话
    let conversationId = state.currentConversationId
    let conversation = state.getCurrentConversation()
    if (!conversation) {
      conversationId = get().newConversation()
      conversation = get().conversations.find((c) => c.id === conversationId) ?? null
    }
    if (!conversation || !conversationId) {
      return
    }

    const settings = state.settings
    if (!settings) return

    // 前端预检 API Key，避免空 Key 导致请求卡死
    if (!settings.apiKey.trim()) {
      set({ error: '请先在设置中配置 API Key 后再发送消息。', isStreaming: false })
      return
    }

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      ...(options?.slashCommand ? { slashCommand: options.slashCommand } : {})
    }

    const isFirst = conversation.messages.length === 0
    const assistantMsgId = genId()
    const placeholderMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              title: isFirst ? makeTitle(trimmed) : c.title,
              messages: [...c.messages, userMsg, placeholderMsg],
              updatedAt: Date.now()
            }
          : c
      ),
      isStreaming: true,
      streamingContent: '',
      streamingReasoning: '',
      streamingSegments: [{ reasoning: '', content: '', toolCalls: [] }],
      streamingConversationId: conversationId,
      streamingAssistantId: assistantMsgId,
      streamingTokens: null,
      streamingCacheHitTokens: null,
      streamingPromptTokens: null,
      error: null
    }))

    await runStream(get, set, conversationId)
  },

  regenerate: async () => {
    const state = get()
    if (state.isStreaming) return
    const conversation = state.getCurrentConversation()
    if (!conversation || conversation.messages.length === 0) return

    const msgs = [...conversation.messages]
    while (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
      msgs.pop()
    }
    if (msgs.length === 0) return

    const assistantMsgId = genId()
    const placeholderMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversation.id ? { ...c, messages: [...msgs, placeholderMsg], updatedAt: Date.now() } : c
      ),
      isStreaming: true,
      streamingContent: '',
      streamingReasoning: '',
      streamingSegments: [{ reasoning: '', content: '', toolCalls: [] }],
      streamingConversationId: conversation.id,
      streamingAssistantId: assistantMsgId,
      streamingTokens: null,
      streamingCacheHitTokens: null,
      streamingPromptTokens: null,
      error: null
    }))

    await runStream(get, set, conversation.id)
  },

  cancelStream: async () => {
    await window.api.chat.cancel()
    const state = get()
    const { streamingConversationId: convId, streamingContent, streamingAssistantId } = state
    const accumTotal = state.streamingTokens ?? 0
    const accumCacheHit = state.streamingCacheHitTokens ?? 0
    const accumPrompt = state.streamingPromptTokens ?? 0
    const hasTokenData = accumTotal > 0
    // 计算持久化 segments（仅多轮时保留）
    const segs = state.streamingSegments
    const persistSegments = segs && segs.length > 1
      ? segs.filter(s => s.reasoning || s.content || s.toolCalls.length > 0).map(s => ({
          reasoning: s.reasoning,
          content: s.content,
          toolCalls: s.toolCalls.map(tc => ({ ...tc, status: 'done' as const }))
        }))
      : undefined
    if (convId && streamingContent && streamingAssistantId) {
      set((s) => buildPersistPatch(s, convId, {
        content: streamingContent,
        reasoningContent: state.streamingReasoning || undefined,
        segments: persistSegments,
        model: state.settings?.model,
        tokens: hasTokenData ? accumTotal : undefined,
        cacheHitTokens: accumCacheHit > 0 ? accumCacheHit : undefined
      }, hasTokenData ? { total: accumTotal, prompt: accumPrompt, cacheHit: accumCacheHit } : null))
      void state._persist()
      return
    }
    set(STREAMING_RESET)
  },

  getCurrentConversation: () => {
    const { conversations, currentConversationId } = get()
    return conversations.find((c) => c.id === currentConversationId) ?? null
  },

  setNetworkSearchOn: (on) => set({ networkSearchOn: on }),
  setAutoModeLevel: (level) => {
    set({ autoModeLevel: level })
    const settings = get().settings
    if (settings && settings.yoloMode !== (level === 'yolo')) {
      void get().updateSettings({ yoloMode: level === 'yolo' })
    }
  },
  setProjectPath: (path) => {
    set({ projectPath: path })
    const convId = get().currentConversationId
    if (convId) {
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId ? { ...c, projectPath: path || undefined, updatedAt: Date.now() } : c
        )
      }))
      void get()._persist()
    }
  },
  addAttachedFile: (path) => set((s) => ({
    attachedFiles: s.attachedFiles.includes(path) ? s.attachedFiles : [...s.attachedFiles, path]
  })),
  removeAttachedFile: (path) => set((s) => ({
    attachedFiles: s.attachedFiles.filter((f) => f !== path)
  })),
  clearAttachedFiles: () => set({ attachedFiles: [] }),
  addPastedImage: (path) => set((s) => ({
    pastedImagePaths: s.pastedImagePaths.includes(path) ? s.pastedImagePaths : [...s.pastedImagePaths, path]
  })),
  clearPastedImages: () => set({ pastedImagePaths: [] }),
  reloadConversations: async () => {
    const conversations = await window.api.conversations.load()
    const oldIds = get().currentConversationIds
    const currentConversationIds: Record<Mode, string | null> = {
      office: oldIds.office && conversations.find((c) => c.id === oldIds.office) ? oldIds.office : null,
      coding: oldIds.coding && conversations.find((c) => c.id === oldIds.coding) ? oldIds.coding : null,
      design: oldIds.design && conversations.find((c) => c.id === oldIds.design) ? oldIds.design : null
    }
    const convId = get().currentConversationId
    const currentConv = conversations.find((c) => c.id === convId)
    set({
      conversations,
      currentConversationIds,
      currentConversationId: currentConv ? convId : null,
      projectPath: currentConv?.projectPath || ''
    })
  },

  openProject: async () => {
    const folder = await window.api.dialog.openFolder()
    if (!folder) return

    const folderName = folder.split(/[/\\]/).pop() || folder
    const state = get()
    const mode = state.currentMode === 'design' ? 'design' : 'coding'

    set({ projectPath: folder, currentMode: mode })

    const currentRecent = state.settings?.recentProjects ?? []
    const updatedRecent = [folder, ...currentRecent.filter((p) => p !== folder)].slice(0, 10)
    void get().updateSettings({ recentProjects: updatedRecent })

    const conversationId = state.currentConversationId
    const currentConv = state.getCurrentConversation()

    if (currentConv && currentConv.mode === mode && currentConv.messages.length === 0) {
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, projectPath: folder, title: folderName, mode, updatedAt: Date.now() }
            : c
        )
      }))
    } else {
      const id = genId()
      const conversation: Conversation = {
        id,
        title: folderName,
        mode,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projectPath: folder
      }
      set((s) => ({
        conversations: [conversation, ...s.conversations],
        currentConversationId: id,
        currentConversationIds: { ...s.currentConversationIds, [mode]: id },
        currentMode: mode,
        error: null
      }))
    }

    void get()._persist()
  },

  toggleProjectCollapsed: (projectPath) => {
    set((s) => ({
      collapsedProjects: {
        ...s.collapsedProjects,
        [projectPath]: !s.collapsedProjects[projectPath]
      }
    }))
  },

  newConversationForProject: (projectPath, mode) => {
    const useMode = mode ?? get().currentMode
    if (!projectPath) return null
    const folderName = projectPath.split(/[/\\]/).pop() || projectPath
    const id = genId()
    const conversation: Conversation = {
      id,
      title: '新对话',
      mode: useMode,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      projectPath
    }
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversationId: id,
      currentConversationIds: { ...state.currentConversationIds, [useMode]: id },
      currentMode: useMode,
      projectPath,
      error: null
    }))
    void get()._persist()
    return id
  },

  removeProject: (projectPath) => {
    const state = get()
    const remaining = state.conversations.filter((c) => c.projectPath !== projectPath)
    const removedIds = state.conversations.filter((c) => c.projectPath === projectPath).map((c) => c.id)
    const ids = { ...state.currentConversationIds }
    for (const mode of Object.keys(ids) as Mode[]) {
      if (ids[mode] && removedIds.includes(ids[mode]!)) ids[mode] = null
    }
    const currentRecent = state.settings?.recentProjects ?? []
    const updatedRecent = currentRecent.filter((p) => p !== projectPath)
    void get().updateSettings({ recentProjects: updatedRecent })
    set({
      conversations: remaining,
      currentConversationId: removedIds.includes(state.currentConversationId ?? '') ? null : state.currentConversationId,
      currentConversationIds: ids,
      projectPath: removedIds.includes(state.currentConversationId ?? '') ? '' : state.projectPath
    })
    void get()._persist()
  },
}
})
