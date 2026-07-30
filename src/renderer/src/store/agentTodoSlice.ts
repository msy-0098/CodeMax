import type { StoreState, AgentTodo } from './useStore'

type Set = (partial: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)) => void
type Get = () => StoreState

export interface AgentTodoSlice {
  // ---- Agent 任务列表 ----
  agentTodosByConv: Record<string, AgentTodo[]>
  taskListCollapsedByConv: Record<string, boolean>
  toggleTaskListCollapsed: () => void
  restoreAgentTodos: () => void
  /** 流式结束后：将残留的 in_progress 标记为 completed，防止转圈不止 */
  markTodosComplete: () => void

  // ---- 消息编辑 ----
  pendingDraft: { text: string; slashCommand?: { cmd: string; systemHint: string } } | null
  editMessage: (messageId: string) => void
  clearDraft: () => void
}

export function createAgentTodoSlice(set: Set, get: Get): AgentTodoSlice {
  return {
    agentTodosByConv: {},
    taskListCollapsedByConv: {},

    toggleTaskListCollapsed: () => {
      const convId = get().currentConversationId
      if (!convId) return
      set((s) => ({
        taskListCollapsedByConv: {
          ...s.taskListCollapsedByConv,
          [convId]: !s.taskListCollapsedByConv[convId]
        }
      }))
    },

    restoreAgentTodos: () => {
      const conv = get().getCurrentConversation()
      const convId = get().currentConversationId
      if (!conv || !convId) return
      for (let i = conv.messages.length - 1; i >= 0; i--) {
        const msg = conv.messages[i]
        if (msg.role !== 'assistant' || !msg.toolResults) continue
        for (let j = msg.toolResults.length - 1; j >= 0; j--) {
          const result = msg.toolResults[j]
          if (result.toolName === 'todo_write' && result.metadata?.todos) {
            set((s) => ({ agentTodosByConv: { ...s.agentTodosByConv, [convId]: result.metadata.todos as AgentTodo[] } }))
            return
          }
        }
      }
      set((s) => {
        if (!(convId in s.agentTodosByConv)) return {}
        const next = { ...s.agentTodosByConv }
        delete next[convId]
        return { agentTodosByConv: next }
      })
    },

    pendingDraft: null,

    editMessage: (messageId) => {
      const state = get()
      const conv = state.getCurrentConversation()
      if (!conv) return
      const msgIndex = conv.messages.findIndex((m) => m.id === messageId)
      if (msgIndex === -1) return
      const msg = conv.messages[msgIndex]
      if (msg.role !== 'user') return
      const remaining = conv.messages.slice(0, msgIndex)
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conv.id
            ? { ...c, messages: remaining, updatedAt: Date.now() }
            : c
        ),
        pendingDraft: { text: msg.content, slashCommand: msg.slashCommand }
      }))
      get().restoreAgentTodos()
      void get()._persist()
    },

    clearDraft: () => set({ pendingDraft: null }),

    markTodosComplete: () => {
      const convId = get().currentConversationId
      if (!convId) return
      const todos = get().agentTodosByConv[convId]
      if (!todos || todos.length === 0) return
      // 只在有 in_progress 项时才更新，避免无意义的 setState
      if (!todos.some((t) => t.status === 'in_progress')) return
      set((s) => ({
        agentTodosByConv: {
          ...s.agentTodosByConv,
          [convId]: s.agentTodosByConv[convId].map((t) =>
            t.status === 'in_progress' ? { ...t, status: 'completed' as const } : t
          )
        }
      }))
    },
  }
}
