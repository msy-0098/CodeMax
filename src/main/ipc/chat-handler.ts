import { ipcMain, BrowserWindow } from 'electron'
import { streamChat, agentLoop, testConnection, configureAgentLoop } from '../llm'
import type { ChatRequest, StreamChunk, ToolContext, ApiMessage, ModelProvider } from '../../shared/types'
import { loadSettings } from '../store'
import { toolRegistry } from '../tools'
import { modeToolNames, ensureModeToolsLoaded } from '../tools/lazy-registry'
import { normalizeToolSchemas } from '../../shared/cache'
import * as os from 'os'

// 当前流式请求的 AbortController（用于取消）
let currentController: AbortController | null = null

/** 从 settings 解析当前激活的服务商；未配置时返回空配置，由调用方优雅报错 */
function getActiveProvider(settings: Awaited<ReturnType<typeof loadSettings>>): ModelProvider {
  const list = settings.providers ?? []
  return list.find((p) => p.id === settings.activeProviderId) ??
    { id: '', name: '', kind: 'custom', baseUrl: '', apiKey: '', models: [], supportsThinking: false }
}

export function registerChatHandlers(): void {
  // 流式聊天：渲染进程通过 invoke 触发，主进程逐块通过 send 回传
  ipcMain.handle('chat:start', async (event, request: ChatRequest) => {
    const settings = await loadSettings()
    const provider = getActiveProvider(settings)
    currentController = new AbortController()

    const win = event.sender

    const handlers = {
      signal: currentController.signal,
      yoloMode: settings.yoloMode,
      autoModeLevel: request.autoModeLevel ?? (settings.yoloMode ? 'yolo' : 'off'),
      onChunk: (chunk: StreamChunk) => {
        if (!win.isDestroyed()) {
          win.send('chat:chunk', chunk)
        }
      },
      requestConfirmation: (settings.yoloMode || (request.autoModeLevel === 'yolo')) ? undefined : async (toolName: string, message: string): Promise<boolean> => {
        if (win.isDestroyed()) return false
        win.send('confirm:request', { toolName, message })
        return new Promise<boolean>((resolve) => {
          let settled = false
          const finish = (result: boolean): void => {
            if (settled) return
            settled = true
            ipcMain.removeListener('confirm:response', listener)
            win.removeListener('closed' as never, onClosed as never)
            resolve(result)
          }
          const listener = (_event: Electron.IpcMainEvent, result: boolean): void => {
            finish(result)
          }
          const onClosed = (): void => finish(false)
          ipcMain.on('confirm:response', listener)
          win.once('closed' as never, onClosed as never)
        })
      },
      requestUserInput: async (type: 'ask' | 'review', title: string, content: string): Promise<{ confirmed: boolean; response?: string }> => {
        if (win.isDestroyed()) return { confirmed: false }
        win.send('user-input:request', { type, title, content } as const)
        return new Promise<{ confirmed: boolean; response?: string }>((resolve) => {
          let settled = false
          const finish = (result: { confirmed: boolean; response?: string }): void => {
            if (settled) return
            settled = true
            ipcMain.removeListener('user-input:response', listener)
            win.removeListener('closed' as never, onClosed as never)
            resolve(result)
          }
          const listener = (_event: Electron.IpcMainEvent, result: { confirmed: boolean; response?: string }): void => {
            finish(result)
          }
          const onClosed = (): void => finish({ confirmed: false })
          ipcMain.on('user-input:response', listener)
          win.once('closed' as never, onClosed as never)
        })
      }
    }

    // 根据模式注入工具定义 — 按需懒加载该模式所需的工具模块
    await ensureModeToolsLoaded(request.mode)
    let toolNames = modeToolNames[request.mode] || []

    // 注入 Agent 循环配置（从 settings 读取）
    configureAgentLoop({
      maxToolRounds: settings.maxToolRounds ?? 30,
      maxToolResultChars: settings.maxToolResultChars ?? 8000,
      maxContextChars: settings.maxContextChars ?? 300000,
      recentKeep: settings.contextRecentKeep ?? 5,
      snippedKeep: settings.contextSnippedKeep ?? 200,
      prunedKeep: settings.contextPrunedKeep ?? 80,
      checkpointEnabled: settings.checkpointEnabled ?? true
    })

    // 注入 PiBridge 命令超时
    const { setDefaultCommandTimeout } = await import('../tools/ComputerUse/PiBridge')
    setDefaultCommandTimeout(settings.helperCommandTimeout ?? 30)

    // 注入网页缓存配置
    const { configureCacheManager } = await import('../tools/WebIntelligence/WebCacheManager')
    configureCacheManager({
      enabled: settings.webCacheEnabled ?? true,
      maxSizeMB: settings.webCacheMaxSizeMB ?? 100
    })

    // 操控电脑未启动时，从工具列表中移除桌面操控工具 — Agent 完全感知不到
    if (toolNames.includes('find_roots')) {
      const { piBridge } = await import('../tools/ComputerUse/PiBridge')
      if (!piBridge.ready) {
        const COMPUTER_USE_TOOLS = new Set(['find_roots', 'observe_ui', 'search_ui', 'act_ui', 'read_text', 'wait_for'])
        toolNames = toolNames.filter((n) => !COMPUTER_USE_TOOLS.has(n))
      }
    }

    // 长期记忆关闭时，从工具列表中移除 memory_update — Agent 完全感知不到记忆功能
    if (settings.memoryEnabled === false) {
      toolNames = toolNames.filter((n) => n !== 'memory_update')
    }

    const modeTools = toolNames.length > 0 ? toolRegistry.getByNames(toolNames).map((t) => t.definition) : undefined

    // 连接所有启用的 MCP 服务器，收集其工具
    const { McpSession } = await import('../tools/Mcp/McpClient')
    const mcpSession = new McpSession((settings.mcpConnectTimeout ?? 30) * 1000)
    const mcpResult = await mcpSession.connectAll()
    if (mcpResult.errors.length > 0) {
      console.warn('[MCP] 部分服务器连接失败:', mcpResult.errors)
    }

    // 将 MCP 工具动态注册到 toolRegistry
    const mcpTools = mcpSession.getTools()
    for (const tool of mcpTools) {
      if (!toolRegistry.has(tool.definition.name)) {
        toolRegistry.register(tool)
      }
    }
    const mcpToolDefs = mcpSession.getToolDefinitions()

    // 合并模式工具 + MCP 工具
    const allTools = [...(modeTools || []), ...mcpToolDefs]

    // A4 工具 schema 字典序归一化排序 — 保持 tools JSON 字节稳定，避免破坏缓存前缀
    const sortedTools = allTools.length > 0 ? normalizeToolSchemas(allTools) : allTools

    // 注入运行环境信息 — 插入到 system prompt 之后、对话历史之前，作为稳定前缀的一部分
    // 环境信息使用日期（不含秒级时间戳），确保同一会话内前缀稳定，缓存命中率最大化
    const envInfo = buildEnvInfo()
    const messagesWithEnv: ApiMessage[] = [
      request.messages[0],  // system prompt
      { role: 'system', content: envInfo },  // 环境信息（稳定前缀）
      ...request.messages.slice(1)  // runtime_status + memory + 对话历史
    ]

    try {
      if (allTools.length > 0) {
        const toolContext: ToolContext = {
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          model: request.model,
          reasoningEffort: request.reasoningEffort,
          subAgentModel: settings.subAgentModel || settings.model,
          subAgentMaxTokens: 393216,
          subAgentTemperature: settings.subAgentTemperature ?? 0.7,
          subAgentTimeout: settings.subAgentTimeout ?? 60,
          subAgentReasoningEffort: settings.subAgentReasoningEffort ?? 'high',
          terminalTimeout: settings.terminalTimeout ?? 60,
          codeExecTimeout: settings.codeExecTimeout ?? 60,
          terminalOutputLimit: settings.terminalOutputLimit ?? 50000,
          browserHeadless: settings.browserHeadless ?? true,
          browserIdleTimeout: settings.browserIdleTimeout ?? 5,
          browserViewportWidth: settings.browserViewportWidth ?? 1280,
          browserViewportHeight: settings.browserViewportHeight ?? 800,
          defaultSearchEngine: settings.defaultSearchEngine ?? 'bing',
          searchResultsCount: settings.searchResultsCount ?? 5,
          webFetchMaxLength: settings.webFetchMaxLength ?? 5000,
          webCacheEnabled: settings.webCacheEnabled ?? true,
          webCacheMaxSizeMB: settings.webCacheMaxSizeMB ?? 100,
          helperCommandTimeout: settings.helperCommandTimeout ?? 30,
          mcpConnectTimeout: settings.mcpConnectTimeout ?? 30,
          visionApiKey: settings.visionApiKey ?? 'sk-qeSAXtALEYUpoGzpOFtGQwpgCV4kmvv2lKak57q6PKF1Zj9m',
          visionBaseUrl: settings.visionBaseUrl ?? 'https://api.agnes-ai.cn/v1',
          visionModel: settings.visionModel ?? 'agnes-2.5-flash',
          mode: request.mode,
          requestUserInput: handlers.requestUserInput
        }
        await agentLoop(provider.apiKey, provider.baseUrl, { ...request, messages: messagesWithEnv, tools: sortedTools, supportsThinking: provider.supportsThinking }, handlers, toolContext, request.sessionId)
      } else {
        await streamChat(provider.apiKey, provider.baseUrl, { ...request, messages: messagesWithEnv, supportsThinking: provider.supportsThinking }, handlers)
      }
    } finally {
      // 会话结束后断开所有 MCP 连接
      await mcpSession.disconnectAll()
    }

    currentController = null
  })

  // LLM 摘要压缩 — 将旧消息发给 LLM 生成结构化摘要
  ipcMain.handle('chat:summarize', async (_event, messages: { role: string; content: string }[]): Promise<{ summary?: string; error?: string }> => {
    const settings = await loadSettings()
    const provider = getActiveProvider(settings)

    if (!provider.apiKey || !provider.baseUrl || !settings.model) {
      return { error: 'API 未配置，无法生成摘要' }
    }

    const summarySystemPrompt = `你是一个精确的对话摘要生成器。请将以下对话历史压缩为一个结构化摘要。

## 摘要要求
保留以下关键信息：
1. **任务目标**：用户的原始需求和当前进展状态
2. **关键决策**：用户做出的重要决定（审批/拒绝/偏好选择）
3. **文件修改记录**：修改了哪些文件、修改原因和结果
4. **错误与解决**：遇到的错误及其解决方案
5. **待办事项**：尚未完成的任务或下一步计划

## 输出格式
直接输出摘要文本（纯文本，不要 markdown 代码块包裹）。摘要应当简洁但信息完整，让后续对话能基于此摘要无缝继续工作。`

    const userContent = messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n\n')

    const url = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: 'system', content: summarySystemPrompt },
            { role: 'user', content: `以下是需要摘要的对话历史：\n\n${userContent}` }
          ],
          stream: false,
          max_tokens: 2048,
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(30_000)
      })

      if (!response.ok) {
        return { error: `API 错误: ${response.status}` }
      }

      const data = await response.json() as Record<string, unknown>
      const choices = data?.choices as Array<{ message?: { content?: string } }> | undefined
      const summary = choices?.[0]?.message?.content || ''
      if (!summary) return { error: '摘要生成结果为空' }
      return { summary }
    } catch (err) {
      return { error: err instanceof Error ? err.message : '摘要生成失败' }
    }
  })

  // 连接测试
  ipcMain.handle('chat:test', async (_event, apiKey: string, baseUrl: string, model: string) => {
    return testConnection(apiKey, baseUrl, model)
  })

  // 取消当前流式请求
  ipcMain.handle('chat:cancel', () => {
    if (currentController) {
      currentController.abort()
      currentController = null
    }
  })
}

