// ====== 消息与会话类型 ======

import type { Mode, ModelId, ReasoningEffort } from './core'
import type { ToolCall, ToolResult, ToolDefinition } from './tools'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoningContent?: string
  model?: ModelId
  tokens?: number
  /** 缓存命中 token 数（来自 API prompt_tokens_details.cached_tokens） */
  cacheHitTokens?: number
  timestamp: number
  /** 工具调用记录（assistant 消息可能包含） */
  toolCalls?: ToolCall[]
  /** 工具执行结果（针对 tool 角色的消息） */
  toolResults?: ToolResult[]
  /** 斜杠命令元数据 — 用于在 UI 中显示胶囊而非完整提示词 */
  slashCommand?: { cmd: string; systemHint: string }
}

export interface Conversation {
  id: string
  title: string
  mode: Mode
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  /** 绑定的项目目录路径（coding 模式专用） */
  projectPath?: string
  /** 会话累计总 token 消耗 */
  totalTokens?: number
  /** 会话累计 prompt token 数（用于计算缓存命中率） */
  promptTokens?: number
  /** 会话累计缓存命中 token */
  cacheHitTokens?: number
}

export interface ApiMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

// 发起聊天请求的参数
export interface ChatRequest {
  mode: Mode
  messages: ApiMessage[]
  model: ModelId
  thinkingMode: boolean
  reasoningEffort: ReasoningEffort
  temperature: number
  maxTokens: number
  /** 可用工具列表 */
  tools?: ToolDefinition[]
  /** 会话 ID（用于 Checkpoint 系统，可选） */
  sessionId?: string
  /** Auto Mode 等级：off=手动确认, safe=读操作自动, yolo=全部自动 */
  autoModeLevel?: 'off' | 'safe' | 'yolo'
}

// 流式传输的数据块
export interface StreamChunk {
  content?: string
  reasoningContent?: string
  done?: boolean
  error?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number; promptCacheHitTokens?: number }
  /** 工具调用阶段：LLM 请求调用某个工具 */
  toolCall?: ToolCall
  /** 工具执行阶段：工具执行完毕返回结果 */
  toolResult?: ToolResult
  /** 工具调用状态变更 */
  toolStatus?: 'thinking' | 'calling' | 'done'
  toolName?: string
}
