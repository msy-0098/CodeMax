import { useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { Search, Box, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useStore } from '../../../store/useStore'
import type { ComponentMeta } from '@shared/types'
import uiComponentsCatalog from '../ui-components-catalog.json'
import { ComponentDetail } from './Detail'
import { DEP_LABELS, EmptyState, SearchBox } from './shared'

const DesignPreviewPanel = lazy(() => import('../DesignPreviewPanel').then((m) => ({ default: m.DesignPreviewPanel })))

const COMPONENTS = (uiComponentsCatalog as { components: ComponentMeta[] }).components

/** 组件库 Tab — 列表 / 详情 / 预览 三态切换 */
export function ComponentsTab(): React.ReactElement {
  const toggleComponent = useStore((s) => s.toggleComponent)
  const selectedComponentIds = useStore((s) => s.selectedComponentIds)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [previewCompId, setPreviewCompId] = useState<string | null>(null)

  // 搜索过滤 + 按分类分组
  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = q
      ? COMPONENTS.filter((c) =>
          c.id.toLowerCase().includes(q) ||
          c.nameCn.includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.categoryCn.includes(q) ||
          c.dependencies.some((d) => d.toLowerCase().includes(q))
        )
      : COMPONENTS
    const groups: Record<string, ComponentMeta[]> = {}
    for (const c of filtered) {
      if (!groups[c.category]) groups[c.category] = []
      groups[c.category].push(c)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [searchQuery])

  const selected = COMPONENTS.find((c) => c.id === selectedId)

  const handlePreview = useCallback((comp: ComponentMeta) => {
    setPreviewCompId(comp.id)
  }, [])

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
            componentName={selected.nameCn}
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
        onPreview={() => handlePreview(selected)}
        onUse={() => handleUse(selected)}
        selectedComponentIds={selectedComponentIds}
      />
    )
  }

  // 列表模式
  const toggleCat = (cat: string) => setCollapsedCats((prev) => {
    const n = new Set(prev)
    n.has(cat) ? n.delete(cat) : n.add(cat)
    return n
  })

  return (
    <>
      <div className="shrink-0 border-b border-border-subtle px-2 py-1.5">
        <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder={`搜索 ${COMPONENTS.length} 个组件...`} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1.5">
        {grouped.map(([category, comps]) => {
          const collapsed = collapsedCats.has(category)
          const catCn = comps[0]?.categoryCn || category
          return (
            <div key={category} className="mb-1">
              <button
                onClick={() => toggleCat(category)}
                className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-bg-hover"
              >
                {collapsed ? <ChevronRight size={11} className="text-text-muted" /> : <ChevronDown size={11} className="text-text-muted" />}
                <span className="truncate text-[11px] font-semibold text-text-secondary">{catCn}</span>
                <span className="ml-auto rounded-full bg-bg-elevated px-1.5 text-[9px] text-text-muted">{comps.length}</span>
              </button>
              {!collapsed && (
                <div className="grid grid-cols-1 gap-1 px-0.5 pb-1">
                  {comps.map((c) => <ComponentRow key={c.id} component={c} onClick={() => setSelectedId(c.id)} />)}
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
    <button
      onClick={onClick}
      title={component.nameCn}
      className="group flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface/60 px-2 py-1.5 text-left transition-all hover:border-accent/35 hover:bg-bg-surface active:scale-[0.99]"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10">
        <Box size={12} className="text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-text-primary transition-colors group-hover:text-accent">{component.nameCn}</div>
        <div className="truncate text-[9px] text-text-muted">{component.id}</div>
      </div>
      {hasDeps && (
        <div className="flex shrink-0 items-center gap-0.5">
          {component.dependencies.slice(0, 2).map((d) => (
            <span key={d} className="rounded bg-accent/10 px-1 py-0.5 text-[8px] text-accent/70">{DEP_LABELS[d]?.[0] || d[0]}</span>
          ))}
        </div>
      )}
    </button>
  )
}
