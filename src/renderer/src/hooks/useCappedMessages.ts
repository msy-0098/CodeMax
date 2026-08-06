import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/** 每次「加载更早」的条数 */
const PAGE_SIZE = 40

/**
 * 历史消息分页渲染 — 只渲染最近 showCount 条。
 *
 * 原因：Office/Design 模式原先对 conversation.messages 全量渲染，
 * 长对话后 DOM 无限增长，且流式期间每个 flush 都要重新遍历全部历史消息，
 * 导致「越用越卡」。此 hook 把渲染限定在尾部窗口，并允许分批展开更早消息；
 * 展开时自动补偿滚动位置，避免当前视口内容跳动。
 */
export function useCappedMessages<T>(
  messages: readonly T[],
  scrollRef: { current: HTMLElement | null },
): {
  visible: readonly T[]
  hiddenCount: number
  loadEarlier: () => void
} {
  const [showCount, setShowCount] = useState(PAGE_SIZE)
  const prevScrollHeight = useRef(0)

  const hiddenCount = Math.max(0, messages.length - showCount)
  const visible = hiddenCount > 0 ? messages.slice(-showCount) : messages

  const loadEarlier = useCallback(() => {
    prevScrollHeight.current = scrollRef.current?.scrollHeight ?? 0
    setShowCount((c) => Math.min(c + PAGE_SIZE, messages.length))
  }, [messages.length, scrollRef])

  // 更早消息插入到视口上方后，同步补偿 scrollTop，保持当前可见内容不跳动
  useLayoutEffect(() => {
    if (prevScrollHeight.current <= 0) return
    const el = scrollRef.current
    if (el) {
      el.scrollTop += el.scrollHeight - prevScrollHeight.current
    }
    prevScrollHeight.current = 0
  }, [showCount, scrollRef])

  return { visible, hiddenCount, loadEarlier }
}
