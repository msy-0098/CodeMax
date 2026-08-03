import type { NormalizedUsage } from './types'

/**
 * normaliseUsage — 参考 Reasonix 的 normaliseUsage()
 *
 * 将两种 cache-hit 字段形态归一为统一的 Usage：
 * - deepseek 端点: prompt_cache_hit_tokens / prompt_cache_miss_tokens 在 usage 顶层
 * - OpenAI/MiMo: prompt_tokens_details.cached_tokens 嵌套
 *
 * 哪边报告非零值就用哪边；当只有 hit 时派生 miss = prompt - hit，
 * 保证 hit + miss == prompt，状态行百分比正确。
 */
export function normaliseUsage(raw: {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number; reasoning_tokens?: number }
  completion_tokens_details?: { reasoning_tokens?: number }
  finish_reason?: string
}): NormalizedUsage {
  const promptTokens = raw.prompt_tokens ?? 0
  let hit = raw.prompt_cache_hit_tokens ?? 0
  let miss = raw.prompt_cache_miss_tokens ?? 0

  // OpenAI/MiMo 形态：嵌套在 prompt_tokens_details 下
  if (hit === 0 && raw.prompt_tokens_details?.cached_tokens) {
    hit = raw.prompt_tokens_details.cached_tokens
  }

  // 派生 miss — 当后端只给 hit 时，miss = prompt - hit
  if (miss === 0 && hit > 0 && promptTokens > hit) {
    miss = promptTokens - hit
  }

  let reasoningTokens = 0
  if (raw.completion_tokens_details?.reasoning_tokens) {
    reasoningTokens = raw.completion_tokens_details.reasoning_tokens
  } else if (raw.prompt_tokens_details?.reasoning_tokens) {
    reasoningTokens = raw.prompt_tokens_details.reasoning_tokens
  }

  return {
    promptTokens,
    completionTokens: raw.completion_tokens ?? 0,
    totalTokens: raw.total_tokens ?? promptTokens + (raw.completion_tokens ?? 0),
    cacheHitTokens: hit,
    cacheMissTokens: miss,
    reasoningTokens,
    finishReason: raw.finish_reason ?? ''
  }
}
