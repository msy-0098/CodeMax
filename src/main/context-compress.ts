/**
 * Re-export from shared/ — 主进程和渲染进程共用同一套压缩逻辑，
 * 确保两端截断/压缩行为完全一致，避免因不一致导致 prompt 缓存失效。
 */
export { trimContext, truncateToolResult, totalChars } from '../shared/context-compress'
export type { AgentConfig } from '../shared/context-compress'
