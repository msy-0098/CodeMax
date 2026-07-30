import type { Tool } from '../Tool'
import type { ToolDefinition, ToolCall, ToolResult, StreamChunk } from '../../../shared/types'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname } from 'path'

/**
 * 解析 design-systems 目录的绝对路径。
 *
 * electron-vite 打包后代码在 out/main/ 下，而 design-systems 是静态资源不会被打包。
 * 需要多重回退：① 打包后同目录（生产构建复制了资源）→ ② 源码目录（dev 模式）→ ③ 项目根 + src 路径。
 */
function resolveDesignSystemsDir(): string {
  // ① import.meta.url 同目录（资源已复制到输出目录）
  const bundledDir = dirname(new URL(import.meta.url).pathname.replace(/^\//, ''))
  const path1 = join(bundledDir, 'design-systems')
  if (existsSync(path1)) return path1

  // ② 源码目录（dev 模式：从 out/main/ 回溯到 src/main/tools/Design/）
  const srcDir = join(bundledDir, '../../src/main/tools/Design/design-systems')
  if (existsSync(srcDir)) return srcDir

  // ③ 项目根 + 源码路径
  const cwdDir = join(process.cwd(), 'src/main/tools/Design/design-systems')
  if (existsSync(cwdDir)) return cwdDir

  // 回退到 ①（即使不存在，也返回一个合理路径用于错误信息）
  return path1
}

/** design-systems 根目录 */
const DESIGN_SYSTEMS_DIR = resolveDesignSystemsDir()

/** 风格系统元数据 */
interface StyleManifest {
  id: string
  name: string
  category: string
  description: string
}

/** 缓存目录扫描结果 */
let cachedStyles: StyleManifest[] | null = null

/** 扫描 design-systems 目录 */
function scanStyles(): StyleManifest[] {
  if (cachedStyles) return cachedStyles

  const stylesDir = DESIGN_SYSTEMS_DIR
  if (!existsSync(stylesDir)) {
    cachedStyles = []
    return cachedStyles
  }

  const result: StyleManifest[] = []
  const entries = readdirSync(stylesDir)
  for (const entry of entries) {
    const dir = join(stylesDir, entry)
    if (!statSync(dir).isDirectory()) continue
    const manifestPath = join(dir, 'manifest.json')
    if (!existsSync(manifestPath)) continue
    try {
      const raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
      result.push({
        id: raw.id || entry,
        name: raw.name || entry,
        category: raw.category || 'Other',
        description: raw.description || ''
      })
    } catch {
      // skip invalid
    }
  }

  cachedStyles = result.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  return cachedStyles
}

/**
 * DesignStyleTool — 设计风格系统工具
 *
 * 移植自 open-design-main 的 design-systems 目录（151 个风格包）：
 * - action="list"            → 列出所有风格系统（按分类分组）
 * - action="get"             → 获取风格完整上下文（DESIGN.md + tokens.css）
 * - action="list_categories" → 列出所有分类及每类的风格数
 */
export class DesignStyleTool implements Tool {
  readonly definition: ToolDefinition = {
    name: 'design_style',
    description:
      '设计风格系统：列出 151 个设计风格（含 Apple、GitHub、Stripe、Brutalism、Minimal 等），获取风格完整上下文（DESIGN.md 设计指南 + tokens.css CSS 变量）。生成 UI 时使用此工具指定视觉风格。使用流程：先 list 浏览风格 → 再 get 获取 tokens.css 和设计指南 → 将 :root { ... } 粘贴到 HTML <style> 中 → 所有样式引用 var(--name)。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '操作类型：list=列出所有风格，get=获取风格完整上下文，list_categories=列出分类',
          enum: ['list', 'get', 'list_categories']
        },
        style_id: {
          type: 'string',
          description: '风格 ID（action=get 时使用），如 apple、github、minimal、brutalism、stripe、glassmorphism'
        },
        category: {
          type: 'string',
          description: '按分类过滤（action=list 时可选），如 "现代与极简"、"AI与大模型"、"质感与特效"'
        }
      },
      required: ['action']
    }
  }

  async execute(
    toolCall: ToolCall,
    onChunk?: (chunk: StreamChunk) => void,
    _signal?: AbortSignal
  ): Promise<ToolResult> {
    const action = (toolCall.arguments.action as string) || 'list'

    onChunk?.({ toolStatus: 'calling', toolName: 'design_style' })

    switch (action) {
      case 'list':
        return this.handleList(toolCall)
      case 'get':
        return this.handleGet(toolCall)
      case 'list_categories':
        return this.handleListCategories(toolCall)
      default:
        return this.error(toolCall.id, `未知操作: ${action}。支持: list / get / list_categories`)
    }
  }

  /** 列出所有风格 */
  private handleList(toolCall: ToolCall): ToolResult {
    const styles = scanStyles()
    const categoryFilter = (toolCall.arguments.category as string) || ''

    const filtered = categoryFilter
      ? styles.filter((s) => s.category === categoryFilter)
      : styles

    if (filtered.length === 0) {
      return {
        toolCallId: toolCall.id,
        toolName: 'design_style',
        content: categoryFilter
          ? `分类"${categoryFilter}"下没有风格系统。`
          : '当前没有可用的设计风格系统。',
        success: true,
        displayType: 'text'
      }
    }

    // 按分类分组
    const groups: Record<string, StyleManifest[]> = {}
    for (const s of filtered) {
      if (!groups[s.category]) groups[s.category] = []
      groups[s.category].push(s)
    }

    const lines: string[] = [`## 设计风格系统（${filtered.length} 个）\n`]
    for (const cat of Object.keys(groups).sort()) {
      lines.push(`### ${cat}（${groups[cat].length} 个）\n`)
      for (const s of groups[cat]) {
        lines.push(`- **${s.id}** — ${s.name}`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('使用 `design_style(action="get", style_id="风格ID")` 获取完整风格上下文（DESIGN.md + tokens.css）。')

    return {
      toolCallId: toolCall.id,
      toolName: 'design_style',
      content: lines.join('\n'),
      success: true,
      displayType: 'text',
      metadata: {
        count: filtered.length,
        categories: Object.keys(groups).map((c) => ({ category: c, count: groups[c].length }))
      }
    }
  }

  /** 列出所有分类 */
  private handleListCategories(toolCall: ToolCall): ToolResult {
    const styles = scanStyles()
    const counts: Record<string, number> = {}
    for (const s of styles) {
      counts[s.category] = (counts[s.category] || 0) + 1
    }

    const lines = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, count]) => `- **${cat}** — ${count} 个风格`)

    return {
      toolCallId: toolCall.id,
      toolName: 'design_style',
      content: `## 设计风格分类（${styles.length} 个风格，${Object.keys(counts).length} 个分类）\n\n${lines.join('\n')}`,
      success: true,
      displayType: 'text',
      metadata: { total: styles.length, categories: counts }
    }
  }

  /** 获取风格完整上下文 */
  private handleGet(toolCall: ToolCall): ToolResult {
    const styleId = (toolCall.arguments.style_id as string) || ''
    if (!styleId) {
      return this.error(toolCall.id, 'get 操作需要 style_id 参数')
    }

    const stylesDir = join(DESIGN_SYSTEMS_DIR, styleId)
    if (!existsSync(stylesDir)) {
      return this.error(toolCall.id, `未找到风格系统: ${styleId}。使用 \`design_style(action="list")\` 查看可用风格。`)
    }

    const parts: string[] = []

    // manifest.json
    const manifestPath = join(stylesDir, 'manifest.json')
    let manifest: StyleManifest | null = null
    if (existsSync(manifestPath)) {
      try {
        const raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
        manifest = { id: raw.id, name: raw.name, category: raw.category, description: raw.description }
        parts.push(`## 设计风格: ${manifest.name} (${manifest.id})\n`)
        parts.push(`**分类**: ${manifest.category}\n`)
      } catch {
        // skip
      }
    }

    // DESIGN.md — 设计指南
    const designMdPath = join(stylesDir, 'DESIGN.md')
    if (existsSync(designMdPath)) {
      const designMd = readFileSync(designMdPath, 'utf8')
      parts.push('\n---\n## 设计指南 (DESIGN.md)\n')
      parts.push(designMd)
    }

    // tokens.css — CSS 变量
    const tokensPath = join(stylesDir, 'tokens.css')
    if (existsSync(tokensPath)) {
      const tokensCss = readFileSync(tokensPath, 'utf8')
      parts.push('\n---\n## 设计令牌 (tokens.css)\n')
      parts.push('将以下 `:root { ... }` 块粘贴到 HTML 的第一个 `<style>` 中，然后所有样式引用 `var(--name)`：\n')
      parts.push('```css')
      parts.push(tokensCss)
      parts.push('```')
    }

    parts.push('\n---\n## 使用方法')
    parts.push('1. 将 tokens.css 中的 `:root { ... }` 块粘贴到 HTML `<style>` 标签内')
    parts.push('2. 所有颜色使用 `var(--accent)`、`var(--bg)`、`var(--fg)` 等')
    parts.push('3. 字体使用 `var(--font-display)`、`var(--font-body)`')
    parts.push('4. 间距使用 `var(--space-1)` 到 `var(--space-12)`')
    parts.push('5. 圆角使用 `var(--radius-sm)` 到 `var(--radius-pill)`')
    parts.push('6. 遵循 DESIGN.md 中的设计指南（颜色用法、排版层级、组件规范等）')

    return {
      toolCallId: toolCall.id,
      toolName: 'design_style',
      content: parts.join('\n'),
      success: true,
      displayType: 'text',
      metadata: {
        style_id: styleId,
        has_design_md: existsSync(designMdPath),
        has_tokens: existsSync(tokensPath)
      }
    }
  }

  private error(id: string, msg: string): ToolResult {
    return { toolCallId: id, toolName: 'design_style', content: '', success: false, error: msg }
  }
}
