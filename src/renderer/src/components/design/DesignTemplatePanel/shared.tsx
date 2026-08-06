import { ArrowRight, Search, type LucideIcon } from 'lucide-react'

// 依赖图标映射
export const DEP_LABELS: Record<string, string> = {
  'motion': 'Motion',
  'gsap': 'GSAP',
  'ogl': 'OGL',
  'three': 'Three.js',
  'matter-js': 'Matter',
  '@gsap/react': 'useGSAP',
}

/** 搜索框 */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }): React.ReactElement {
  return (
    <div className="relative">
      <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border-subtle bg-bg-elevated/60 py-1.5 pl-7 pr-2 text-[11px] text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none transition-colors"
      />
    </div>
  )
}

/** 返回按钮 */
export function BackButton({ onBack }: { onBack: () => void }): React.ReactElement {
  return <button onClick={onBack} className="mb-2 self-start text-[11px] text-text-muted hover:text-text-secondary transition-colors">← 返回</button>
}

/** 详情区块标题 */
export function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mt-3">
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</h4>
      {typeof children === 'string' ? <p className="text-[11px] text-text-secondary">{children}</p> : children}
    </div>
  )
}

/** 色板色块 */
export function ColorSwatch({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-surface/60 p-1.5">
      <div className="h-5 w-5 shrink-0 rounded ring-1 ring-white/10" style={{ backgroundColor: value }} />
      <div className="min-w-0">
        <div className="text-[10px] font-medium text-text-secondary">{label}</div>
        <div className="text-[9px] text-text-muted truncate">{value}</div>
      </div>
    </div>
  )
}

/** 主操作按钮 */
export function UseButton({ onClick, label = '使用此模板' }: { onClick: () => void; label?: string }): React.ReactElement {
  return (
    <button onClick={onClick} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-accent px-2 py-2 text-[11px] font-medium text-white transition-all hover:bg-accent-hover active:scale-[0.98]">
      {label}
      <ArrowRight size={12} />
    </button>
  )
}

/** 空状态 */
export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Icon size={20} className="text-text-muted mb-2 opacity-50" />
      <p className="text-[11px] text-text-muted">{text}</p>
    </div>
  )
}
