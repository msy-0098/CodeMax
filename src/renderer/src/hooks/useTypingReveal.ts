import { useEffect, useState } from 'react'

/** 纯函数：推进一个 reveal 步进，供单测 */
export function nextRevealLength(revealed: number, fullLength: number, charsPerTick: number): number {
  if (revealed >= fullLength) return revealed
  return Math.min(revealed + charsPerTick, fullLength)
}

/**
 * 打字机平滑显示 — 纯展示层
 * 流式期间 content 增长，revealed 指针以 tickMs/charsPerTick 节奏追赶；
 * 流式结束后立即显示完整内容。对所有服务商统一生效。
 */
export function useTypingReveal(content: string, isStreaming: boolean, charsPerTick = 3, tickMs = 30): string {
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    if (!isStreaming) {
      setRevealed(content.length)
      return
    }
    const interval = setInterval(() => {
      setRevealed((prev) => nextRevealLength(prev, content.length, charsPerTick))
    }, tickMs)
    return () => clearInterval(interval)
  }, [content, isStreaming, charsPerTick, tickMs])

  return content.slice(0, revealed)
}
