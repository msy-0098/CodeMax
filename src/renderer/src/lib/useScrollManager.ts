// ── 滚动管理 Hook ─────────────────────────────────────────────────────
// 参考 Reasonix 的 useScrollManager
// 自动钉底 + 用户意图检测 + rAF 合并流式滚动

import { useCallback, useEffect, useRef, useState } from 'react'

const BOTTOM_THRESHOLD_PX = 80
const TOUCH_SCROLL_THRESHOLD_PX = 2
const SCROLL_BREAK_KEYS = new Set(['ArrowUp', 'PageUp', 'Home'])
const CONDITIONAL_SCROLL_KEYS = new Set(['ArrowDown', 'PageDown', 'End', ' ', 'Spacebar'])

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX
}

function isScrollable(el: HTMLElement): boolean {
  return el.scrollHeight - el.clientHeight > 1
}

export function useScrollManager() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const prevQuestionsLen = useRef(0)
  const repinFrame = useRef<number | null>(null)
  const pendingRepinHeightDelta = useRef(0)
  const lastClientHeight = useRef<number | null>(null)
  const lastFooterHeight = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const resizeFrame = useRef<number | null>(null)
  const layoutScrollFrames = useRef<number[]>([])
  const [isAtBottom, setIsAtBottom] = useState(true)

  // 清理
  useEffect(() => {
    return () => {
      if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current)
      if (repinFrame.current !== null) cancelAnimationFrame(repinFrame.current)
      for (const f of layoutScrollFrames.current) cancelAnimationFrame(f)
      layoutScrollFrames.current = []
    }
  }, [])

  const updateBottomState = useCallback((el: HTMLElement) => {
    const atBottom = isNearBottom(el)
    stick.current = atBottom
    setIsAtBottom(atBottom)
    return atBottom
  }, [])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    updateBottomState(el)
  }, [updateBottomState])

  // 滚轮意图：用户上滚时取消钉底
  const onWheelIntent = useCallback((event: React.WheelEvent<HTMLElement>) => {
    const el = scrollRef.current
    if (!el) return false
    if (event.deltaY < 0 && !isNearBottom(el)) {
      stick.current = false
      setIsAtBottom(false)
      return true
    }
    return false
  }, [])

  // 触摸意图
  const onTouchStartIntent = useCallback((event: React.TouchEvent<HTMLElement>) => {
    touchStartY.current = event.touches[0]?.clientY ?? null
  }, [])

  const onTouchMoveIntent = useCallback((event: React.TouchEvent<HTMLElement>) => {
    const el = scrollRef.current
    if (!el || touchStartY.current === null) return false
    const dy = event.touches[0]?.clientY - touchStartY.current
    if (dy > TOUCH_SCROLL_THRESHOLD_PX && !isNearBottom(el)) {
      stick.current = false
      setIsAtBottom(false)
      return true
    }
    return false
  }, [])

  // 键盘意图
  const onKeyScrollIntent = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const el = scrollRef.current
    if (!el) return false
    if (SCROLL_BREAK_KEYS.has(event.key)) {
      stick.current = false
      setIsAtBottom(false)
      return true
    }
    if (CONDITIONAL_SCROLL_KEYS.has(event.key) && !isNearBottom(el)) {
      stick.current = false
      setIsAtBottom(false)
      return true
    }
    return false
  }, [])

  // 平滑滚动到指定元素
  const smoothScrollTo = useCallback((target: HTMLElement, offset = 12) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({
      top: target.offsetTop - el.offsetTop - offset,
      behavior: 'smooth',
    })
  }, [])

  // 布局安全滚动到底部
  const scrollToBottomAfterLayout = useCallback((retryCount = 3) => {
    const el = scrollRef.current
    if (!el) return
    const doScroll = (attempt: number) => {
      if (attempt <= 0) return
      requestAnimationFrame(() => {
        const e = scrollRef.current
        if (!e) return
        e.scrollTop = e.scrollHeight
        if (attempt > 1) {
          layoutScrollFrames.current.push(requestAnimationFrame(() => doScroll(attempt - 1)))
        }
      })
    }
    doScroll(retryCount)
  }, [])

  // 跟踪问题数量变化 — 新问题出现时钉底
  const trackQuestions = useCallback((count: number) => {
    if (count > prevQuestionsLen.current) {
      stick.current = true
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
    prevQuestionsLen.current = count
  }, [])

  // 如果之前钉底，高度变化后重新钉底
  const scheduleRepinIfWasPinned = useCallback((heightDelta: number) => {
    if (!stick.current) return
    if (heightDelta === 0) return
    pendingRepinHeightDelta.current += heightDelta
    if (repinFrame.current !== null) return
    repinFrame.current = requestAnimationFrame(() => {
      repinFrame.current = null
      const el = scrollRef.current
      if (!el || !stick.current) return
      el.scrollTop = el.scrollHeight
      pendingRepinHeightDelta.current = 0
    })
  }, [])

  // ResizeObserver — 容器高度变化时重新钉底
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    lastClientHeight.current = el.clientHeight
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? el.clientHeight
      const previous = lastClientHeight.current ?? height
      lastClientHeight.current = height
      scheduleRepinIfWasPinned(height - previous)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (resizeFrame.current !== null) {
        cancelAnimationFrame(resizeFrame.current)
        resizeFrame.current = null
      }
    }
  }, [scheduleRepinIfWasPinned])

  return {
    scrollRef,
    stick,
    onScroll,
    onWheelIntent,
    onTouchStartIntent,
    onTouchMoveIntent,
    onKeyScrollIntent,
    isAtBottom,
    smoothScrollTo,
    scrollToBottomAfterLayout,
    trackQuestions,
    scheduleRepinIfWasPinned,
    lastClientHeight,
    lastFooterHeight,
    resizeFrame,
  }
}
