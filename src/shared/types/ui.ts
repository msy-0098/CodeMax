// ====== UI 与模式配置类型 ======

import type { Mode } from './core'

// 各模式定义
export interface ModeConfig {
  id: Mode
  name: string
  icon: string
  description: string
  systemPrompt: string
  quickActions: QuickAction[]
  /** 快捷操作分组（替代扁平 quickActions 展示） */
  actionGroups?: ActionGroup[]
  /** 该模式默认启用的工具名称列表 */
  tools?: string[]
}

export interface QuickAction {
  id: string
  label: string
  icon: string
  prompt: string
  /** 简短描述，显示在卡片中 */
  description?: string
}

/** 快捷操作分组 */
export interface ActionGroup {
  category: string
  icon: string
  actions: QuickAction[]
}

// 预设对话模板
export interface ConversationTemplate {
  id: string
  title: string
  mode: Mode
  description: string
  prompt: string
}

// 连接测试结果
export interface TestResult {
  success: boolean
  message: string
  latency?: number
  model?: string
}

// ====== 文件树类型 ======

/** 文件树节点（主进程与渲染进程共享） */
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileTreeNode[]
}
