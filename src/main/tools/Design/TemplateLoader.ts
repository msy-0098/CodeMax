/**
 * 设计模板加载器
 *
 * 移植自 open-design-main 的模板系统模式：
 * - 扫描 templates/ 目录下的子目录
 * - 解析每个 SKILL.md 的 YAML frontmatter（name / description / triggers / platform）
 * - 按 triggers 关键词匹配模板
 * - 按需加载模板资源（种子文件、布局库、自检清单）
 *
 * 模板目录结构：
 *   templates/
 *   ├── web-prototype/
 *   │   ├── SKILL.md               ← frontmatter + 工作流说明
 *   │   ├── assets/template.html   ← 种子文件
 *   │   └── references/
 *   │       ├── layouts.md         ← 可粘贴的区块骨架
 *   │       └── checklist.md       ← P0/P1/P2 自检清单
 *   ├── dashboard/
 *   │   └── SKILL.md
 *   ├── mobile-app/
 *   │   ├── SKILL.md
 *   │   ├── assets/template.html
 *   │   └── references/
 *   │       ├── layouts.md
 *   │       └── checklist.md
 *   └── saas-landing/
 *       └── SKILL.md
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { parseFrontmatter, type FrontmatterObject } from './FrontmatterParser'

/** 模板元数据（从 SKILL.md frontmatter 解析） */
export interface TemplateMeta {
  /** 模板 ID（目录名） */
  id: string
  /** 模板名称 */
  name: string
  /** 描述 */
  description: string
  /** 触发关键词 */
  triggers: string[]
  /** 目标平台 */
  platform: string
  /** SKILL.md 正文（frontmatter 之后的 Markdown） */
  body: string
  /** 模板目录绝对路径 */
  dir: string
}

/** 模板完整上下文（含资源文件内容） */
export interface TemplateContext extends TemplateMeta {
  /** 种子文件内容（如 assets/template.html） */
  seed?: string
  /** 布局库内容（如 references/layouts.md） */
  layouts?: string
  /** 自检清单内容（如 references/checklist.md） */
  checklist?: string
}

class TemplateLoaderImpl {
  private templates: TemplateMeta[] = []
  private loaded = false
  private templatesDir: string

  constructor() {
    // 多重回退：① 打包后同目录 → ② 源码目录（dev 模式）→ ③ 项目根 + src 路径
    const bundledDir = dirname(new URL(import.meta.url).pathname.replace(/^\//, ''))
    const candidates = [
      join(bundledDir, 'templates'),
      join(bundledDir, '../../src/main/tools/Design/templates'),
      join(process.cwd(), 'src/main/tools/Design/templates')
    ]
    this.templatesDir = candidates.find((p) => existsSync(p)) ?? candidates[0]
  }

  /** 懒加载：首次调用时扫描目录 */
  private ensureLoaded(): void {
    if (this.loaded) return

    try {
      if (!existsSync(this.templatesDir)) {
        console.warn('[TemplateLoader] 模板目录不存在:', this.templatesDir)
        this.loaded = true
        return
      }

      const entries = readdirSync(this.templatesDir)
      for (const entry of entries) {
        const entryPath = join(this.templatesDir, entry)
        if (!statSync(entryPath).isDirectory()) continue

        const skillPath = join(entryPath, 'SKILL.md')
        if (!existsSync(skillPath)) continue

        try {
          const raw = readFileSync(skillPath, 'utf-8')
          const { data, body } = parseFrontmatter(raw)
          this.templates.push({
            id: entry,
            name: (data.name as string) || entry,
            description: (data.description as string) || '',
            triggers: extractTriggers(data),
            platform: (data.platform as string) || 'desktop',
            body,
            dir: entryPath
          })
        } catch (e) {
          console.warn(`[TemplateLoader] 解析模板 ${entry} 失败:`, e)
        }
      }
    } catch (e) {
      console.error('[TemplateLoader] 扫描模板目录失败:', e)
    }

    this.loaded = true
  }

  /** 列出所有模板元数据 */
  list(): TemplateMeta[] {
    this.ensureLoaded()
    return this.templates
  }

  /** 按关键词匹配模板（返回所有匹配，按匹配度排序） */
  match(query: string): TemplateMeta[] {
    this.ensureLoaded()
    const lower = query.toLowerCase()

    const scored = this.templates
      .map((tpl) => {
        let score = 0
        for (const trigger of tpl.triggers) {
          const t = trigger.toLowerCase()
          if (lower.includes(t)) {
            score += t.length
          }
          if (t.includes(lower)) {
            score += lower.length
          }
        }
        // 名称匹配也加分
        if (lower.includes(tpl.name.toLowerCase())) {
          score += tpl.name.length
        }
        return { tpl, score }
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)

    return scored.map((s) => s.tpl)
  }

  /** 获取模板完整上下文（含资源文件） */
  getContext(templateId: string): TemplateContext | null {
    this.ensureLoaded()
    const meta = this.templates.find((t) => t.id === templateId || t.name === templateId)
    if (!meta) return null

    const ctx: TemplateContext = { ...meta }

    // 加载种子文件
    const seedPath = join(meta.dir, 'assets', 'template.html')
    if (existsSync(seedPath)) {
      try {
        ctx.seed = readFileSync(seedPath, 'utf-8')
      } catch { /* 忽略 */ }
    }

    // 加载布局库
    const layoutsPath = join(meta.dir, 'references', 'layouts.md')
    if (existsSync(layoutsPath)) {
      try {
        ctx.layouts = readFileSync(layoutsPath, 'utf-8')
      } catch { /* 忽略 */ }
    }

    // 加载自检清单
    const checklistPath = join(meta.dir, 'references', 'checklist.md')
    if (existsSync(checklistPath)) {
      try {
        ctx.checklist = readFileSync(checklistPath, 'utf-8')
      } catch { /* 忽略 */ }
    }

    return ctx
  }

  /** 重新扫描（用于开发时热更新） */
  reload(): void {
    this.templates = []
    this.loaded = false
    this.ensureLoaded()
  }
}

/** 从 frontmatter 数据中提取 triggers 数组 */
function extractTriggers(data: FrontmatterObject): string[] {
  const raw = data.triggers
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string')
  }
  if (typeof raw === 'string') {
    return [raw]
  }
  return []
}

/** 单例 */
export const templateLoader = new TemplateLoaderImpl()
