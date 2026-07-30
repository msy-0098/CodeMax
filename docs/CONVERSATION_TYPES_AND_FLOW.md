# ximo-Agent 会话类型 & 数据流全景图

> 从用户敲下回车到 AI 回复渲染在屏幕上，涉及 **6 个层次、19 个核心类型**。
> 本文档按数据流动方向，从左到右排列每一层的类型定义。

---

## 总览：六层架构

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────┐
│  ① 共享类型   │ → │ ② Store 层   │ → │ ③ IPC 传输层  │ → │ ④ 主进程桥接  │ → │ ⑤ DeepSeek   │ → │ ⑥ API    │
│  shared/types │    │  useStore.ts │    │  preload API  │    │  chat-bridge  │    │  模块         │    │  响应     │
│  (9 个类型)   │    │  (5 个类型)  │    │  (3 个 channel)│   │  (3 个类型)   │    │  (5 个类型)   │    │  (JSON)  │
└─────────────┘    └──────────────┘    └──────────────┘    └─────────────┘    └──────────────┘    └───────────┘
```

---

## 第一层：共享基础类型 —— `src/shared/types/`

这是所有模块的基石，按域拆分为 10 个文件。

### 1.1 核心枚举 — `core.ts`

```typescript
type Mode = 'office' | 'coding' | 'design'
type ModelId = 'deepseek-v4-pro' | 'deepseek-v4-flash'
type ReasoningEffort = 'off' | 'high' | 'max'
type FontSize = 'sm' | 'md' | 'lg'
```

> **在数据流中的角色**：`Mode` 决定工具集和系统提示词；`ModelId` 决定调用哪个模型；`ReasoningEffort` 控制思考链深度。

---

### 1.2 工具系统 — `tools.ts`

```typescript
// ① 工具定义（注册时用的元数据）
interface ToolDefinition {
  name: string
  description: string
  parameters: { type: 'object'; properties: Record<string, ToolParamProperty>; required?: string[] }
}

// ② LLM 返回的工具调用请求
interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

// ③ 工具执行完返回的结果
interface ToolResult {
  toolCallId: string
  toolName: string
  content: string
  success: boolean
  error?: string
  displayType?: 'text' | 'code' | 'html' | 'search-results'
  metadata?: Record<string, unknown>
  requiresConfirmation?: boolean
  confirmationMessage?: string
  screenshot?: string
}

// ④ 权限级别
type PermissionLevel = 0 | 1 | 2 | 3

// ⑤ 工具执行上下文（传递 API 配置给工具）
interface ToolContext {
  apiKey: string
  baseUrl: string
  model: string
  reasoningEffort: ReasoningEffort
  // ... 20+ 个可选的子配置字段
}
```

> **在数据流中的角色**：`ToolDefinition` → 注册时用；`ToolCall` → LLM 返回后解析；`ToolResult` → 工具执行完回传；`ToolContext` → 从 setting 透传给工具。

---

### 1.3 消息与会话 — `messaging.ts`

#### 类型层级关系

```
Conversation (会话容器)
  ├── id, title, mode, createdAt, updatedAt
  ├── projectPath? (coding 模式绑定的项目目录)
  ├── totalTokens?, promptTokens?, cacheHitTokens? (累计 token 统计)
  └── messages: ChatMessage[]
       │
       ├── ChatMessage (UI 层消息 — 展示 + 持久化)
       │    ├── id, role, content, timestamp
       │    ├── reasoningContent? (思考链文本，仅 assistant)
       │    ├── model?, tokens?, cacheHitTokens?
       │    ├── toolCalls?: ToolCall[] (assistant 消息的工具调用)
       │    └── toolResults?: ToolResult[] (assistant 消息的工具结果)
       │
       ├── 转换 ↓ (buildApiMessages)
       │
       └── ApiMessage (API 层消息 — 发送给 DeepSeek)
            ├── role: 'user' | 'assistant' | 'system' | 'tool'
            ├── content: string
            ├── tool_calls? (OpenAI 格式的工具调用)
            └── tool_call_id? (tool 角色的关联 ID)
```

#### 完整定义

```typescript
// 【存储层消息】— 存在 local storage，UI 直接渲染
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoningContent?: string         // 思考链（仅 assistant）
  model?: ModelId                   // 用了哪个模型
  tokens?: number                   // 本条消息消耗的 token
  cacheHitTokens?: number           // 缓存命中 token
  timestamp: number
  toolCalls?: ToolCall[]            // assistant 调用了哪些工具
  toolResults?: ToolResult[]        // 工具返回了什么
}

