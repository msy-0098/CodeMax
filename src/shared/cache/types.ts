/**
 * 缓存优化类型定义 — 参考 Reasonix 的 PrefixShape / CacheDiagnostics
 *
 * 这些类型在主进程（agent-loop）和渲染进程（SessionTokenStats）之间共享。
 */

/** 前缀形状快照 — 每轮 API 请求前捕获，用于轮间对比诊断 cache miss 原因 */
export interface PrefixShape {
  /** sha256(systemPrompt)[:8] */
  systemHash: string
  /** sha256(normalizedToolsJSON)[:8] */
  toolsHash: string
  /** sha256(system + tools)[:8] */
  prefixHash: string
  /** 历史重写版本号（compact/snip/prune 递增） */
  logRewriteVersion: number
  /** 工具 schema 估算 token 数 */
  toolSchemaTokens: number
}

/** 缓存诊断 — 随 Usage 事件上报，描述前缀变化原因 */
export interface CacheDiagnostics {
  prefixHash: string
  prefixChanged: boolean
  /** "system" | "tools" | "log_rewrite" */
  prefixChangeReasons: string[]
  systemHash: string
  toolsHash: string
  logRewriteVersion: number
  toolSchemaTokens: number
  cacheMissTokens: number
  cacheHitTokens: number
}

/** 归一化后的 Usage — 统一 DeepSeek/OpenAI 两种缓存字段形态 */
export interface NormalizedUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cacheHitTokens: number
  cacheMissTokens: number
  reasoningTokens: number
  finishReason: string
}

/** 四档 compaction 统计 */
export interface CompactionStats {
  tier: 'none' | 'soft' | 'snip' | 'compact' | 'force'
  snippedResults: number
  prunedResults: number
  savedChars: number
  stuckPaused: boolean
}
