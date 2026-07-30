// 主进程与渲染进程共享的类型定义

export type Mode = 'office' | 'coding' | 'design'

export type ModelId = 'deepseek-v4-pro' | 'deepseek-v4-flash'

/** 思考强度：off=关闭, high=高, max=最高 */
export type ReasoningEffort = 'off' | 'high' | 'max'

// ====== 工具系统类型 ======

/** JSON Schema 属性定义 */
export interface ToolParamProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  enum?: (string | number)[]
  default?: unknown
  items?: ToolParamProperty
  properties?: Record<string, ToolParamProperty>
  required?: string[]
}

/** 工具定义 — 注册时使用 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParamProperty>
    required?: string[]
  }
}

/** LLM 返回的工具调用请求 */
export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/** 工具执行结果 */
export interface ToolResult {
  toolCallId: string
  toolName: string
  content: string
  success: boolean
  error?: string
  /** 是否需要在 UI 中特殊渲染（如 UI 代码预览） */
  displayType?: 'text' | 'code' | 'html' | 'search-results'
  metadata?: Record<string, unknown>
  /** 是否需要用户确认后执行 */
  requiresConfirmation?: boolean
  /** 确认提示信息 */
  confirmationMessage?: string
  /** 截图 base64（用于预览） */
  screenshot?: string
}

/** 权限级别：0=只读, 1=可逆写, 2=不可逆操作, 3=系统级 */
export type PermissionLevel = 0 | 1 | 2 | 3

/** 工具执行上下文 — 传递 API 配置给需要发起子调用的工具 */
export interface ToolContext {
  apiKey: string
  baseUrl: string
  model: string
  reasoningEffort: ReasoningEffort
  /** 子 Agent 模型 */
  subAgentModel?: string
  /** 子 Agent 最大 token */
  subAgentMaxTokens?: number
  /** 子 Agent 温度 */
  subAgentTemperature?: number
  /** 子 Agent 超时秒数 */
  subAgentTimeout?: number
  /** 子 Agent 思考强度 */
  subAgentReasoningEffort?: ReasoningEffort
  /** 终端命令默认超时（秒） */
  terminalTimeout?: number
  /** 代码执行默认超时（秒） */
  codeExecTimeout?: number
  /** 终端输出截断长度 */
  terminalOutputLimit?: number
  /** 浏览器无头模式 */
  browserHeadless?: boolean
  /** 浏览器空闲超时（分钟） */
  browserIdleTimeout?: number
  /** 浏览器视口宽度 */
  browserViewportWidth?: number
  /** 浏览器视口高度 */
  browserViewportHeight?: number
  /** 默认搜索引擎 */
  defaultSearchEngine?: string
  /** 搜索结果默认数量 */
  searchResultsCount?: number
  /** 网页抓取内容上限 */
  webFetchMaxLength?: number
  /** 网页缓存开关 */
  webCacheEnabled?: boolean
  /** 网页缓存最大大小（MB） */
  webCacheMaxSizeMB?: number
  /** pi-computer-use Helper 命令超时（秒） */
  helperCommandTimeout?: number
  /** MCP 服务器连接超时（秒） */
  mcpConnectTimeout?: number

  // ---- 视觉模型（Agnes 2.5 Flash）----
  /** 视觉模型 API Key */
  visionApiKey?: string
  /** 视觉模型 Base URL */
  visionBaseUrl?: string
  /** 视觉模型名称 */
  visionModel?: string

  // ---- 模式 ----
  /** 当前会话模式 — 记忆工具用于定位对应模式的记忆文件 */
  mode?: Mode

  /** 请求用户输入（弹窗）— Plan 提问和 Spec 审核使用 */
  requestUserInput?: (type: 'ask' | 'review', title: string, content: string) => Promise<{ confirmed: boolean; response?: string }>
}

// ====== 消息类型 ======

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
}

export type FontSize = 'sm' | 'md' | 'lg'

export interface AppSettings {
  apiKey: string
  baseUrl: string
  model: ModelId
  thinkingMode: boolean
  /** 思考强度：off=关闭思考, high=高, max=最高 */
  reasoningEffort: ReasoningEffort
  temperature: number
  maxTokens: number
  fontSize: FontSize
  customPrompt: string
  themeColor: string
  /** 明暗主题 */
  theme: 'dark' | 'light'
  /** YOLO 模式：关闭所有操作确认 */
  yoloMode?: boolean
  /** 最近打开的项目路径列表（coding 模式） */
  recentProjects?: string[]

