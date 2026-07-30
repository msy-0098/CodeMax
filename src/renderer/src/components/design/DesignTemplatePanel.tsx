import { useState, useMemo, useCallback, lazy, Suspense } from 'react'
import {
  Search, ArrowRight, Palette, ChevronDown, ChevronRight,
  Loader2, Eye, Download, Sparkles, Box, Layers,
  Check, Plus, X, Send,
  type LucideIcon
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { ComponentMeta, StyleEntry } from '../../../../shared/types'
import designSystemsCatalog from './design-systems-catalog.json'
import uiComponentsCatalog from './ui-components-catalog.json'

// 懒加载预览面板
const DesignPreviewPanel = lazy(() => import('./DesignPreviewPanel').then(m => ({ default: m.DesignPreviewPanel })))

// ─── 类型定义 ──────────────────────────────────────────

type PanelTab = 'components' | 'styles'

// ─── 数据 ──────────────────────────────────────────────

const STYLES = designSystemsCatalog as StyleEntry[]
const COMPONENTS = (uiComponentsCatalog as { components: ComponentMeta[] }).components

// 依赖图标映射
const DEP_LABELS: Record<string, string> = {
  'motion': 'Motion',
  'gsap': 'GSAP',
  'ogl': 'OGL',
  'three': 'Three.js',
  'matter-js': 'Matter',
  '@gsap/react': 'useGSAP',
}

// ─── 主组件 ────────────────────────────────────────────

export function DesignTemplatePanel(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<PanelTab>('components')

  return (
    <div className="glass flex h-full flex-col">
      {/* 顶部 Tab */}
      <div className="flex items-center gap-0.5 border-b border-border-subtle px-1.5 py-1.5 shrink-0">
        <CompactTab active={activeTab === 'components'} onClick={() => setActiveTab('components')} icon={Box} label="UI库" count={COMPONENTS.length} />
        <CompactTab active={activeTab === 'styles'} onClick={() => setActiveTab('styles')} icon={Palette} label="风格" count={STYLES.length} />
      </div>
      {activeTab === 'components' ? <ComponentsTab /> : <StylesTab />}
    </div>
  )
}

function CompactTab({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string; count: number }): React.ReactElement {
  return (
    <button onClick={onClick} className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${active ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated/50'}`}>
      <Icon size={12} />
      {label}
      <span className={`rounded-full px-1 text-[8px] ${active ? 'bg-accent/20' : 'bg-bg-elevated/80'}`}>{count}</span>
    </button>
  )
}

// ─── 组件库 Tab ────────────────────────────────────────

function ComponentsTab(): React.ReactElement {
  const toggleComponent = useStore((s) => s.toggleComponent)
  const selectedComponentIds = useStore((s) => s.selectedComponentIds)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [previewCompId, setPreviewCompId] = useState<string | null>(null)

  // 搜索过滤
  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = q
      ? COMPONENTS.filter(c =>
          c.id.toLowerCase().includes(q) ||
          c.nameCn.includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.categoryCn.includes(q) ||
          c.dependencies.some(d => d.toLowerCase().includes(q))
        )
      : COMPONENTS
    const groups: Record<string, ComponentMeta[]> = {}
    for (const c of filtered) {
      if (!groups[c.category]) groups[c.category] = []
      groups[c.category].push(c)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [searchQuery])

  const selected = COMPONENTS.find(c => c.id === selectedId)

  // 加载组件源码并预览
  const handlePreview = useCallback(async (comp: ComponentMeta) => {
    // 直接使用组件 ID 匹配预览图
    setPreviewCompId(comp.id)
  }, [])

  // 使用组件 — 加入输入框的组件选择
  const handleUse = useCallback((comp: ComponentMeta) => {
    toggleComponent(comp.id)
  }, [toggleComponent])

  // 预览模式
  if (previewCompId && selected) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Loader2 size={16} className="animate-spin text-accent" /></div>}>
          <DesignPreviewPanel
            componentId={previewCompId}
            componentName={selected?.nameCn}
            onClose={() => setPreviewCompId(null)}
          />
        </Suspense>
      </div>
    )
  }

  // 详情模式
  if (selected) {
    return (
      <ComponentDetail
        component={selected}
        onBack={() => setSelectedId(null)}
        onPreview={() => void handlePreview(selected)}
        onUse={() => handleUse(selected)}
        selectedComponentIds={selectedComponentIds}
      />
    )
  }

  // 列表模式
  const toggleCat = (cat: string) => setCollapsedCats(prev => {
    const n = new Set(prev)
    n.has(cat) ? n.delete(cat) : n.add(cat)
    return n
  })

  return (
    <>
      <div className="px-1.5 py-1.5 border-b border-border-subtle shrink-0">
        <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder={`搜索 ${COMPONENTS.length} 个组件...`} />
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1">
        {grouped.map(([category, comps]) => {
          const collapsed = collapsedCats.has(category)
          const catCn = comps[0]?.categoryCn || category
          return (
            <div key={category} className="mb-0.5">
              <button onClick={() => toggleCat(category)} className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left transition-colors hover:bg-bg-elevated/50">
                {collapsed ? <ChevronRight size={10} className="text-text-muted" /> : <ChevronDown size={10} className="text-text-muted" />}
                <span className="text-[10px] font-semibold text-text-secondary truncate">{catCn}</span>
                <span className="ml-auto rounded-full bg-bg-elevated/80 px-1 text-[8px] text-text-muted">{comps.length}</span>
              </button>
              {!collapsed && (
                <div className="grid grid-cols-1 gap-0.5 px-1 pb-1">
                  {comps.map(c => <ComponentRow key={c.id} component={c} onClick={() => setSelectedId(c.id)} />)}
                </div>
              )}
            </div>
          )
        })}
        {grouped.length === 0 && <EmptyState icon={Search} text="未找到匹配的组件" />}
      </div>
    </>
  )
}