// 【会话容器】— 一组消息的集合
interface Conversation {
  id: string
  title: string                     // 自动截取首条用户消息前 24 字
  mode: Mode                        // 所属模式
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  projectPath?: string              // coding/design 模式绑定的项目目录
  totalTokens?: number              // 累计 token 消耗
  promptTokens?: number
  cacheHitTokens?: number
}

// 【API 层消息】— buildApiMessages() 转换后发给 DeepSeek
interface ApiMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: {                    // OpenAI 格式
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }[]
  tool_call_id?: string             // tool 角色关联到 tool_calls
}

// 【请求体】— IPC chat:start 的 payload
interface ChatRequest {
  mode: Mode
  messages: ApiMessage[]            // ← 由 ChatMessage[] 转换而来
  model: ModelId
  thinkingMode: boolean
  reasoningEffort: ReasoningEffort
  temperature: number
  maxTokens: number
  tools?: ToolDefinition[]          // 可用工具列表（由 mode 决定）
  sessionId?: string                // 用于 Checkpoint 系统
  autoModeLevel?: 'off' | 'safe' | 'yolo'
}

// 【流式块】— IPC chat:chunk 的 payload（逐块推送到渲染进程）
interface StreamChunk {
  content?: string                  // 文本增量（逐 token）
  reasoningContent?: string         // 思考链增量
  done?: boolean                    // 流结束标志
  error?: string                    // 错误信息
  usage?: {                         // token 用量
    promptTokens: number
    completionTokens: number
    totalTokens: number
    promptCacheHitTokens?: number
  }
  toolCall?: ToolCall               // LLM 请求调用工具
  toolResult?: ToolResult           // 工具执行完毕
  toolStatus?: 'thinking' | 'calling' | 'done'
  toolName?: string
}
```

> **在数据流中的角色**：
> - `ChatMessage` → Store 持久化格式，UI 直接消费
> - `Conversation` → 一组 ChatMessage 的容器
> - `ApiMessage` → ChatMessage 的"脱壳"版本，给 DeepSeek API 用
> - `ChatRequest` → 渲染进程 → 主进程的 IPC payload
> - `StreamChunk` → 主进程 → 渲染进程的逐帧推送

---

### 1.4 设置 — `settings.ts`

```typescript
interface AppSettings {
  apiKey: string                    // DeepSeek API 密钥
  baseUrl: string                   // API 端点
  model: ModelId
  thinkingMode: boolean
  reasoningEffort: ReasoningEffort
  temperature: number
  maxTokens: number
  // ... 60+ 个配置项，覆盖 Agent 循环、终端、浏览器、MCP、动画等
}
```

> 在 `chat-bridge.ts` 中被展开为 `ToolContext`，注入到每个工具执行中。

---

### 1.5 UI 配置 — `ui.ts`

```typescript
interface ModeConfig {
  id: Mode
  name: string
  icon: string
  description: string
  systemPrompt: string              // ← 每个模式的核心系统提示词
  quickActions: QuickAction[]
  actionGroups?: ActionGroup[]
  tools?: string[]                  // 该模式启用的工具名列表
}

interface TestResult {              // 连接测试结果
  success: boolean
  message: string
  latency?: number
  model?: string
}
```

---

## 第二层：渲染进程 Store 层 —— `src/renderer/src/store/useStore.ts`

### 2.1 Store 中的流式状态字段

```typescript
// StoreState 中与会话流式相关的字段
interface StreamState {
  isStreaming: boolean
  streamingContent: string           // 正在流式接收的文本（逐 token 累积）
  streamingReasoning: string         // 正在流式接收的思考链
  streamingConversationId: string | null  // 当前流式所属的会话 ID
  streamingAssistantId: string | null     // 预插入的占位消息 ID
  streamingTokens: number | null     // 累计 token
  streamingCacheHitTokens: number | null
  streamingPromptTokens: number | null
  streamingToolCalls: {              // 当前轮次的工具调用状态
    name: string
    status: 'thinking' | 'calling' | 'done'
    args?: string
    result?: string
    toolCallId?: string
  }[]
}
```

### 2.2 Store 内部辅助类型

```typescript
// 流式结束后的重置常量
const STREAMING_RESET = {
  isStreaming: false,
  streamingContent: '',
  streamingReasoning: '',
  streamingConversationId: null,
  streamingAssistantId: null,
  streamingTokens: null,
  streamingCacheHitTokens: null,
  streamingPromptTokens: null,
  streamingToolCalls: []
}

// 构建持久化 patch 的辅助函数类型
function buildPersistPatch(
  s: StoreState,
  conversationId: string,
  msgPatch: Partial<ChatMessage>,   // { content, reasoningContent, model, tokens, toolCalls, toolResults }
  convTokens: { total, prompt, cacheHit } | null,
  error?: string
): Partial<StoreState>
```

---

## 第三层：IPC 传输层

### 3.1 三个 IPC Channel

```typescript
// 1. 发起流式聊天（渲染→主，invoke/handle 模式）
'chat:start'  → payload: ChatRequest
              ← 通过 'chat:chunk' 逐帧回传 StreamChunk

