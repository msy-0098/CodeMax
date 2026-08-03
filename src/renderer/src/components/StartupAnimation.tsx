import { useEffect, useState, useMemo } from 'react'
import type { AppSettings, TransitionAnimationFile } from '../../../shared/types'
import './StartupAnimation.css'

/** 配色主题定义 */
const COLOR_THEMES = {
  rose:    { hueMin: 335, hueRange: 25,  satMin: 65, satRange: 20, lightMin: 48, lightRange: 22 },
  ocean:   { hueMin: 170, hueRange: 50,  satMin: 60, satRange: 25, lightMin: 45, lightRange: 20 },
  gold:    { hueMin: 40,  hueRange: 15,  satMin: 70, satRange: 25, lightMin: 50, lightRange: 20 },
  aurora:  { hueMin: 0,   hueRange: 360, satMin: 60, satRange: 30, lightMin: 50, lightRange: 20 }
} as const

type BurstStyle = 'rose' | 'fireworks' | 'confetti' | 'fade' | 'aura' | 'lightfall' | 'custom'
type ColorTheme = keyof typeof COLOR_THEMES

interface Particle {
  tx: number; ty: number; size: number; rotation: number; delay: number
  hue: number; sat: number; light: number
  // fireworks 额外
  ox?: number; oy?: number
  // confetti 额外
  cw?: number; ch?: number
  // aura 额外
  maxScale?: number
  auraDuration?: number
  // lightfall 额外
  streakH?: number
  curveX?: number
  // custom 额外
  customVars?: Record<string, string>
}

function rand(min: number, max: number): number { return min + Math.random() * (max - min) }

/** 生成粒子 — 根据 style 和 theme */
function generateParticles(count: number, style: BurstStyle, theme: ColorTheme, burstDuration: number): Particle[] {
  const t = COLOR_THEMES[theme]
  if (style === 'fade' || count === 0) return []

  // 光环（魔法光环）：同心圆环从中心扩张
  // 原版 MagicRings 配色：#fc42ff(hsl 300,100%,63%) → #42fcff(hsl 183,100%,63%)
  if (style === 'aura') {
    const ringCount = Math.min(count, 12)
    const ringDur = Math.round(burstDuration * 0.55)
    const stagger = Math.round((burstDuration - ringDur) / Math.max(ringCount - 1, 1) * 0.85)
    return Array.from({ length: ringCount }, (_, i) => {
      const ratio = ringCount > 1 ? i / (ringCount - 1) : 0
      return {
        tx: 0, ty: 0,
        size: 30 + i * 22,
        maxScale: 5 + i * 0.6,
        rotation: 0,
        delay: i * stagger,
        auraDuration: ringDur,
        hue: 300 - ratio * 117,
        sat: 100,
        light: 63,
      }
    })
  }

  // 光瀑：垂直光带从顶部下落
  // 原版 Lightfall 配色：#A6C8FF / #5227FF / #FF9FFC
  if (style === 'lightfall') {
    const lfColors = [
      { hue: 221, sat: 100, light: 83 }, // #A6C8FF
      { hue: 252, sat: 100, light: 58 }, // #5227FF
      { hue: 304, sat: 100, light: 80 }, // #FF9FFC
    ]
    return Array.from({ length: count }, (_, i) => {
      const c = lfColors[i % 3]
      const tx = rand(-window.innerWidth / 2 - 50, window.innerWidth / 2 + 50)
      // 弯曲量：离中心越远弯曲越大，方向与 tx 同号（向外散）
      const halfW = window.innerWidth / 2
      const normPos = halfW > 0 ? tx / halfW : 0
      const curveX = normPos * rand(14, 24)
      return {
        tx,
        ty: window.innerHeight + rand(100, 400),
        size: 0,
        rotation: 0,
        delay: rand(0, 800),
        hue: c.hue + rand(-4, 4),
        sat: c.sat,
        light: c.light,
        cw: rand(3, 10),
        streakH: rand(80, 300),
        curveX,
      }
    })
  }

  if (style === 'confetti') {
    // 彩纸：从顶部下落
    return Array.from({ length: count }, () => ({
      tx: rand(-window.innerWidth / 2 - 100, window.innerWidth / 2 + 100),
      ty: rand(window.innerHeight / 2 + 100, window.innerHeight / 2 + 400),
      size: 0,
      rotation: rand(-720, 720),
      delay: rand(0, 600),
      hue: rand(t.hueMin, t.hueMin + t.hueRange),
      sat: rand(t.satMin, t.satMin + t.satRange),
      light: rand(t.lightMin, t.lightMin + t.lightRange),
      cw: rand(6, 14),
      ch: rand(10, 24)
    }))
  }

  if (style === 'fireworks') {
    // 烟花：多个爆发点
    const burstCount = Math.max(3, Math.floor(count / 25))
    return Array.from({ length: count }, (_, i) => {
      const burstIdx = i % burstCount
      const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3)
      const distance = rand(80, 350)
      const burstAngle = (burstIdx / burstCount) * Math.PI * 2
      const ox = Math.cos(burstAngle) * rand(100, 300)
      const oy = Math.sin(burstAngle) * rand(80, 200)
      return {
        tx: ox + Math.cos(angle) * distance,
        ty: oy + Math.sin(angle) * distance,
        size: rand(3, 8),
        rotation: 0,
        delay: rand(0, 500),
        hue: rand(t.hueMin, t.hueMin + t.hueRange),
        sat: rand(t.satMin, t.satMin + t.satRange),
        light: rand(t.lightMin, t.lightMin + t.lightRange),
        ox, oy
      }
    })
  }

  // 默认：玫瑰花瓣
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + rand(-0.25, 0.25)
    const distance = rand(200, 650)
    return {
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance,
      size: rand(18, 50),
      rotation: rand(-360, 360),
      delay: rand(0, 450),
      hue: rand(t.hueMin, t.hueMin + t.hueRange),
      sat: rand(t.satMin, t.satMin + t.satRange),
      light: rand(t.lightMin, t.lightMin + t.lightRange),
    }
  })
}