// ─── 组件行 ────────────────────────────────────────────

function ComponentRow({ component, onClick }: { component: ComponentMeta; onClick: () => void }): React.ReactElement {
  const hasDeps = component.dependencies.length > 0
  return (
    <button onClick={onClick} title={component.nameCn} className="group flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/40 px-1.5 py-1 transition-all hover:border-accent/30 hover:bg-bg-elevated/70 active:scale-95">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/10">
        <Box size={10} className="text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-medium text-text-primary group-hover:text-accent transition-colors">{component.nameCn}</div>
        <div className="truncate text-[8px] text-text-muted">{component.id}</div>
      </div>
      {hasDeps && (
        <div className="flex shrink-0 items-center gap-0.5">
          {component.dependencies.slice(0, 2).map(d => (
            <span key={d} className="rounded bg-accent/10 px-1 text-[7px] text-accent/70">{DEP_LABELS[d]?.[0] || d[0]}</span>
          ))}
        </div>
      )}
    </button>
  )
}

// ─── 组件详情 ──────────────────────────────────────────

function ComponentDetail({ component, onBack, onPreview, onUse, selectedComponentIds }: {
  component: ComponentMeta
  onBack: () => void
  onPreview: () => void
  onUse: () => void
  selectedComponentIds: string[]
}): React.ReactElement {
  return (
    <div className="flex flex-col p-2 overflow-y-auto">
      <BackButton onBack={onBack} />
      {/* 标题 */}
      <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-accent/15 to-purple-500/15 p-2.5 ring-1 ring-white/5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated/80">
          <Box size={18} className="text-accent" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-text-primary">{component.nameCn}</h3>
          <p className="text-[9px] text-text-muted">{component.id} · {component.categoryCn}</p>
        </div>
      </div>

      {/* 依赖 */}
      {component.dependencies.length > 0 && (
        <Section title="依赖库">
          <div className="flex flex-wrap gap-1">
            {component.dependencies.map(d => (
              <span key={d} className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium text-accent">
                {DEP_LABELS[d] || d}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Props */}
      {component.props.length > 0 && (
        <Section title={`Props（${component.props.length} 个）`}>
          <div className="flex flex-wrap gap-1">
            {component.props.map(p => (
              <code key={p} className="rounded bg-bg-elevated/80 px-1 py-0.5 text-[9px] text-text-secondary">{p}</code>
            ))}
          </div>
        </Section>
      )}

      {/* 文件结构 */}
      <Section title="文件">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
            <span className="text-accent">{'</>'}</span>
            {component.files.jsx}
          </div>
          {component.files.css && (
            <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
              <Palette size={9} className="text-accent" />
              {component.files.css}
            </div>
          )}
        </div>
      </Section>

      {/* 预览按钮 */}
      <button
        onClick={onPreview}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/10 px-2 py-2 text-[11px] font-medium text-accent transition-all hover:bg-accent/20 active:scale-[0.98]"
      >
        <Eye size={12} />
        预览组件
      </button>

      {/* 加入/取消选择 */}
      <button
        onClick={onUse}
        className={`mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-all active:scale-[0.98] ${selectedComponentIds.includes(component.id) ? 'bg-accent/20 text-accent ring-1 ring-accent/40' : 'bg-bg-elevated/80 text-text-secondary hover:bg-bg-elevated'}`}
      >
        {selectedComponentIds.includes(component.id) ? <><Check size={12} /> 已加入选择</> : <><Plus size={12} /> 加入选择</>}
      </button>
    </div>
  )
}

// ─── 设计风格 Tab（保持不变） ──────────────────────────

function StylesTab(): React.ReactElement {
  const sendMessage = useStore((s) => s.sendMessage)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())

  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = q ? STYLES.filter(s => s.id.includes(q) || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)) : STYLES
    const groups: Record<string, StyleEntry[]> = {}
    for (const s of filtered) { if (!groups[s.category]) groups[s.category] = []; groups[s.category].push(s) }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [searchQuery])

  const handleUse = useCallback((s: StyleEntry) => {
    sendMessage(`请使用设计风格系统生成 UI。先用 design_style(action="get", style_id="${s.id}") 获取风格上下文（DESIGN.md 设计指南 + tokens.css CSS 变量），然后将 :root { ... } 粘贴到 HTML <style> 中，所有样式引用 var(--name)。\n\n请基于 ${s.name} 风格生成：[请描述你要生成的页面或组件]`)
  }, [sendMessage])

  const selected = STYLES.find(s => s.id === selectedId)

  if (selected) return <StyleDetail style={selected} onBack={() => setSelectedId(null)} onUse={() => handleUse(selected)} />

  const toggleCat = (cat: string) => setCollapsedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n })

  return (
    <>
      <div className="px-1.5 py-1.5 border-b border-border-subtle shrink-0">
        <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder={`搜索 ${STYLES.length} 个风格...`} />
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1">
        {grouped.map(([category, styles]) => {
          const collapsed = collapsedCats.has(category)
          return (
            <div key={category} className="mb-0.5">
              <button onClick={() => toggleCat(category)} className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left transition-colors hover:bg-bg-elevated/50">
                {collapsed ? <ChevronRight size={10} className="text-text-muted" /> : <ChevronDown size={10} className="text-text-muted" />}
                <span className="text-[10px] font-semibold text-text-secondary truncate">{category}</span>
                <span className="ml-auto rounded-full bg-bg-elevated/80 px-1 text-[8px] text-text-muted">{styles.length}</span>
              </button>
              {!collapsed && (
                <div className="grid grid-cols-1 gap-0.5 px-1 pb-1">
                  {styles.map(s => <StyleRow key={s.id} style={s} onClick={() => setSelectedId(s.id)} />)}
                </div>
              )}
            </div>
          )
        })}
        {grouped.length === 0 && <EmptyState icon={Search} text="未找到匹配的风格" />}
      </div>
    </>
  )
}