  // ---- 主子 Agent 设置 ----
  /** 子 Agent 使用的模型（默认与主 Agent 相同） */
  subAgentModel?: ModelId
  /** 子 Agent 最大输出 token */
  subAgentMaxTokens?: number
  /** 子 Agent 温度 */
  subAgentTemperature?: number
  /** 子 Agent 超时秒数 */
  subAgentTimeout?: number
  /** 子 Agent 思考强度 */
  subAgentReasoningEffort?: ReasoningEffort
  /** 狂暴模式（编排模式下强制主 Agent 主动决策、不推诿） */
  orchestratorEnforce?: boolean
  /** 主 Agent 自定义提示词（注入系统提示词，定义主 Agent 的人格与行为） */
  mainAgentCustomPrompt?: string
  /** 主 Agent 注入的专家 ID（从 AI 专家库选择，将专家人格注入主 Agent） */
  mainAgentExpertId?: string

  // ---- Agent 循环与上下文管理 ----
  /** Agent Loop 最多连续调用工具次数，防止死循环 */
  maxToolRounds?: number
  /** 上下文窗口最大字符数估算 */
  maxContextChars?: number
  /** 工具结果最大字符数，超出则截断 */
  maxToolResultChars?: number
  /** 最近保护窗口：最近这么多条消息不会被压缩 */
  contextRecentKeep?: number
  /** snip 后保留的字符数 */
  contextSnippedKeep?: number
  /** prune 后保留的字符数 */
  contextPrunedKeep?: number

  // ---- 终端与代码执行 ----
  /** 终端命令默认超时（秒） */
  terminalTimeout?: number
  /** 代码执行默认超时（秒） */
  codeExecTimeout?: number
  /** 终端输出截断长度（字符数） */
  terminalOutputLimit?: number

  // ---- 浏览器自动化 ----
  /** 浏览器无头模式 */
  browserHeadless?: boolean
  /** 浏览器空闲超时（分钟） */
  browserIdleTimeout?: number
  /** 浏览器视口宽度 */
  browserViewportWidth?: number
  /** 浏览器视口高度 */
  browserViewportHeight?: number

  // ---- 联网搜索与网页抓取 ----
  /** 默认搜索引擎：bing / baidu / duckduckgo */
  defaultSearchEngine?: 'bing' | 'baidu' | 'duckduckgo'
  /** 搜索结果默认数量 */
  searchResultsCount?: number
  /** 网页抓取内容上限（字符数） */
  webFetchMaxLength?: number
  /** 网页缓存开关 */
  webCacheEnabled?: boolean
  /** 网页缓存最大大小（MB） */
  webCacheMaxSizeMB?: number

  // ---- 权限与自动化模式 ----
  /** Auto Mode 默认等级：off/safe/yolo */
  defaultAutoModeLevel?: 'off' | 'safe' | 'yolo'
  /** 联网搜索默认状态 */
  defaultNetworkSearchOn?: boolean
  /** 检查点自动快照开关 */
  checkpointEnabled?: boolean

  // ---- 桌面操控 ----
  /** pi-computer-use Helper 命令超时（秒） */
  helperCommandTimeout?: number

  // ---- 网络抓包 ----
  /** 抓包最大请求数 */
  maxCapturedRequests?: number

  // ---- MCP 集成 ----
  /** MCP 服务器连接超时（秒） */
  mcpConnectTimeout?: number

  // ---- 视觉模型（Agnes 2.5 Flash）----
  /** 视觉模型 API Key（Agent 的“眼睛”，用于图像理解） */
  visionApiKey?: string
  /** 视觉模型 Base URL */
  visionBaseUrl?: string
  /** 视觉模型名称 */
  visionModel?: string

  // ---- GPU 硬件加速 ----
  /** GPU 硬件加速开关（优先调用独显，无独显则调用核显） */
  gpuAcceleration?: boolean