// 2. 接收流式数据块（主→渲染，send/on 模式）
'chat:chunk'  → payload: StreamChunk

// 3. 取消当前流式请求（渲染→主）
'chat:cancel' → 无 payload

// 4. 连接测试（渲染→主，invoke/handle 模式）
'chat:test'   → payload: (apiKey, baseUrl, model)
              ← payload: TestResult

// 5. 危险操作确认（主→渲染→主）
'confirm:request'  → payload: { toolName, message }
'confirm:response' → payload: boolean
```

---

## 第四层：主进程桥接层 —— `src/main/chat-bridge.ts`

### 4.1 内部类型

```typescript
// StreamHandlers — 从 setting + request 组装后传给 agentLoop
interface StreamHandlers {
  onChunk: (chunk: StreamChunk) => void    // ← 实际是 win.send('chat:chunk', chunk)
  signal?: AbortSignal                      // ← new AbortController().signal
  requestConfirmation?: (toolName, message) => Promise<boolean>  // ← IPC 确认弹窗
  yoloMode?: boolean                        // ← settings.yoloMode
  autoModeLevel?: 'off' | 'safe' | 'yolo'   // ← request.autoModeLevel
}

// ToolContext — 从 AppSettings 扁平化展开
// （定义在 shared/types/tools.ts，此处桥接层负责构建）
```

---

## 第五层：DeepSeek 模块 —— `src/main/deepseek/`

### 5.1 内部类型 — `types.ts`

```typescript
interface StreamHandlers {           // ← 与 chat-bridge 的同名但职责不同
  onChunk: (chunk: StreamChunk) => void
  signal?: AbortSignal
  requestConfirmation?: (toolName, message) => Promise<boolean>
  yoloMode?: boolean
  autoModeLevel?: 'off' | 'safe' | 'yolo'
}

// 单次 API 调用结果 — agentLoop 的内部循环单位
interface SingleCallResult {
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error'
  content: string                    // 累积的文本内容
  reasoningContent: string           // 累积的思考链
  toolCalls: ToolCall[]              // 解析后的工具调用
  usage?: StreamChunk['usage']
  error?: string
}
```

### 5.2 Agent 循环配置 — `context.ts`

```typescript
const agentConfig = {
  maxToolRounds: 30,                 // 最多工具调用轮次
  maxToolResultChars: 16000,         // 单条工具结果最大字符
  maxContextChars: 300000,           // 上下文窗口软上限
  recentKeep: 8,                     // 最近 N 条不被压缩
  snippedKeep: 200,                  // snip 后保留字符数
  prunedKeep: 80,                    // prune 后保留字符数
  checkpointEnabled: true
}
```

---

## 第六层：完整数据流时序图

```
用户敲回车
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ useStore.sendMessage(text)                                      │
│   1. 构造 ChatMessage { id, role:'user', content:text }         │
│   2. 预插入占位 ChatMessage { id, role:'assistant', content:'' }│
│   3. set({ isStreaming:true, streamingAssistantId })            │
│   4. 调用 runStream()                                           │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ buildApiMessages(conversation)                                  │
│   1. 加载 SYSTEM_PROMPTS[mode]                                  │
│   2. 注入: customPrompt, 专家人格, 项目路径, 浏览器状态,         │
│            设计风格, 导入技能                                     │
│   3. ChatMessage[] → ApiMessage[]                               │
│      - assistant.toolCalls → OpenAI 格式 tool_calls             │
│      - assistant.toolResults → role:'tool' 消息                 │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ window.api.chat.stream( ChatRequest )                           │
│   IPC: 'chat:start'                                             │
│   payload: { mode, messages:ApiMessage[], model, thinkingMode,  │
│              reasoningEffort, temperature, maxTokens,           │
│              sessionId, autoModeLevel }                         │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼  ═══════════ 进程边界 ═══════════
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ chat-bridge.ts → registerChatHandlers()                         │
│   1. loadSettings() → 构建 ToolContext                          │
│   2. ensureModeToolsLoaded(mode) → 懒加载工具模块               │
│   3. configureAgentLoop(config)                                  │
│   4. 连接 MCP 服务器 → 合并工具定义                              │
│   5. 构建 StreamHandlers { onChunk: win.send('chat:chunk'),     │
│         signal, requestConfirmation }                            │
│   6. agentLoop(apiKey, baseUrl, request, handlers, ctx, sid)    │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ agent-loop.ts → agentLoop()                                     │
│   while round < maxToolRounds:                                  │
│     trimContext(messages)          ← 三级压缩                   │
│     result = callDeepSeekStream()  ← 单次 API 调用              │
│     if stop/length → onChunk({done:true}) → break               │
│     for each toolCall:                                          │
│       权限检查 → 用户确认 → 执行工具                             │
│       onChunk({ toolStatus:'calling', toolCall })              │
│       toolResult = tool.execute()                               │
│       onChunk({ toolResult, toolStatus:'done' })               │
│     messages.push(assistant + tool 消息) → 继续下一轮            │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ api.ts → callDeepSeekStream()                                   │
│   POST {baseUrl}/chat/completions                               │
│   body: { model, messages, stream:true, tools?, ... }           │
│   SSE 流式解析:                                                 │
│     delta.content      → onChunk({ content })                  │
│     delta.reasoning    → onChunk({ reasoningContent })         │
│     delta.tool_calls   → 累积到 toolCallsAcc                    │
│     json.usage         → onChunk({ usage })                    │
│   return SingleCallResult { finishReason, content, toolCalls }  │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼  ═══════════ 每次 onChunk() 触发的 IPC ═══════════
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ runStream() 的 chunk 回调                                       │
│   chunk.content         → streamingContent += ...              │
│   chunk.reasoningContent → streamingReasoning += ...           │
│   chunk.usage           → streamingTokens = ...                │
│   chunk.toolStatus:'calling' → streamingToolCalls.push(...)    │
│   chunk.toolResult      → streamingToolCalls[i].status='done'  │
│   chunk.done + error    → buildPersistPatch(..., error)        │
│   chunk.done (success)  → buildPersistPatch(                   │
│       { content, reasoningContent, model, tokens,              │
│         toolCalls, toolResults })                               │
│   finally: 安全网 — 如果 isStreaming 仍为 true，手动持久化      │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI 响应式渲染                                                    │
│   streamingContent     → 打字机效果逐字显示                     │
│   streamingReasoning   → 思考链折叠面板                         │
│   streamingToolCalls   → 工具调用进度指示器                     │
│   conversations[i].messages → 完整消息列表（滚动查看）          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 类型转换速查表

