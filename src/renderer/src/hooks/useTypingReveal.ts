import { useEffect, useRef, useState } from 'react'

/** 纯函数：推进一个 reveal 步进，供单测 */
export function nextRevealLength(revealed: number, fullLength: number, charsPerTick: number): number {
  if (revealed >= fullLength) return revealed
  return Math.min(revealed + charsPerTick, fullLength)
}

/**
 * 打字机平滑显示 — 纯展示层
 * 流式期间 content 增长，revealed 指针以 tickMs/charsPerTick 节奏追赶；
 * 流式结束后立即显示完整内容。对所有服务商统一生效。
 *
 * 性能：reveal 更新被限制为至少间隔 minRevealIntervalMs 一次，并且按剩余差距
 * 自适应大步追赶，避免每个 tick 都触发 Markdown 重解析（react-markdown 解析 +
 * 代码高亮在 reveal 每 tick 变化时都会全部重跑）。
 */
export function useTypingReveal(
  content: string,
  isStreaming: boolean,
  charsPerTick = 6,
  tickMs = 50,
  minRevealIntervalMs = 100,
): string {
  const [revealed, setRevealed] = useState(0)
  const lastRevealAtRef = useRef(0)

  useEffect(() => {
    if (!isStreaming) {
      setRevealed(content.length)
      return
    }
    // 新流开始时 content 可能回退（重建占位消息），先把指针收敛
    setRevealed((prev) => Math.min(prev, content.length))
    const interval = setInterval(() => {
      const now = performance.now()
      if (now - lastRevealAtRef.current < minRevealIntervalMs) return
      lastRevealAtRef.current = now
      setRevealed((prev) => {
        const gap = content.length - prev
        if (gap <= 0) return prev
        // 至少推进 charsPerTick，余量过大时按一半追赶，2 步内追上最新内容
        return nextRevealLength(prev, content.length, Math.max(charsPerTick, Math.ceil(gap / 2)))
      })
    }, tickMs)
    return () => clearInterval(interval)
  }, [content, isStreaming, charsPerTick, tickMs, minRevealIntervalMs])

  return content.slice(0, revealed)
}
