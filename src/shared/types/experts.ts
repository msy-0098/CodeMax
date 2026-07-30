// ====== AI 专家库类型（无依赖） ======

/** 专家部门定义 */
export interface AgentDivision {
  key: string
  label: string
  icon: string
  color: string
}

/** AI 专家角色定义（来自 agency-agents 项目） */
export interface AgentExpert {
  /** 唯一标识，如 "engineering-frontend-developer" */
  id: string
  /** 所属部门 key */
  division: string
  /** 专家名称 */
  name: string
  /** 简短描述 */
  description: string
  /** 该专家推荐使用的工具列表 */
  tools: string[]
  /** 主题色（Tailwind 色名或 hex） */
  color: string
  /** 表情图标 */
  emoji: string
  /** 一句话风格描述 */
  vibe: string
  /** 人格设定（首段 Markdown 正文） */
  personality: string
}