  // ---- 开屏动画 ----
  /** 开屏动画总开关 */
  startupAnimationEnabled?: boolean
  /** 开屏文字（默认 ximo-Agent） */
  startupText?: string
  /** 开屏文字大小 */
  startupTextSize?: number
  /** 开屏文字描边时长（ms） */
  startupStrokeDuration?: number
  /** 开屏文字字体（系统字体名或 CSS font-family 值） */
  startupFontFamily?: string
  /** 爆发转场开关 */
  burstTransitionEnabled?: boolean
  /** 转场样式：rose(玫瑰花瓣) / fireworks(烟花) / confetti(彩纸) / fade(淡入) / aura(光环) / lightfall(光瀑) / custom(自定义) */
  burstTransitionStyle?: 'rose' | 'fireworks' | 'confetti' | 'fade' | 'aura' | 'lightfall' | 'custom'
  /** 转场粒子数量 */
  burstParticleCount?: number
  /** 转场时长（ms） */
  burstDuration?: number
  /** 转场配色主题：rose / ocean / gold / aurora */
  burstColorTheme?: 'rose' | 'ocean' | 'gold' | 'aurora'
  /** 自定义转场动画文件（JSON 字符串），当 burstTransitionStyle 为 'custom' 时使用 */
  customTransitionAnimation?: string
}

// ====== 转场动画文件 ======

/** 粒子变量模板值：[最小值, 最大值, 单位] */
export type ParticleVarRange = [number, number, string]

/** 转场动画文件 — 可导出/导入的自包含动画定义 */
export interface TransitionAnimationFile {
  /** 动画名称 */
  name: string
  /** 格式版本 */
  version: 1
  /** 粒子元素的 CSS class 名 */
  particleClass: string
  /** 原始 CSS 文本（含 .particleClass 样式 + @keyframes），注入到 <style> 标签 */
  css: string
  /** 粒子变量模板：CSS 自定义属性名 → [min, max, unit] */
  vars: Record<string, ParticleVarRange>
}

// ====== 文件树类型 ======

/** 文件树节点（主进程与渲染进程共享） */
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileTreeNode[]
}

