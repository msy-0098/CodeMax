// ====== 技能系统类型 ======

import type { ToolCall, ToolResult } from './tools'

/** 技能操作步骤 — 录制过程中捕获的单个操作 */
export interface SkillStep {
  /** 工具名称（如 browser_navigate, browser_click, browser_type 等） */
  tool: string
  /** 工具调用参数 */
  arguments: Record<string, unknown>
  /** 操作时间戳 */
  timestamp: number
  /** 可选：操作截图 base64 */
  screenshot?: string
  /** 可选：操作描述（由 LLM 生成） */
  description?: string
}

/** 技能定义 — 录制完成后沉淀的操作序列 */
export interface Skill {
  id: string
  /** 技能名称 */
  name: string
  /** 技能描述（用于相似任务匹配） */
  description: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 调用次数 */
  invokeCount: number
  /** 操作步骤序列（工具调用记录，用于 AI 理解和兼容回放） */
  steps: SkillStep[]
  /** rrweb 录制的 DOM 事件流（用于真实回放） */
  rrwebEvents?: Record<string, unknown>[]
  /** 技能标签（用于分类和匹配） */
  tags: string[]
  /** 技能来源：录制 / 手动创建 / AI专家激活 */
  source: 'recorded' | 'manual' | 'expert'
  /** 录制时的起始 URL（如果有） */
  startUrl?: string
  /** 录制时捕获的 API 端点列表 */
  apiEndpoints?: string[]
  // ---- 专家技能专属字段（source='expert' 时使用）----
  /** 专家 ID */
  expertId?: string
  /** 专家名称 */
  expertName?: string
  /** 专家系统提示词（含人格、能力、工作风格、工具配置、工作流） */
  systemPrompt?: string
  /** 推荐工具配置列表 */
  configuredTools?: string[]
  /** 预设自动化工作流 */
  workflow?: string
}

/** 录制会话状态 */
export interface RecordingSession {
  id: string
  /** 是否正在录制 */
  isRecording: boolean
  /** 录制开始时间 */
  startedAt: number | null
  /** 已录制的操作步骤 */
  steps: SkillStep[]
  /** 录制起始 URL */
  startUrl?: string
  /** rrweb 录制的 DOM 事件流 */
  rrwebEvents: Record<string, unknown>[]
  /** rrweb 录制的事件数量 */
  rrwebEventCount: number
}

// ====== 导入技能（SKILL.md 格式）类型 ======

/** 从 SKILL.md 文件解析出的导入技能 — 兼容 Claude / CatPaw / Open Design 等格式 */
export interface ImportedSkill {
  /** 唯一标识 */
  id: string
  /** 技能名称（来自 YAML frontmatter） */
  name: string
  /** 技能描述（来自 YAML frontmatter） */
  description: string
  /** 触发词列表（来自 YAML frontmatter） */
  triggers: string[]
  /** SKILL.md 正文内容（Markdown 格式的指令体） */
  body: string
  /** 是否启用 */
  enabled: boolean
  /** 导入时间 */
  importedAt: number
  /** 导入来源：file=从文件导入, text=从文本粘贴 */
  source: 'file' | 'text'
  /** 原始文件名（source='file' 时有值） */
  fileName?: string
}
