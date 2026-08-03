// ====== 核心基础类型（无依赖） ======

export type Mode = 'office' | 'coding' | 'design'

export type ModelId = string

/** 思考强度：off=关闭, high=高, max=最高, ultra=终极（工程范式+监督Agent） */
export type ReasoningEffort = 'off' | 'high' | 'max' | 'ultra'

export type FontSize = 'sm' | 'md' | 'lg'