// ─── 风格行 ────────────────────────────────────────────

function StyleRow({ style, onClick }: { style: StyleEntry; onClick: () => void }): React.ReactElement {
  const accent = style.tokens.accent || '#666'
  const bg = style.tokens.bg || '#fff'
  const fg = style.tokens.fg || '#111'

  const isDark = useMemo(() => {
    const hex = bg.replace('#', '')
    if (hex.length < 6) return false
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
    return (r + g + b) / 3 < 128
  }, [bg])

  return (
    <button onClick={onClick} title={style.name} className="group flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/40 px-1.5 py-1 transition-all hover:border-accent/30 hover:bg-bg-elevated/70 active:scale-95">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded ring-1 ring-white/10" style={{ backgroundColor: bg }}>
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-text-primary group-hover:text-accent transition-colors">{style.name}</span>
      <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: fg, opacity: 0.4 }} />
    </button>
  )
}

// ─── 风格详情 ──────────────────────────────────────────

function StyleDetail({ style, onBack, onUse }: { style: StyleEntry; onBack: () => void; onUse: () => void }): React.ReactElement {
  const accent = style.tokens.accent || '#666', bg = style.tokens.bg || '#fff', fg = style.tokens.fg || '#111', surface = style.tokens.surface || '#f5f5f5'
  return (
    <div className="flex flex-col p-2 overflow-y-auto">
      <BackButton onBack={onBack} />
      <div className="rounded-lg overflow-hidden ring-1 ring-white/5">
        <div className="flex items-center gap-2 p-2.5" style={{ backgroundColor: bg, color: fg }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: surface }}>
            <Palette size={18} style={{ color: accent }} />
          </div>
          <div>
            <h3 className="text-xs font-semibold">{style.name}</h3>
            <p className="text-[9px] opacity-60">{style.category}</p>
          </div>
        </div>
      </div>
      <Section title="风格 ID"><code className="rounded bg-bg-elevated/80 px-1.5 py-0.5 text-[10px] text-accent">{style.id}</code></Section>
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
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[8px] font-semibold text-accent">{i + 1}</span>
              <span className="text-[10px] leading-relaxed text-text-secondary">{text}</span>
            </div>
          ))}
        </div>
      </Section>
      <UseButton onClick={onUse} label={`使用 ${style.name}`} />
    </div>
  )
}

