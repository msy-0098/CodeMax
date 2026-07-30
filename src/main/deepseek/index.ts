// deepseek 模块 — AI 提供者层
// 拆分为 context / api / agent-loop 子模块，此文件作为统一入口 barrel re-export
// 保持对外 API 完全兼容

export { configureAgentLoop } from './context'
export { callDeepSeekStream, streamChat, testConnection } from './api'
export { agentLoop } from './agent-loop'
export { countTokens, countMessageTokens, isTokenizerReady } from './tokenizer'
export type { StreamHandlers, SingleCallResult } from './types'
