// ====== 消息与会话类型 ======

import type { Mode, ModelId, ReasoningEffort } from './core'
import type { ToolCall, ToolResult, ToolDefinition } from './tools'

/** 流式输出的单个工作步骤（对应 Agent Loop 的一轮） */
export interface StreamingSegment {
  reasoning: string
  content: string
  toolCalls: { name: string; status: 'thinking' | 'calling' | 'done'; args?: string; result?: string; toolCallId?: string }[]
}

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
  /** 多轮工作步骤（按时间顺序展示思考链、正文和工具调用，仅多轮 Agent Loop 时存在） */
  segments?: StreamingSegment[]
  /** 斜杠命令元数据 — 用于在 UI 中显示胶囊而非完整提示词，systemHint 在 buildApiMessages 时拼接到 content 前面 */
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
  /** 最近一次 API 调用的 total tokens（prompt+completion）— 即当前上下文窗口占用 */
  contextTokens?: number
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
