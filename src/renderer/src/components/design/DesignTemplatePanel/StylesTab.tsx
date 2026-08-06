import { useState, useMemo, useCallback } from 'react'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import type { StyleEntry } from '@shared/types'
import designSystemsCatalog from '../design-systems-catalog.json'
import { StyleDetail } from './Detail'
import { EmptyState, SearchBox } from './shared'

const STYLES = designSystemsCatalog as StyleEntry[]

/** 风格系统 Tab */
export function StylesTab(): React.ReactElement {
  const sendMessage = useStore((s) => s.sendMessage)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())

  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = q
      ? STYLES.filter((s) => s.id.includes(q) || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
      : STYLES
    const groups: Record<string, StyleEntry[]> = {}
    for (const s of filtered) {
      if (!groups[s.category]) groups[s.category] = []
      groups[s.category].push(s)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [searchQuery])

  const handleUse = useCallback((s: StyleEntry) => {
    sendMessage(`请使用设计风格系统生成 UI。先用 design_style(action="get", style_id="${s.id}") 获取风格上下文（DESIGN.md 设计指南 + tokens.css CSS 变量），然后将 :root { ... } 粘贴到 HTML <style> 中，所有样式引用 var(--name)。\n\n请基于 ${s.name} 风格生成：[请描述你要生成的页面或组件]`)
  }, [sendMessage])

  const selected = STYLES.find((s) => s.id === selectedId)

  if (selected) {
    return <StyleDetail style={selected} onBack={() => setSelectedId(null)} onUse={() => handleUse(selected)} />
  }

  const toggleCat = (cat: string) => setCollapsedCats((prev) => {
    const n = new Set(prev)
    n.has(cat) ? n.delete(cat) : n.add(cat)
    return n
  })

  return (
    <>
      <div className="shrink-0 border-b border-border-subtle px-2 py-1.5">
        <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder={`搜索 ${STYLES.length} 个风格...`} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1.5">
        {grouped.map(([category, styles]) => {
          const collapsed = collapsedCats.has(category)
          return (
            <div key={category} className="mb-1">
              <button
                onClick={() => toggleCat(category)}
                className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-bg-hover"
              >
                {collapsed ? <ChevronRight size={11} className="text-text-muted" /> : <ChevronDown size={11} className="text-text-muted" />}
                <span className="truncate text-[11px] font-semibold text-text-secondary">{category}</span>
                <span className="ml-auto rounded-full bg-bg-elevated px-1.5 text-[9px] text-text-muted">{styles.length}</span>
              </button>
              {!collapsed && (
                <div className="grid grid-cols-1 gap-1 px-0.5 pb-1">
                  {styles.map((s) => <StyleRow key={s.id} style={s} onClick={() => setSelectedId(s.id)} />)}
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

  return (
    <button
      onClick={onClick}
      title={style.name}
      className="group flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface/60 px-2 py-1.5 text-left transition-all hover:border-accent/35 hover:bg-bg-surface active:scale-[0.99]"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-white/10" style={{ backgroundColor: bg }}>
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-text-primary transition-colors group-hover:text-accent">{style.name}</span>
      <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: fg, opacity: 0.4 }} />
    </button>
  )
}