/** 生成自定义转场粒子 — 从动画文件的 vars 模板渲染 */
function generateCustomParticles(count: number, anim: TransitionAnimationFile): Particle[] {
  const varEntries = Object.entries(anim.vars)
  return Array.from({ length: count }, (_, i) => {
    const customVars: Record<string, string> = {}
    for (const [key, range] of varEntries) {
      const [min, max, unit] = range
      const val = min + Math.random() * (max - min)
      customVars[key] = `${val}${unit}`
    }
    return {
      tx: 0, ty: 0, size: 0, rotation: 0,
      delay: varEntries.some(([k]) => k === '--delay')
        ? parseFloat(customVars['--delay']) || 0
        : Math.random() * 500,
      hue: 0, sat: 0, light: 0,
      customVars,
    }
  })
}

/** 解析自定义转场动画文件（从 JSON 字符串） */
function parseCustomAnimation(jsonStr?: string): TransitionAnimationFile | null {
  if (!jsonStr) return null
  try {
    const parsed = JSON.parse(jsonStr) as TransitionAnimationFile
    if (!parsed.particleClass || !parsed.css || !parsed.vars) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 启动加载动画 — 可配置的逐字描边 + 爆发转场
 *
 * 阶段 1 drawing：草书逐字描边→填充
 * 阶段 2 burst  ：草书溶解 + 粒子爆发 + 闪光 + 主界面组合显现
 */
export function StartupAnimation({
  onComplete,
  children,
  config
}: {
  onComplete: () => void
  children?: React.ReactNode
  config?: Pick<AppSettings,
    'startupText' | 'startupTextSize' | 'startupStrokeDuration' | 'startupFontFamily' |
    'burstTransitionEnabled' | 'burstTransitionStyle' |
    'burstParticleCount' | 'burstDuration' | 'burstColorTheme' |
    'customTransitionAnimation'
  >
}): React.ReactElement {
  const text = config?.startupText ?? 'CodeMax'
  const fontSize = config?.startupTextSize ?? 76
  const strokeDuration = config?.startupStrokeDuration ?? 460
  const fontFamily = config?.startupFontFamily ?? "'Dancing Script', cursive"
  const burstEnabled = config?.burstTransitionEnabled ?? true
  const burstStyle = (config?.burstTransitionStyle ?? 'rose') as BurstStyle
  const particleCount = config?.burstParticleCount ?? 120
  const burstDuration = config?.burstDuration ?? 2500
  const colorTheme = (config?.burstColorTheme ?? 'rose') as ColorTheme
  const customAnimJson = config?.customTransitionAnimation

  const STAGGER = Math.round(strokeDuration * 0.78)
  const FILL_DURATION = Math.round(strokeDuration * 0.87)
  const TAIL_HOLD = Math.round(strokeDuration * 1.09)
  const chars = text.split('')
  const totalDraw = (chars.length - 1) * STAGGER + strokeDuration + FILL_DURATION + TAIL_HOLD

  const [phase, setPhase] = useState<'drawing' | 'burst'>('drawing')

  // 解析自定义动画
  const customAnim = useMemo(() => parseCustomAnimation(customAnimJson), [customAnimJson])

  // 注入自定义 CSS（仅 custom 模式且有动画文件时）
  useEffect(() => {
    if (burstStyle === 'custom' && customAnim) {
      const id = `custom-transition-css`
      let el = document.getElementById(id) as HTMLStyleElement | null
      if (!el) {
        el = document.createElement('style')
        el.id = id
        document.head.appendChild(el)
      }
      el.textContent = customAnim.css
      return () => {
        if (el && el.parentElement) el.parentElement.removeChild(el)
      }
    }
  }, [burstStyle, customAnim])

  // 生成粒子
  const particles = useMemo(() => {
    if (!burstEnabled) return []
    if (burstStyle === 'custom' && customAnim) {
      return generateCustomParticles(particleCount, customAnim)
    }
    return generateParticles(particleCount, burstStyle, colorTheme, burstDuration)
  }, [burstEnabled, particleCount, burstStyle, colorTheme, burstDuration, customAnim])

  useEffect(() => {
    if (burstEnabled) {
      const t1 = setTimeout(() => setPhase('burst'), totalDraw)
      const t2 = setTimeout(onComplete, totalDraw + burstDuration)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    } else {
      // 无爆发转场：描边完成后短暂等待再淡入
      const t1 = setTimeout(() => setPhase('burst'), totalDraw)
      const t2 = setTimeout(onComplete, totalDraw + 800)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [totalDraw, burstDuration, burstEnabled, onComplete])

  const showBurst = phase === 'burst'
  const dissolveClass = showBurst
    ? (burstEnabled ? 'animate-calligraphy-dissolve' : 'animate-calligraphy-fade')
    : ''

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ '--burst-duration': `${burstDuration}ms` } as React.CSSProperties}
    >
      {/* ── Layer 1: 主界面 — burst 期间从微缩组合显现 ── */}
      <div className={`absolute inset-0 ${showBurst ? 'animate-interface-assemble' : 'opacity-0'}`}>
        {children}
      </div>

      {/* ── Layer 2: 草书 SVG ── */}
      <div
        className={`absolute inset-0 flex items-center justify-center ${dissolveClass}`}
        style={{ willChange: showBurst ? 'opacity, transform, filter' : undefined }}
      >
        <svg
          viewBox="0 0 440 140"
          className="w-[min(78vw,640px)] h-auto"
          style={{ filter: 'drop-shadow(0 0 20px var(--glow-color))' }}
        >
          <defs>
            <linearGradient id="suGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-DEFAULT)" />
              <stop offset="55%" stopColor="var(--accent-hover)" />
              <stop offset="100%" stopColor="var(--orb-3, #a882ff)" />
            </linearGradient>
          </defs>

          {chars.map((ch, i) => (
            <text
              key={i}
              x={15 + i * 36}
              y={105}
              fontFamily={fontFamily}
              fontSize={fontSize}
              fontWeight="700"
              fill="url(#suGrad)"
              fillOpacity="0"
              stroke="url(#suGrad)"
              strokeWidth="0.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1}
              style={{
                willChange: 'stroke-dashoffset, fill-opacity',
                animation:
                  `startupStroke ${strokeDuration}ms linear ${i * STAGGER}ms forwards,` +
                  `startupFill ${FILL_DURATION}ms ease-out ${i * STAGGER + strokeDuration - 80}ms forwards`,
              }}
            >
              {ch}
            </text>
          ))}
        </svg>
      </div>

      {/* ── Layer 3: 中心闪光（仅爆发模式） ── */}
      {showBurst && burstEnabled && (
        <div className="absolute inset-0 pointer-events-none animate-burst-flash" />
      )}

      {/* ── Layer 4: 粒子爆发 ── */}
      {showBurst && burstEnabled && burstStyle !== 'fade' && particles.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {burstStyle === 'rose' && particles.map((p, i) => (
            <div
              key={i}
              className="burst-particle"
              style={{
                '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
                '--size': `${p.size}px`, '--rot': `${p.rotation}deg`,
                '--delay': `${p.delay}ms`,
                '--hue': `${p.hue}`, '--sat': `${p.sat}%`, '--light': `${p.light}%`,
              } as React.CSSProperties}
            />
          ))}
          {burstStyle === 'fireworks' && particles.map((p, i) => (
            <div
              key={i}
              className="burst-firework"
              style={{
                '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
                '--ox': `${p.ox}px`, '--oy': `${p.oy}px`,
                '--size': `${p.size}px`,
                '--delay': `${p.delay}ms`,
                '--hue': `${p.hue}`, '--sat': `${p.sat}%`, '--light': `${p.light}%`,
              } as React.CSSProperties}
            />
          ))}
          {burstStyle === 'confetti' && particles.map((p, i) => (
            <div
              key={i}
              className="burst-confetti"
              style={{
                '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
                '--cw': `${p.cw}px`, '--ch': `${p.ch}px`,
                '--rot': `${p.rotation}deg`,
                '--delay': `${p.delay}ms`,
                '--hue': `${p.hue}`, '--sat': `${p.sat}%`, '--light': `${p.light}%`,
              } as React.CSSProperties}
            />
          ))}
          {burstStyle === 'aura' && particles.map((p, i) => (
            <div
              key={i}
              className="burst-aura"
              style={{
                '--size': `${p.size}px`,
                '--max-scale': `${p.maxScale}`,
                '--delay': `${p.delay}ms`,
                '--aura-duration': `${p.auraDuration}ms`,
                '--hue': `${p.hue}`, '--sat': `${p.sat}%`, '--light': `${p.light}%`,
              } as React.CSSProperties}
            />
          ))}
          {burstStyle === 'lightfall' && particles.map((p, i) => (
            <div
              key={i}
              className="burst-lightfall"
              style={{
                '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
                '--cw': `${p.cw}px`, '--streak-h': `${p.streakH}px`,
                '--curve-x': `${p.curveX}deg`,
                '--delay': `${p.delay}ms`,
                '--hue': `${p.hue}`, '--sat': `${p.sat}%`, '--light': `${p.light}%`,
              } as React.CSSProperties}
            />
          ))}
          {burstStyle === 'custom' && customAnim && particles.map((p, i) => (
            <div
              key={i}
              className={customAnim.particleClass}
              style={p.customVars as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  )
}