/**
 * 构建运行环境信息字符串 — 注入为 system 消息（前缀位置），让 Agent 知道 OS、Shell 等。
 * 仅包含日期（不含时分秒），确保同一会话内前缀稳定，不破坏 prompt 缓存。
 * Agent 如需精确时间可用 terminal_exec 执行 date 命令。
 */

// 缓存静态部分 — OS/Shell/CPU/内存等在同一进程内不变，避免每次请求重复调用 os API
const _envStatic = (() => {
  const isWin = process.platform === 'win32'
  const isMac = process.platform === 'darwin'
  const platformName = isWin ? 'Windows' : isMac ? 'macOS' : 'Linux'
  const shellName = isWin ? 'PowerShell' : isMac ? 'zsh' : 'bash'
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const lines: string[] = [
    `💻 操作系统：${platformName} ${process.arch}`,
    `🔧 终端 Shell：${shellName}${isWin ? '（PowerShell 语法，如 $env:PATH）' : '（Bash 语法）'}`,
    `📦 Node.js：${process.version}`,
    `👤 用户：${os.userInfo().username}@${os.hostname()}`,
    `🧠 CPU 核心：${os.cpus().length}　💾 内存：${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
  ]
  const pathHint = isWin
    ? 'Windows 路径用反斜杠 \\(如 C:\\Users\\xxx)'
    : 'Unix 路径用正斜杠 /(如 /home/xxx)'
  return { tz, isWin, lines, pathHint }
})()

function buildEnvInfo(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[now.getDay()]

  const dateLine = `⏰ 当前日期：${dateStr} 星期${weekday} (${_envStatic.tz})`
  return `--- 运行环境 ---\n${dateLine}\n${_envStatic.lines.join('\n')}\n\n⚠️ 请基于以上信息使用正确的命令语法和路径格式（${_envStatic.pathHint}）。联网搜索时，上述日期即为"今天"，搜索最新信息时无需再询问用户当前日期。如需精确时间可用 terminal_exec 执行 date 命令。`
}