| 从哪里 | 到哪里 | 转换函数 | 关键变化 |
|--------|--------|---------|---------|
| `ChatMessage` | `ApiMessage` | `buildApiMessages()` | toolCalls → OpenAI 格式; toolResults → role:'tool' 消息 |
| `AppSettings` | `ToolContext` | `buildToolContext()` (chat-bridge) | 扁平化 settings 中 20+ 个工具配置项 |
| `Conversation` | `ChatRequest` | `runStream()` 内联 | 从 conversation 提取 mode + 构建 request body |
| `ChatRequest` | IPC payload | `ipcMain.handle('chat:start')` | 透传，序列化为 JSON |
| SSE data chunk | `StreamChunk` | `callDeepSeekStream()` | 解析 delta.content/reasoning/tool_calls/usage |
| `StreamChunk` | Store 状态 | `runStream()` 回调 | streamingContent/reasoning/toolCalls/tokens |
| `StreamChunk` (done) | `ChatMessage` | `buildPersistPatch()` | 占位消息原地填充 content + toolCalls + toolResults |
| `ToolResult` (todo_write) | `agentTodosByConv` | `runStream()` 回调 | 提取 metadata.todos → per-conversation 字典 |

---

## 文件索引

| 文件 | 职责 | 关键类型 |
|------|------|---------|
| `src/shared/types/core.ts` | 基础枚举 | `Mode`, `ModelId`, `ReasoningEffort` |
| `src/shared/types/tools.ts` | 工具系统 | `ToolDefinition`, `ToolCall`, `ToolResult`, `ToolContext` |
| `src/shared/types/messaging.ts` | 消息与会话 | `ChatMessage`, `Conversation`, `ApiMessage`, `ChatRequest`, `StreamChunk` |
| `src/shared/types/settings.ts` | 应用设置 | `AppSettings` |
| `src/shared/types/ui.ts` | UI 配置 | `ModeConfig`, `TestResult` |
| `src/renderer/src/store/useStore.ts` | 渲染进程状态 | `StoreState`, `AgentTodo`, `CanvasItem` |
| `src/main/chat-bridge.ts` | IPC 桥接 | `StreamHandlers` (bridge 版本) |
| `src/main/deepseek/types.ts` | DeepSeek 内部 | `StreamHandlers`, `SingleCallResult` |
| `src/main/deepseek/context.ts` | 上下文管理 | `agentConfig` |
| `src/main/deepseek/api.ts` | API 调用 | — |
| `src/main/deepseek/agent-loop.ts` | Agent 循环 | — |
| `src/main/tools/Tool.ts` | 工具接口 | `Tool` |
