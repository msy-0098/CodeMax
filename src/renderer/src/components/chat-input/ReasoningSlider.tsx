import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ReasoningEffort } from '../../../../shared/types'

/** 思考强度调节器 — Claude Code 风格滑块：拖拽跟手、松手吸附、点击跳档 */
const EFFORT_LEVELS: { value: ReasoningEffort; label: string; desc: string }[] = [
  { value: 'off', label: 'Off', desc: '不输出思维链' },
  { value: 'high', label: 'High', desc: '深度推理' },
  { value: 'max', label: 'Max', desc: '极致推理' },
  { value: 'ultra', label: 'Ultra', desc: '工程范式 + 监督审查' }
]

/** 轨道左右内边距（px），保证手柄在两端不溢出 */
const TRACK_PAD = 14

export function ReasoningSlider(): React.ReactElement {
  const effort = useStore((s) => s.settings?.reasoningEffort ?? 'high')
  const updateSettings = useStore((s) => s.updateSettings)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  // 拖拽中的连续位置（0..1），null 表示未拖拽
  const [dragRatio, setDragRatio] = useState<number | null>(null)

  const currentIndex = EFFORT_LEVELS.findIndex((l) => l.value === effort)
  const posPercent = (currentIndex / (EFFORT_LEVELS.length - 1)) * 100
  const isUltra = effort === 'ultra'
  const isMax = effort === 'max'

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // 鼠标位置 → 轨道内连续比例（0..1）
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

  // 拖拽：实时跟手，松手吸附到最近档位并保存
  useEffect(() => {
    if (dragRatio === null) return
    const onMove = (e: MouseEvent): void => setDragRatio(ratioFromClientX(e.clientX))
    const onUp = (e: MouseEvent): void => {
      const idx = ratioToIndex(ratioFromClientX(e.clientX))
      setDragRatio(null)
      const next = EFFORT_LEVELS[idx]!.value
      if (next !== useStore.getState().settings?.reasoningEffort) {
        void updateSettings({ reasoningEffort: next })
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [dragRatio, ratioFromClientX, ratioToIndex, updateSettings])

  // 展示位置：拖拽时实时跟手，否则吸附到当前档位
  const thumbPos = dragRatio !== null ? dragRatio * 100 : posPercent
  // 拖拽预览档位（用于高亮标签/说明）
  const previewIndex = dragRatio !== null ? ratioToIndex(dragRatio) : currentIndex
  const previewEffort = EFFORT_LEVELS[previewIndex]!.value
  const showCrystal = isUltra || previewEffort === 'ultra'
  const showMaxFill = isMax || previewEffort === 'max'

  const fillClass = showCrystal ? 'ultra-track' : showMaxFill ? 'max-track' : 'bg-accent'
  const thumbClass = showCrystal
    ? 'ultra-thumb'
    : showMaxFill
      ? 'max-thumb'
      : previewEffort === 'high'
        ? 'bg-accent border border-white/25 shadow-[0_0_8px_color-mix(in_srgb,var(--theme-color)_40%,transparent)]'
        : 'bg-border border border-border-subtle'

  const currentLabel = EFFORT_LEVELS[currentIndex]!.label

  return (
    <div className="relative" ref={ref}>
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className={`chip flex cursor-pointer items-center gap-1 px-2 py-1 text-[11px] transition-all duration-200 active:scale-95 ${
          open
            ? 'border-accent/40 text-accent bg-accent/10'
            : isUltra
              ? 'ultra-chip'
              : isMax
                ? 'max-chip'
                : effort === 'high'
                  ? 'text-accent border-accent/25 bg-accent/10'
                  : 'text-text-muted hover:text-text-secondary'
        }`}
        title="思考强度"
      >
        <Zap size={11} className={effort !== 'off' ? '' : 'opacity-50'} />
        <span>{currentLabel}</span>
      </button>

      {/* 向上展开的滑块面板 */}
      {open && (
        <div className="panel absolute bottom-full right-0 mb-2 w-[300px] animate-fade-scale">
          <div className="panel__header">
            <span>思考强度</span>
            <span className="text-[10px] text-text-muted">拖拽或点击档位切换</span>
          </div>

          <div className="px-4 pt-4 pb-3">
            {/* 横向轨道 */}
            <div
              ref={trackRef}
              className="relative h-[26px] cursor-pointer select-none px-3.5"
              onMouseDown={(e) => {
                e.preventDefault()
                setDragRatio(ratioFromClientX(e.clientX))
              }}
            >
              {/* 细条轨道（居中） */}
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2">
                {/* 轨道底色 */}
                <div className="absolute inset-0 rounded-full border border-border-subtle bg-bg-elevated" />

                {/* 已选中填充 */}
                {thumbPos > 0 && (
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${fillClass}`}
                    style={{
                      width: `${Math.max(thumbPos, 4)}%`,
                      transition: dragRatio !== null ? 'none' : 'width 0.2s ease-out'
                    }}
                  />
                )}
              </div>

              {/* 刻度档位圆点 */}
              {EFFORT_LEVELS.map((level, i) => {
                const isFilled = i <= previewIndex
                const leftPercent = (i / (EFFORT_LEVELS.length - 1)) * 100
                return (
                  <span
                    key={level.value}
                    className="pointer-events-none absolute top-1/2"
                    style={{ left: `${leftPercent}%`, transform: 'translate(-50%, -50%)' }}
                  >
                    <span className={`block rounded-full ${
                      i === previewIndex
                        ? 'h-1.5 w-1.5 bg-white/90'
                        : isFilled
                          ? 'h-1 w-1 bg-white/60'
                          : 'h-1 w-1 bg-border'
                    }`} />
                  </span>
                )
              })}

              {/* 可拖拽手柄 — 圆角方块，拖拽时实时跟手 */}
              <div
                className="absolute top-1/2 z-10 cursor-grab active:cursor-grabbing"
                style={{
                  left: `${thumbPos}%`,
                  transform: 'translate(-50%, -50%)',
                  transition: dragRatio !== null ? 'none' : 'left 0.2s ease-out'
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setDragRatio(ratioFromClientX(e.clientX))
                }}
              >
                <span className={`block transition-all duration-200 ${thumbClass} ${
                  previewEffort === 'off' ? 'h-3.5 w-3.5 rounded-md' : 'h-4 w-4 rounded-md'
                }`} />
              </div>
            </div>

            {/* 档位标签 */}
            <div className="relative mt-1.5" style={{ height: '16px' }}>
              {EFFORT_LEVELS.map((level, i) => {
                const isCurrent = i === previewIndex
                const leftPercent = (i / (EFFORT_LEVELS.length - 1)) * 100
                return (
                  <button
                    key={level.value}
                    onClick={() => void updateSettings({ reasoningEffort: level.value })}
                    className="absolute top-0 text-[10px] font-medium transition-colors"
                    style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                  >
                    <span
                      className={
                        isCurrent
                          ? level.value === 'ultra'
                            ? 'text-purple-300'
                            : level.value === 'max'
                              ? 'text-orange-400'
                              : 'text-accent'
                          : 'text-text-muted hover:text-text-secondary'
                      }
                    >
                      {level.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 当前档位说明 */}
          <p className="mx-4 mb-3 border-t border-border-subtle pt-2 text-[10px] leading-relaxed text-text-muted">
            {EFFORT_LEVELS[previewIndex]!.desc}
          </p>
        </div>
      )}
    </div>
  )
}
