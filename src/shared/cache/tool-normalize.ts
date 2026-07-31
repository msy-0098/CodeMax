import type { ToolDefinition } from '../types/tools'

/**
 * normalizeToolSchemas — 参考 Reasonix 的 normalizeToolSchemas()
 *
 * 按 Name → Description → Parameters 字典序排序工具列表。
 * 工具列表顺序变化会让 tools JSON 字节变化，破坏 prompt cache 前缀。
 * 排序后哈希该结果用于诊断（PrefixShape.toolsHash）。
 */
export function normalizeToolSchemas(tools: ToolDefinition[]): ToolDefinition[] {
  return [...tools].sort((a, b) => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1
    if (a.description !== b.description) return a.description < b.description ? -1 : 1
    const ap = JSON.stringify(a.parameters)
    const bp = JSON.stringify(b.parameters)
    return ap < bp ? -1 : ap > bp ? 1 : 0
  })
}
