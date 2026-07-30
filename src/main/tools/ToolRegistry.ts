import type { Tool } from './Tool'
import type { ToolDefinition } from '../../shared/types'

/**
 * 工具注册表 — 单例模式
 * 管理所有已注册的工具，按名称索引
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>()

  /** 注册一个工具 */
  register(tool: Tool): void {
    const name = tool.definition.name
    if (this.tools.has(name)) {
      console.warn(`[ToolRegistry] 工具 "${name}" 已存在，将被覆盖。`)
    }
    this.tools.set(name, tool)
  }

  /** 批量注册 */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool)
    }
  }

  /** 按名称查找工具 */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /** 获取所有工具定义（用于发送给 LLM） */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition)
  }

  /** 按名称列表获取工具 */
  getByNames(names: string[]): Tool[] {
    return names.map((n) => this.tools.get(n)).filter((t): t is Tool => t !== undefined)
  }

  /** 获取所有已注册工具 */
  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  /** 检查工具是否已注册 */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /** 清空注册表 */
  clear(): void {
    this.tools.clear()
  }
}

/** 全局单例 */
export const toolRegistry = new ToolRegistry()
