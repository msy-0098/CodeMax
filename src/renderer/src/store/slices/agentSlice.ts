import type { StateCreator } from 'zustand'
import type { StoreState, AgentTodo } from '../types'

export type AgentSlice = Pick<StoreState,
  | 'showAgentPanel'
  | 'showMemoryPanel'
  | 'activeExperts'
  | 'agentTodosByConv'
  | 'taskListCollapsed'
  | 'showTokenStats'
  | 'setShowAgentPanel'
  | 'setShowMemoryPanel'
  | 'toggleExpert'
  | 'toggleTaskListCollapsed'
  | 'restoreAgentTodos'
  | 'setShowTokenStats'
>

export const createAgentSlice: StateCreator<StoreState, [], [], AgentSlice> = (set, get) => ({
  showAgentPanel: false,
  showMemoryPanel: false,
  activeExperts: [],
  agentTodosByConv: {},
  taskListCollapsed: false,
  showTokenStats: false,

  setShowAgentPanel: (show) => set({ showAgentPanel: show }),

  setShowMemoryPanel: (show) => set({ showMemoryPanel: show }),

  toggleExpert: (expertId) => set((s) => ({
    activeExperts: s.activeExperts.includes(expertId)
      ? s.activeExperts.filter(id => id !== expertId)
      : [...s.activeExperts, expertId]
  })),

  toggleTaskListCollapsed: () => set((s) => ({ taskListCollapsed: !s.taskListCollapsed })),

  restoreAgentTodos: () => {
    const conv = get().getCurrentConversation()
    const convId = get().currentConversationId
    if (!conv || !convId) return
    // 从最新到最旧扫描 assistant 消息的 toolResults，找到最后一次 todo_write 的结果
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
    // 没找到 — 清除该会话的旧任务，避免残留其他会话的数据
    set((s) => {
      if (!(convId in s.agentTodosByConv)) return {}
      const next = { ...s.agentTodosByConv }
      delete next[convId]
      return { agentTodosByConv: next }
    })
  },

  setShowTokenStats: (show) => set({ showTokenStats: show }),
})