// ─── 通用小组件 ────────────────────────────────────────

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }): React.ReactElement {
  return (
    <div className="relative">
      <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-md border border-border-subtle bg-bg-elevated/60 pl-7 pr-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none transition-colors" />
    </div>
  )
}

function BackButton({ onBack }: { onBack: () => void }): React.ReactElement {
  return <button onClick={onBack} className="mb-2 text-[10px] text-text-muted hover:text-text-secondary transition-colors">← 返回</button>
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mt-3">
      <h4 className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-text-muted">{title}</h4>
      {typeof children === 'string' ? <p className="text-[10px] text-text-secondary">{children}</p> : children}
    </div>
  )
}

function ColorSwatch({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/40 p-1">
      <div className="h-5 w-5 shrink-0 rounded ring-1 ring-white/10" style={{ backgroundColor: value }} />
      <div className="min-w-0">
        <div className="text-[9px] font-medium text-text-secondary">{label}</div>
        <div className="text-[8px] text-text-muted truncate">{value}</div>
      </div>
    </div>
  )
}

function UseButton({ onClick, label = '使用此模板' }: { onClick: () => void; label?: string }): React.ReactElement {
  return <button onClick={onClick} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-accent px-2 py-2 text-[11px] font-medium text-white transition-all hover:bg-accent-hover active:scale-[0.98]">{label}<ArrowRight size={12} /></button>
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }): React.ReactElement {
  return <div className="flex flex-col items-center justify-center py-8 text-center"><Icon size={20} className="text-text-muted mb-1.5 opacity-50" /><p className="text-[10px] text-text-muted">{text}</p></div>
}