// 连接测试结果
export interface TestResult {
  success: boolean
  message: string
  latency?: number
  model?: string
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

// 各模式定义
export interface ModeConfig {
  id: Mode
  name: string
  icon: string
  description: string
  systemPrompt: string
  quickActions: QuickAction[]
  /** 快捷操作分组（替代扁平 quickActions 展示） */
  actionGroups?: ActionGroup[]
  /** 该模式默认启用的工具名称列表 */
  tools?: string[]
}

export interface QuickAction {
  id: string
  label: string
  icon: string
  prompt: string
  /** 简短描述，显示在卡片中 */
  description?: string
}

/** 快捷操作分组 */
export interface ActionGroup {
  category: string
  icon: string
  actions: QuickAction[]
}

// 预设对话模板
export interface ConversationTemplate {
  id: string
  title: string
  mode: Mode
  description: string
  prompt: string
}

// ====== 技能系统类型 ======

/** 技能操作步骤 — 录制过程中捕获的单个操作 */
export interface SkillStep {
  /** 工具名称（如 browser_navigate, browser_click, browser_type 等） */
  tool: string
  /** 工具调用参数 */
  arguments: Record<string, unknown>
  /** 操作时间戳 */
  timestamp: number
  /** 可选：操作截图 base64 */
  screenshot?: string
  /** 可选：操作描述（由 LLM 生成） */
  description?: string
}

/** 技能定义 — 录制完成后沉淀的操作序列 */
export interface Skill {
  id: string
  /** 技能名称 */
  name: string
  /** 技能描述（用于相似任务匹配） */
  description: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 调用次数 */
  invokeCount: number
  /** 操作步骤序列（工具调用记录，用于 AI 理解和兼容回放） */
  steps: SkillStep[]
  /** rrweb 录制的 DOM 事件流（用于真实回放） */
  rrwebEvents?: Record<string, unknown>[]
  /** 技能标签（用于分类和匹配） */
  tags: string[]
  /** 技能来源：录制 / 手动创建 / AI专家激活 */
  source: 'recorded' | 'manual' | 'expert'
  /** 录制时的起始 URL（如果有） */
  startUrl?: string
  /** 录制时捕获的 API 端点列表 */
  apiEndpoints?: string[]
  // ---- 专家技能专属字段（source='expert' 时使用）----
  /** 专家 ID */
  expertId?: string
  /** 专家名称 */
  expertName?: string
  /** 专家系统提示词（含人格、能力、工作风格、工具配置、工作流） */
  systemPrompt?: string
  /** 推荐工具配置列表 */
  configuredTools?: string[]
  /** 预设自动化工作流 */
  workflow?: string
}

// ====== AI 专家库类型 ======

/** 专家部门定义 */
export interface AgentDivision {
  key: string
  label: string
  icon: string
  color: string
}

/** AI 专家角色定义（来自 agency-agents 项目） */
export interface AgentExpert {
  /** 唯一标识，如 "engineering-frontend-developer" */
  id: string
  /** 所属部门 key */
  division: string
  /** 专家名称 */
  name: string
  /** 简短描述 */
  description: string
  /** 该专家推荐使用的工具列表 */
  tools: string[]
  /** 主题色（Tailwind 色名或 hex） */
  color: string
  /** 表情图标 */
  emoji: string
  /** 一句话风格描述 */
  vibe: string
  /** 人格设定（首段 Markdown 正文） */
  personality: string
}

/** 录制会话状态 */
export interface RecordingSession {
  id: string
  /** 是否正在录制 */
  isRecording: boolean
  /** 录制开始时间 */
  startedAt: number | null
  /** 已录制的操作步骤 */
  steps: SkillStep[]
  /** 录制起始 URL */
  startUrl?: string
  /** rrweb 录制的 DOM 事件流 */
  rrwebEvents: Record<string, unknown>[]
  /** rrweb 录制的事件数量 */
  rrwebEventCount: number
}

// ====== 内嵌浏览器 & 抓包类型 ======

/** 抓包捕获的网络请求 */
export interface CapturedRequest {
  id: string
  url: string
  method: string
  resourceType: string
  statusCode?: number
  timestamp: number
  completedAt?: number
  duration?: number
}

/** 录制时从内嵌浏览器捕获的用户操作事件 */
export interface RecordedEvent {
  type: 'navigate' | 'click' | 'input'
  url?: string
  selector?: string
  text?: string
  value?: string
  timestamp: number
}

// ====== 导入技能（SKILL.md 格式）类型 ======

/** 从 SKILL.md 文件解析出的导入技能 — 兼容 Claude / CatPaw / Open Design 等格式 */
export interface ImportedSkill {
  /** 唯一标识 */
  id: string
  /** 技能名称（来自 YAML frontmatter） */
  name: string
  /** 技能描述（来自 YAML frontmatter） */
  description: string
  /** 触发词列表（来自 YAML frontmatter） */
  triggers: string[]
  /** SKILL.md 正文内容（Markdown 格式的指令体） */
  body: string
  /** 是否启用 */
  enabled: boolean
  /** 导入时间 */
  importedAt: number
  /** 导入来源：file=从文件导入, text=从文本粘贴 */
  source: 'file' | 'text'
  /** 原始文件名（source='file' 时有值） */
  fileName?: string
}

// ====== MCP 服务器配置类型 ======

/** MCP 传输方式 — stdio=本地进程, sse=Server-Sent Events, http=流式 HTTP */
export type McpTransport = 'stdio' | 'sse' | 'http'

/** MCP 服务器配置 — 兼容 Cursor / Claude Code / Cline / Windsurf 等主流客户端的 mcpServers 格式 */
export interface McpServerConfig {
  /** 唯一标识（同时作为 MCP 服务器名传递给 Agent） */
  id: string
  /** 人类可读的显示名称 */
  name: string
  /** 传输方式 */
  transport: McpTransport
  /** 是否启用（禁用的条目会持久化但不会传递给 Agent） */
  enabled: boolean
  /** 导入时间 */
  importedAt: number

  // ---- stdio 传输 ----
  /** 本地命令（如 npx, node, python） */
  command?: string
  /** 命令参数 */
  args?: string[]
  /** 环境变量 */
  env?: Record<string, string>

  // ---- sse / http 传输 ----
  /** 远程服务器 URL */
  url?: string
  /** 自定义请求头 */
  headers?: Record<string, string>
}

// ====== 设计模式公共类型 ======

/** UI 组件元数据 — 镜像 catalog 中的结构 */
export interface ComponentMeta {
  id: string
  name: string
  nameCn: string
  category: string
  categoryCn: string
  dependencies: string[]
  props: string[]
  files: { jsx: string; css: string | null; assets: string[] | null }
}

/** 设计风格条目 */
export interface StyleEntry {
  id: string
  name: string
  category: string
  tokens: { accent: string; bg: string; fg: string; surface: string }
}
