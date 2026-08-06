import { Box, Check, Eye, Palette, Plus } from 'lucide-react'
import type { ComponentMeta, StyleEntry } from '@shared/types'
import { BackButton, ColorSwatch, Section, UseButton } from './shared'

// ─── 组件详情 ──────────────────────────────────────────

export function ComponentDetail({ component, onBack, onPreview, onUse, selectedComponentIds }: {
  component: ComponentMeta
  onBack: () => void
  onPreview: () => void
  onUse: () => void
  selectedComponentIds: string[]
}): React.ReactElement {
  const selected = selectedComponentIds.includes(component.id)
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      <BackButton onBack={onBack} />
      {/* 标题 */}
      <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-bg-elevated/50 p-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
          <Box size={18} className="text-accent" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-text-primary">{component.nameCn}</h3>
          <p className="text-[10px] text-text-muted truncate">{component.id} · {component.categoryCn}</p>
        </div>
      </div>

      {component.dependencies.length > 0 && (
        <Section title="依赖库">
          <div className="flex flex-wrap gap-1">
            {component.dependencies.map((d) => (
              <span key={d} className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">{d}</span>
            ))}
          </div>
        </Section>
      )}

      {component.props.length > 0 && (
        <Section title={`Props（${component.props.length} 个）`}>
          <div className="flex flex-wrap gap-1">
            {component.props.map((p) => (
              <code key={p} className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-secondary">{p}</code>
            ))}
          </div>
        </Section>
      )}

      <Section title="文件">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="font-mono text-accent">{'</>'}</span>
            {component.files.jsx}
          </div>
          {component.files.css && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <Palette size={11} className="text-accent" />
              {component.files.css}
            </div>
          )}
        </div>
      </Section>

      <button
        onClick={onPreview}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/10 px-2 py-2 text-[11px] font-medium text-accent transition-all hover:bg-accent/20 active:scale-[0.98]"
      >
        <Eye size={12} />
        预览组件
      </button>

      <button
        onClick={onUse}
        className={`mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-all active:scale-[0.98] ${
          selected ? 'bg-accent/20 text-accent ring-1 ring-accent/40' : 'bg-bg-elevated text-text-secondary hover:bg-bg-hover'
        }`}
      >
        {selected ? <><Check size={12} /> 已加入选择</> : <><Plus size={12} /> 加入选择</>}
      </button>
    </div>
  )
}

// ─── 风格详情 ──────────────────────────────────────────

export function StyleDetail({ style, onBack, onUse }: { style: StyleEntry; onBack: () => void; onUse: () => void }): React.ReactElement {
  const accent = style.tokens.accent || '#666'
  const bg = style.tokens.bg || '#fff'
  const fg = style.tokens.fg || '#111'
  const surface = style.tokens.surface || '#f5f5f5'
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      <BackButton onBack={onBack} />
      {/* 风格色卡 */}
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2.5 p-2.5" style={{ backgroundColor: bg, color: fg }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: surface }}>
            <Palette size={18} style={{ color: accent }} />
          </div>
          <div>
            <h3 className="text-xs font-semibold">{style.name}</h3>
            <p className="text-[10px] opacity-60">{style.category}</p>
          </div>
        </div>
      </div>

      <Section title="风格 ID">
        <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] text-accent">{style.id}</code>
      </Section>

      <Section title="核心色板">
        <div className="grid grid-cols-1 gap-1">
          <ColorSwatch label="Accent" value={accent} />
          <ColorSwatch label="Background" value={bg} />
          <ColorSwatch label="Foreground" value={fg} />
          <ColorSwatch label="Surface" value={surface} />
        </div>
      </Section>

      <Section title="使用方法">
        <div className="space-y-1">
          {['调用 design_style 获取 tokens.css', '粘贴 :root { ... } 到 <style>', '用 var(--accent) 等变量'].map((text, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[9px] font-semibold text-accent">{i + 1}</span>
              <span className="text-[11px] leading-relaxed text-text-secondary">{text}</span>
            </div>
          ))}
        </div>
      </Section>

      <UseButton onClick={onUse} label={`使用 ${style.name}`} />
    </div>
  )
}
