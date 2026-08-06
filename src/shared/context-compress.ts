/**
 * 三级上下文压缩 — 参考 Reasonix 的 snip/prune/summary 设计
 *
 * 1. SNIP（软阈值 60%）：旧 tool 结果截断为摘要 + 前N字符
 * 2. PRUNE（硬阈值 80%）：进一步缩短旧 tool 结果为最小占位符
 * 3. 不做 summary 压缩（需要额外 LLM 调用，暂不实现，靠 snip+prune 足够）
 *
 * 此文件位于 shared/ 目录，供主进程和渲染进程（buildApiMessages.ts）共同使用，
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

/**
 * 估算会话当前的上下文占用（tokens）— 中英文混合约 2 字符/token。
 * 含正文、思考链与工具结果，用于展示每会话上下文使用率（压缩后实时下降）。
 */
export function estimateContextTokens(
  messages: { content?: string; reasoningContent?: string; toolResults?: { content?: string }[] }[]
): number {
  return messages.reduce((sum, m) => {
    let chars = m.content?.length ?? 0
    if (m.reasoningContent) chars += m.reasoningContent.length
    if (m.toolResults) {
      for (const r of m.toolResults) chars += r.content?.length ?? 0
    }
    return sum + Math.ceil(chars / 2)
  }, 0)
}

/**
 * 智能截断超长工具结果 — 优化版
 * 策略：保留开头（执行结果）+ 结尾（错误信息/总结）
 * 优势：相比只保留前 N 字符，能看到完整的执行状态
 */
export function truncateToolResult(content: string, config: AgentConfig): string {
  if (!content || content.length <= config.maxToolResultChars) return content

  const maxChars = config.maxToolResultChars

  // 智能截断：60% 给开头，30% 给结尾，10% 留给提示信息
  const headChars = Math.floor(maxChars * 0.6)
  const tailChars = Math.floor(maxChars * 0.3)

  const head = content.slice(0, headChars)
  const tail = content.slice(-tailChars)
  const omittedChars = content.length - headChars - tailChars

  return `${head}

[...省略中间 ${omittedChars.toLocaleString()} 个字符 (${Math.round(omittedChars / content.length * 100)}%)...]

${tail}

提示：如需完整内容，请使用更精确的查询参数重新调用工具`
}

/**
 * 上下文压缩主函数 — 三级压缩 + 关键消息保护
 *
 * 优化点：
 * 1. 保护用户交互记录（确认/拒绝）不被删除
 * 2. 保护包含错误信息的工具结果
 * 3. 智能分级压缩而非简单删除
 */
export function trimContext(
  messages: { role: string; content: string; tool_calls?: unknown; tool_call_id?: string }[],
  config: AgentConfig
): void {
  const snipThreshold = config.maxContextChars * 0.6
  const pruneThreshold = config.maxContextChars * 0.8
  const total = totalChars(messages)
  if (total <= snipThreshold) return

  // 标记关键消息索引 — 这些消息在压缩时会被保护
  const criticalMessages = new Set<number>()

  // 识别关键消息：用户交互、错误信息、重要决策
  messages.forEach((m, idx) => {
    if (m.role === 'tool') {
      const content = m.content?.toLowerCase() || ''
      // 用户交互记录（确认/拒绝）
      if (content.includes('用户拒绝') ||
          content.includes('用户取消') ||
          content.includes('用户同意') ||
          content.includes('用户决策')) {
        criticalMessages.add(idx)
        // 同时保护前面的 assistant 消息（tool_calls）
        if (idx > 0 && messages[idx - 1].role === 'assistant') {
          criticalMessages.add(idx - 1)
        }
      }
      // 错误信息
      if (content.includes('error:') ||
          content.includes('错误') ||
          content.includes('失败') ||
          content.includes('异常')) {
        criticalMessages.add(idx)
        if (idx > 0 && messages[idx - 1].role === 'assistant') {
          criticalMessages.add(idx - 1)
        }
      }
    }
  })

  const protectFrom = Math.max(1, messages.length - config.recentKeep)

  // 第一级：SNIP — 旧 tool 结果截断（跳过关键消息）
  if (total > snipThreshold) {
    for (let i = 1; i < protectFrom; i++) {
      if (criticalMessages.has(i)) continue  // 跳过关键消息

      const m = messages[i]
      if (m.role === 'tool' && m.content && m.content.length > config.snippedKeep + 100) {
        m.content = m.content.slice(0, config.snippedKeep) + '\n[...已自动截断以节省上下文空间]'
      }
    }
  }

  // 第二级：PRUNE — 如果 snip 后仍超阈值，进一步缩短（跳过关键消息）
  if (totalChars(messages) > pruneThreshold) {
    for (let i = 1; i < protectFrom; i++) {
      if (criticalMessages.has(i)) continue  // 跳过关键消息

      const m = messages[i]
      if (m.role === 'tool' && m.content && m.content.length > config.prunedKeep) {
        m.content = m.content.slice(0, config.prunedKeep) + '\n[...已省略]'
      }
    }
  }

  // 第三级：如果仍超阈值，截断旧的 assistant 内容（保留 tool_calls 结构，跳过关键消息）
  if (totalChars(messages) > config.maxContextChars) {
    for (let i = 1; i < protectFrom; i++) {
      if (criticalMessages.has(i)) continue  // 跳过关键消息

      const m = messages[i]
      if (m.role === 'assistant' && m.content && m.content.length > 500 && !m.tool_calls) {
        m.content = m.content.slice(0, 200) + '\n[...已省略]'
      }
      if (totalChars(messages) <= config.maxContextChars) break
    }
  }
}
