import type { ToolCall } from '../../shared/types'
import type { SingleCallResult } from './types'

// ---------- 常量 ----------

/** Agent Loop 可配置参数 — 从 settings 注入，默认值与 DEFAULT_SETTINGS 一致 */
export const agentConfig = {
  maxToolRounds: 30,
  maxToolResultChars: 8000,
  maxContextChars: 300000,
  recentKeep: 5,
  snippedKeep: 200,
  prunedKeep: 80,
  checkpointEnabled: true
}

/** 从外部设置 agent 配置（由 index.ts 在 agentLoop 调用前注入） */
export function configureAgentLoop(config: Partial<typeof agentConfig>): void {
  Object.assign(agentConfig, config)
}

// ---------- 工具函数 ----------

/** 构造错误返回值 */
export function errorResult(error: string): SingleCallResult {
  return { finishReason: 'error', content: '', reasoningContent: '', toolCalls: [], error }
}

/** 从流式累积的 toolCallsAcc 中收集最终 ToolCall[] */
export function collectToolCalls(acc: Map<number, { id: string; name: string; arguments: string }>): ToolCall[] {
  return Array.from(acc.values()).map((tc) => {
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(tc.arguments) } catch { /* keep empty */ }
    return { id: tc.id, name: tc.name, arguments: args } as ToolCall
  })
}

/** 截断超长工具结果，防爆上下文 */
export function truncateToolResult(content: string): string {
  if (!content || content.length <= agentConfig.maxToolResultChars) return content
  const truncated = content.slice(0, agentConfig.maxToolResultChars)
  return `${truncated}

[...结果已截断，原始长度 ${content.length} 字符。如需完整内容请重新调用工具并指定更小范围]`
}

/**
 * 净化文本内容，移除会导致 API JSON 解析失败的不可见字符。
 *
 * 根因：web_search / web_fetch 抓取的网页内容中可能包含：
 * - 控制字符（0x00-0x1F 除 \n \r \t）
 * - 孤立 Unicode 代理对（lone surrogates, 0xD800-0xDFFF）
 * - 非 printable 字符（0x7F）
 * 这些字符经 JSON.stringify 后产生的转义序列，部分 API JSON 解析器无法正确解析，
 * 报 "unexpected end of hex escape" 错误。
 */
export function sanitizeContent(text: string): string {
  if (!text) return text
  // 移除控制字符（保留 \n \r \t）和 DEL 字符
  // 移除孤立代理对（0xD800-0xDFFF）
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '\uFFFD')
}

/** 计算消息列表总字符数 */
export function totalChars(messages: { content?: string }[]): number {
  return messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)
}

/**
 * 三级上下文压缩 — 参考 Reasonix 的 snip/prune/summary 设计
 *
 * 1. SNIP（软阈值 60%）：旧 tool 结果截断为摘要 + 前N字符
 * 2. PRUNE（硬阈值 80%）：进一步缩短旧 tool 结果为最小占位符
 * 3. 不做 summary 压缩（需要额外 LLM 调用，暂不实现，靠 snip+prune 足够）
 */
export function trimContext(messages: { role: string; content: string; tool_calls?: unknown; tool_call_id?: string }[]): void {
  const snipThreshold = agentConfig.maxContextChars * 0.6
  const pruneThreshold = agentConfig.maxContextChars * 0.8
  const total = totalChars(messages)
  if (total <= snipThreshold) return

  const protectFrom = Math.max(1, messages.length - agentConfig.recentKeep)

  // 第一级：SNIP — 旧 tool 结果截断
  if (total > snipThreshold) {
    for (let i = 1; i < protectFrom; i++) {
      const m = messages[i]
      if (m.role === 'tool' && m.content && m.content.length > agentConfig.snippedKeep + 100) {
        m.content = m.content.slice(0, agentConfig.snippedKeep) + '\n[...已自动截断以节省上下文空间]'
      }
    }
  }

  // 第二级：PRUNE — 如果 snip 后仍超阈值，进一步缩短
  if (totalChars(messages) > pruneThreshold) {
    for (let i = 1; i < protectFrom; i++) {
      const m = messages[i]
      if (m.role === 'tool' && m.content && m.content.length > agentConfig.prunedKeep) {
        m.content = m.content.slice(0, agentConfig.prunedKeep) + '\n[...已省略]'
      }
    }
  }

  // 第三级：如果仍超阈值，截断旧的 assistant 内容（保留 tool_calls 结构）
  if (totalChars(messages) > agentConfig.maxContextChars) {
    for (let i = 1; i < protectFrom; i++) {
      const m = messages[i]
      if (m.role === 'assistant' && m.content && m.content.length > 500 && !m.tool_calls) {
        m.content = m.content.slice(0, 200) + '\n[...已省略]'
      }
      if (totalChars(messages) <= agentConfig.maxContextChars) break
    }
  }
}
