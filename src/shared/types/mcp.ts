// ====== MCP 服务器配置类型（无依赖） ======

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
