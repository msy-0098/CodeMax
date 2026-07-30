/**
 * 三级上下文压缩 — 参考 Reasonix 的 snip/prune/summary 设计
 *
 * 1. SNIP（软阈值 60%）：旧 tool 结果截断为摘要 + 前N字符
 * 2. PRUNE（硬阈值 80%）：进一步缩短旧 tool 结果为最小占位符
 * 3. 不做 summary 压缩（需要额外 LLM 调用，暂不实现，靠 snip+prune 足够）
 *
 * 此文件位于 shared/ 目录，供主进程（deepseek.ts）和渲染进程（buildApiMessages.ts）共同使用，
 * 确保两端的截断/压缩逻辑完全一致，避免因不一致导致 prompt 缓存失效。
 */

export interface AgentConfig {
  maxToolResultChars: number
  maxContextChars: number
  recentKeep: number
  snippedKeep: number
  prunedKeep: number
}

/** 计算消息列表总字符数 */
export function totalChars(messages: { content?: string }[]): number {
  return messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)
}

/** 截断超长工具结果，防爆上下文 */
export function truncateToolResult(content: string, config: AgentConfig): string {
  if (!content || content.length <= config.maxToolResultChars) return content
  const truncated = content.slice(0, config.maxToolResultChars)
  return `${truncated}

[...结果已截断，原始长度 ${content.length} 字符。如需完整内容请重新调用工具并指定更小范围]`
}

export function trimContext(
  messages: { role: string; content: string; tool_calls?: unknown; tool_call_id?: string }[],
  config: AgentConfig
): void {
  const snipThreshold = config.maxContextChars * 0.6
  const pruneThreshold = config.maxContextChars * 0.8
  const total = totalChars(messages)
  if (total <= snipThreshold) return

  const protectFrom = Math.max(1, messages.length - config.recentKeep)

  // 第一级：SNIP — 旧 tool 结果截断
  if (total > snipThreshold) {
    for (let i = 1; i < protectFrom; i++) {
      const m = messages[i]
      if (m.role === 'tool' && m.content && m.content.length > config.snippedKeep + 100) {
        m.content = m.content.slice(0, config.snippedKeep) + '\n[...已自动截断以节省上下文空间]'
      }
    }
  }

  // 第二级：PRUNE — 如果 snip 后仍超阈值，进一步缩短
  if (totalChars(messages) > pruneThreshold) {
    for (let i = 1; i < protectFrom; i++) {
      const m = messages[i]
      if (m.role === 'tool' && m.content && m.content.length > config.prunedKeep) {
        m.content = m.content.slice(0, config.prunedKeep) + '\n[...已省略]'
      }
    }
  }

  // 第三级：如果仍超阈值，截断旧的 assistant 内容（保留 tool_calls 结构）
  if (totalChars(messages) > config.maxContextChars) {
    for (let i = 1; i < protectFrom; i++) {
      const m = messages[i]
      if (m.role === 'assistant' && m.content && m.content.length > 500 && !m.tool_calls) {
        m.content = m.content.slice(0, 200) + '\n[...已省略]'
      }
      if (totalChars(messages) <= config.maxContextChars) break
    }
  }
}
