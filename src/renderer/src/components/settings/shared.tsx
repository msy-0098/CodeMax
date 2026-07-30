import { useState } from 'react'
import { ChevronDown, Minus, Plus, ExternalLink } from 'lucide-react'
import type { AppSettings } from '../../../../shared/types'

// ---------- 共享类型 ----------

export type TabId = 'api' | 'model' | 'agent' | 'tools' | 'appearance' | 'about'

export type TestState = 'idle' | 'testing' | 'success' | 'error'

// ---------- 共享常量 ----------

export const FALLBACK_SETTINGS: AppSettings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-v4-pro',
  thinkingMode: true,
  reasoningEffort: 'high',
  temperature: 0.7,
  maxTokens: 393216,
  fontSize: 'md',
  customPrompt: '',
  themeColor: '#6366f1',
  theme: 'dark',
  subAgentModel: 'deepseek-v4-flash',
  subAgentMaxTokens: 393216,
  subAgentTemperature: 0.7,
  subAgentTimeout: 60,
  subAgentReasoningEffort: 'high',
  orchestratorEnforce: true,
  mainAgentCustomPrompt: '',
  mainAgentExpertId: undefined,
  maxToolRounds: 30,
  maxContextChars: 300000,
  maxToolResultChars: 16000,
  contextRecentKeep: 8,
  contextSnippedKeep: 200,
  contextPrunedKeep: 80,
  terminalTimeout: 60,
  codeExecTimeout: 60,
  terminalOutputLimit: 50000,
  browserHeadless: true,
  browserIdleTimeout: 5,
  browserViewportWidth: 1280,
  browserViewportHeight: 800,
  defaultSearchEngine: 'bing',
  searchResultsCount: 5,
  webFetchMaxLength: 10000,
  webCacheEnabled: true,
  webCacheMaxSizeMB: 100,
  defaultAutoModeLevel: 'off',
  defaultNetworkSearchOn: false,
  checkpointEnabled: true,
  helperCommandTimeout: 30,
  maxCapturedRequests: 500,
  mcpConnectTimeout: 30,
  startupAnimationEnabled: true,
  startupText: 'ximo-Agent',
  startupTextSize: 76,
  startupStrokeDuration: 460,
  startupFontFamily: "'Dancing Script', cursive",
  burstTransitionEnabled: true,
  burstTransitionStyle: 'rose',
  burstParticleCount: 120,
  burstDuration: 2500,
  burstColorTheme: 'rose',
  customTransitionAnimation: undefined
}

export const THEME_PRESETS: { name: string; value: string }[] = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Orange', value: '#f97316' }
]

// ---------- 通用子组件 ----------

export function SectionTitle({ title, desc }: { title: string; desc?: string }): React.ReactElement {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {desc && <p className="mt-0.5 text-xs text-text-muted">{desc}</p>}
    </div>
  )
}

export function Divider(): React.ReactElement {
  return <div className="border-t border-border-subtle" />
}

export function NumberInputRow({
  icon,
  label,
  desc,
  value,
  min,
  max,
  step,
  unit,
  onChange
}: {
  icon: React.ReactNode
  label: string
  desc: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}): React.ReactElement {
  const clamp = (v: number): number => Math.min(max, Math.max(min, v))
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-text-muted shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{label}</p>
          <p className="text-xs text-text-muted truncate">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onChange(clamp(value - step))}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-elevated text-text-secondary hover:border-accent hover:text-accent transition-colors"
        >
          <Minus size={13} />
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseInt(e.target.value)
            if (!isNaN(v)) onChange(clamp(v))
          }}
          className="w-20 rounded-md border border-border bg-bg-elevated px-2 py-1 text-center text-sm font-mono text-text-primary focus:border-accent focus:outline-none"
        />
        <span className="text-xs text-text-muted w-8">{unit}</span>
        <button
          onClick={() => onChange(clamp(value + step))}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-elevated text-text-secondary hover:border-accent hover:text-accent transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}

export function CollapsibleSection({
  icon,
  title,
  desc,
  defaultOpen = false,
  children
}: {
  icon: React.ReactNode
  title: string
  desc?: string
  defaultOpen?: boolean
  children: React.ReactNode
}): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="ios-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-3.5 text-left transition-colors hover:bg-bg-elevated/50"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-accent">{icon}</span>
          <div>
            <p className="text-sm font-medium text-text-primary">{title}</p>
            {desc && <p className="text-xs text-text-muted">{desc}</p>}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-border-subtle px-3.5 py-1">
          {children}
        </div>
      )}
    </div>
  )
}

export function ModelCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
  specs,
  desc
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  specs: string[]
  desc: string
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`ios-card p-4 text-left transition-all ${
        active
          ? 'border-accent shadow-glow'
          : 'hover:border-border-hover'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={active ? 'text-accent' : 'text-text-muted'}>{icon}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            active ? 'bg-accent/20 text-accent' : 'bg-bg-base text-text-muted'
          }`}
        >
          {subtitle}
        </span>
      </div>
      <p className={`text-base font-bold ${active ? 'text-accent' : 'text-text-primary'}`}>
        {title}
      </p>
      <div className="mt-1.5 space-y-0.5">
        {specs.map((s) => (
          <p key={s} className="text-[11px] text-text-muted">
            {s}
          </p>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">{desc}</p>
    </button>
  )
}

export function ToggleRow({
  icon,
  label,
  desc,
  active,
  onToggle,
  activeText,
  inactiveText
}: {
  icon: React.ReactNode
  label: string
  desc: string
  active: boolean
  onToggle: () => void
  activeText: string
  inactiveText: string
}): React.ReactElement {
  return (
    <div
      className={`ios-card p-3.5 transition-all ${
        active ? 'border-accent/40' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={active ? 'text-accent' : 'text-text-muted'}>{icon}</span>
          <div>
            <p className="text-sm font-medium text-text-primary">{label}</p>
            <p className="text-xs text-text-muted">{active ? activeText : inactiveText}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`relative h-6 w-10 rounded-full transition-colors duration-300 ease-out-quart ${
            active ? 'bg-accent shadow-glow' : 'bg-border'
          }`}
        >
          <div
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ease-out-quart ${
              active ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-xs text-text-muted">{desc}</p>
    </div>
  )
}

export function DataRow({
  icon,
  title,
  desc,
  children,
  danger
}: {
  icon: React.ReactNode
  title: string
  desc: string
  children: React.ReactNode
  danger?: boolean
}): React.ReactElement {
  return (
    <div className="ios-card flex items-center justify-between p-3.5">
      <div className="flex items-start gap-2.5">
        <span className={danger ? 'text-red-400' : 'text-text-muted'}>{icon}</span>
        <div>
          <p className={`text-sm font-medium ${danger ? 'text-red-400' : 'text-text-primary'}`}>
            {title}
          </p>
          <p className="text-xs text-text-muted">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export function InfoCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="ios-card p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-text-primary">{value}</p>
    </div>
  )
}

export function FeatureRow({
  icon,
  title,
  desc
}: {
  icon: string
  title: string
  desc: string
}): React.ReactElement {
  return (
    <div className="ios-card flex items-center gap-3 p-3">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-muted">{desc}</p>
      </div>
    </div>
  )
}

export function LinkRow({ href, label }: { href: string; label: string }): React.ReactElement {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ios-card flex items-center justify-between px-3 py-2.5 transition-all hover:border-accent/40"
    >
      <span className="text-sm text-text-secondary">{label}</span>
      <ExternalLink size={14} className="text-text-muted" />
    </a>
  )
}
