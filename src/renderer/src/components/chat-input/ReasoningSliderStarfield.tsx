import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { HelpCircle, MoveHorizontal } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ReasoningEffort } from '../../../../shared/types'

/** 5 档思考强度配置 (完美对应参考图中的 5 个吸附刻度点) */
const EFFORT_LEVELS: {
  value: ReasoningEffort
  label: string
  isUltracode?: boolean
}[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'ultra', label: 'Ultracode', isUltracode: true }
]

/** 轨道内边距 (px) */
const TRACK_PAD = 14

export function ReasoningSlider(): React.ReactElement {
  const effort = useStore((s) => s.settings?.reasoningEffort ?? 'high')
  const updateSettings = useStore((s) => s.updateSettings)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // 悬停刻度 index (用于展示 Tooltip 黑胶囊)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // 拖拽连续位置 (0..1)
  const [dragRatio, setDragRatio] = useState<number | null>(null)

  // 当前激活档位 index (0..4)
  const currentIndex = useMemo(() => {
    switch (effort) {
      case 'off':
        return 0
      case 'low':
        return 1
      case 'medium':
        return 2
      case 'high':
      case 'max':
        return 3
      case 'ultra':
        return 4
      default:
        return 3
    }
  }, [effort])

  const posPercent = (currentIndex / (EFFORT_LEVELS.length - 1)) * 100

  // 点击外部关闭 Popover
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // 计算 clientX 对应的 0..1 连续轨道比例
  const ratioFromClientX = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const innerWidth = rect.width - TRACK_PAD * 2
    if (innerWidth <= 0) return 0
    const x = clientX - rect.left - TRACK_PAD
    return Math.max(0, Math.min(1, x / innerWidth))
  }, [])

  const ratioToIndex = useCallback((ratio: number): number => {
    return Math.round(ratio * (EFFORT_LEVELS.length - 1))
  }, [])

  // 拖拽跟手与松手吸附保存
  useEffect(() => {
    if (dragRatio === null) return
    const onMove = (e: MouseEvent): void => setDragRatio(ratioFromClientX(e.clientX))
    const onUp = (e: MouseEvent): void => {
      const idx = ratioToIndex(ratioFromClientX(e.clientX))
      setDragRatio(null)
      const nextLevel = EFFORT_LEVELS[idx]
      if (nextLevel) {
        void updateSettings({ reasoningEffort: nextLevel.value })
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragRatio, ratioFromClientX, ratioToIndex, updateSettings])

  const displayThumbPos = dragRatio !== null ? dragRatio * 100 : posPercent
  const activeIndex = dragRatio !== null ? ratioToIndex(dragRatio) : currentIndex
  const activeLevel = EFFORT_LEVELS[activeIndex] || EFFORT_LEVELS[3]
  const isUltracodeActive = activeLevel.isUltracode === true

  const handleTrackMouseDown = (e: React.MouseEvent): void => {
    const ratio = ratioFromClientX(e.clientX)
    setDragRatio(ratio)
  }

  // 高密度 Ultracode 数字点阵动画颗粒 (更加密集的紫蓝闪烁星阵)
  const matrixDots = useMemo(() => {
    const dots: { id: number; opacity: number; animDelay: string; color: string }[] = []
    const colors = ['#c084fc', '#e879f9', '#818cf8', '#a855f7', '#ffffff']
    for (let i = 0; i < 120; i++) {
      dots.push({
        id: i,
        opacity: Math.random() * 0.85 + 0.15,
        animDelay: `${(Math.random() * 1.6).toFixed(2)}s`,
        color: colors[Math.floor(Math.random() * colors.length)]!
      })
    }
    return dots
  }, [])

  return (
    <div className="relative select-none" ref={ref}>
      {/* 触发按键 — 1:1 参考图右下角 胶囊样式 */}
      <button
        onClick={() => setOpen(!open)}
        className={`chip group flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-md transition-all duration-150 active:scale-95 border ${
          isUltracodeActive
            ? 'border-purple-500/40 bg-purple-950/30 text-purple-300 shadow-[0_0_14px_rgba(168,85,247,0.3)]'
            : 'border-border-subtle bg-bg-surface text-text-primary hover:border-border-hover'
        }`}
        title="Thinking Effort Controller"
      >
        <span className={isUltracodeActive ? 'font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-indigo-200 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]' : 'font-semibold'}>
          {activeLevel.label}
        </span>
        {isUltracodeActive && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
          </span>
        )}
      </button>

      {/* 下拉 Popover — 1:1 像素级复刻参考图中的 Effort 浮窗 */}
      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-2.5 w-[310px] rounded-[20px] border border-[#2c2c2e] bg-[#18181a] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.55)] animate-scale-in">
          {/* 1. Header 标题行：Effort High / Effort Ultracode */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Effort</span>
              <span
                className={
                  isUltracodeActive
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-indigo-200 font-extrabold tracking-normal drop-shadow-[0_0_12px_rgba(192,132,252,0.9)] animate-pulse'
                    : 'text-white font-bold'
                }
              >
                {activeLevel.label}
              </span>
            </h3>
            <button
              className="text-text-muted hover:text-white transition-colors"
              title="关于 Effort 思考强度"
            >
              <HelpCircle size={15} />
            </button>
          </div>

          {/* 2. Sub-header 标语：Faster <------------------> Smarter */}
          <div className="my-2.5 flex items-center justify-between text-xs font-semibold text-[#8e8e93]">
            <span>Faster</span>
            <span>Smarter</span>
          </div>

          {/* 3. 核心 Track 滑轨 & 胶囊手柄 Thumb */}
          <div className="relative my-2 px-1">
            <div
              ref={trackRef}
              onMouseDown={handleTrackMouseDown}
              className="relative flex h-8 cursor-pointer items-center group"
            >
              {/* 3.1 滑轨背景 Track: 普通深灰高亮 Fill OR Ultracode 动态矩阵点阵 (图二特效) */}
              {isUltracodeActive ? (
                /* 图二：Ultracode 特色闪烁数字矩阵点阵轨 (超级震撼版) */
                <div className="relative h-7 w-full overflow-hidden rounded-full border border-purple-500/50 bg-[#12081e] p-0.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.9)]">
                  <div className="grid h-full w-full grid-cols-20 grid-rows-3 gap-[1px]">
                    {matrixDots.map((dot) => (
                      <span
                        key={dot.id}
                        className="rounded-[1px] transition-opacity duration-300"
                        style={{
                          backgroundColor: dot.color,
                          opacity: dot.opacity,
                          animation: 'pulse 1.4s infinite ease-in-out',
                          animationDelay: dot.animDelay
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                /* 图一：普通深灰圆角粗滑轨 (带手柄左侧 Track 高亮进度条！) */
                <div className="relative h-7 w-full overflow-hidden rounded-full bg-[#242427] border border-[#38383c] shadow-inner">
                  {/* 手柄左侧 Track 高亮 Fill 进度条 (填充 Low/Medium/High 进度) */}
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#424248] via-[#888892] to-white transition-all duration-75 shadow-sm"
                    style={{ width: `${displayThumbPos}%` }}
                  />
                </div>
              )}

              {/* 3.2 5 个均匀刻度圆点 (Dots) */}
              <div className="absolute inset-0 flex items-center justify-between px-[14px] pointer-events-none z-10">
                {EFFORT_LEVELS.map((lvl, idx) => {
                  const isPassed = idx <= activeIndex
                  return (
                    <div
                      key={lvl.label + idx}
                      onMouseEnter={() => setHoverIndex(idx)}
                      onMouseLeave={() => setHoverIndex(null)}
                      className="relative flex items-center justify-center pointer-events-auto"
                    >
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          void updateSettings({ reasoningEffort: lvl.value })
                        }}
                        className={`h-1.5 w-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                          isPassed || idx === activeIndex
                            ? 'bg-white scale-125 shadow-md'
                            : 'bg-white/40 hover:bg-white hover:scale-125'
                        }`}
                      />

                      {/* Hover 提示黑胶囊 (图一中的 Ultracode 浮框 Tooltip) */}
                      {(hoverIndex === idx || (dragRatio !== null && activeIndex === idx)) && (
                        <div className="absolute bottom-full mb-2.5 z-30 whitespace-nowrap rounded-md bg-black/95 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-2xl border border-white/20 animate-fade-in pointer-events-none">
                          {lvl.label}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 3.3 白色垂直胶囊手柄 (Vertical Pill Thumb) */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 h-[22px] w-5 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.5)] border border-black/10 cursor-grab active:cursor-grabbing flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  dragRatio !== null ? 'scale-110 cursor-grabbing' : 'hover:scale-105'
                }`}
                style={{
                  left: `calc(${TRACK_PAD}px + (100% - ${TRACK_PAD * 2}px) * ${displayThumbPos / 100})`
                }}
              >
                {/* 如图二：当处于 Ultracode 档位时手柄内置 ↔ 双向手柄符号！ */}
                {isUltracodeActive ? (
                  <MoveHorizontal size={11} className="text-purple-950 font-bold" strokeWidth={3} />
                ) : (
                  <span className="h-2 w-0.5 rounded-full bg-neutral-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
