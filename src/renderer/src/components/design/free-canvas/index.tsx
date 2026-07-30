import { useState, useRef, useCallback, useMemo, useEffect, type DragEvent, type MouseEvent } from 'react'
import {
  Search, X, Trash2, Send, Palette, Box, ChevronDown,
  Layers, Globe, Layout,
} from 'lucide-react'
import { useStore, type CanvasItem } from '../../../store/useStore'
import type { ComponentMeta } from './types'
import { STYLES, COMPONENTS, SCENARIOS, SCENARIO_ICONS, DEFAULT_W, DEFAULT_H } from './constants'
import { CanvasCard } from './CanvasCard'
import { ComponentChip } from './ComponentChip'
import { ScenarioPicker, LayoutCard, StylePicker } from './pickers'

export function FreeCanvas(): React.ReactElement {
  const canvasItems = useStore((s) => s.canvasItems)
  const canvasStyleId = useStore((s) => s.canvasStyleId)
  const canvasScenario = useStore((s) => s.canvasScenario)
  const addCanvasItem = useStore((s) => s.addCanvasItem)
  const updateCanvasItem = useStore((s) => s.updateCanvasItem)
  const removeCanvasItem = useStore((s) => s.removeCanvasItem)
  const clearCanvas = useStore((s) => s.clearCanvas)
  const setCanvasStyle = useStore((s) => s.setCanvasStyle)
  const setCanvasScenario = useStore((s) => s.setCanvasScenario)
  const applyLayout = useStore((s) => s.applyLayout)
  const sendCanvasToAgent = useStore((s) => s.sendCanvasToAgent)
  const isStreaming = useStore((s) => s.isStreaming)

  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [showScenarioPicker, setShowScenarioPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 当前场景的布局列表
  const currentScenario = SCENARIOS.find(s => s.id === canvasScenario)

  // ─── 从 dock 拖拽到画布 ──────────────────────────────
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const compId = e.dataTransfer.getData('text/component-id')
    if (!compId) return
    const comp = COMPONENTS.find(c => c.id === compId)
    if (!comp) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left - DEFAULT_W / 2
    const y = e.clientY - rect.top - DEFAULT_H / 2

    addCanvasItem({
      componentId: comp.id,
      componentName: comp.name,
      componentNameCn: comp.nameCn,
      category: comp.category,
      dependencies: comp.dependencies,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: DEFAULT_W,
      height: DEFAULT_H,
    })
  }, [addCanvasItem])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setDragOver(false)
  }, [])

  // ─── 画布内拖拽移动 item ─────────────────────────────
  const dragState = useRef<{
    itemId: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  const handleItemMouseDown = useCallback((e: MouseEvent, item: CanvasItem) => {
    e.preventDefault()
    e.stopPropagation()
    dragState.current = {
      itemId: item.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: item.x,
      origY: item.y,
    }
    const maxZ = canvasItems.reduce((mx, it) => Math.max(mx, it.zIndex), 0)
    if (item.zIndex < maxZ) {
      updateCanvasItem(item.id, { zIndex: maxZ + 1 })
    }
  }, [canvasItems, updateCanvasItem])

  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    const newX = Math.max(0, dragState.current.origX + dx)
    const newY = Math.max(0, dragState.current.origY + dy)
    updateCanvasItem(dragState.current.itemId, { x: newX, y: newY })
  }, [updateCanvasItem])

  const handleMouseUp = useCallback(() => {
    dragState.current = null
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // ─── 组件 dock 过滤 ──────────────────────────────────
  const filteredComponents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return COMPONENTS
    return COMPONENTS.filter(c =>
      c.id.toLowerCase().includes(q) ||
      c.nameCn.includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.categoryCn.includes(q)
    )
  }, [searchQuery])

  const groupedDock = useMemo(() => {
    const groups: Record<string, ComponentMeta[]> = {}
    for (const c of filteredComponents) {
      if (!groups[c.categoryCn]) groups[c.categoryCn] = []
      groups[c.categoryCn].push(c)
    }
    return Object.entries(groups)
  }, [filteredComponents])

  const appliedStyle = STYLES.find(s => s.id === canvasStyleId)
  const ScenarioIcon = currentScenario ? (SCENARIO_ICONS[currentScenario.icon] || Globe) : null

  return (
    <div className="flex h-full flex-col">
      {/* ── 顶部工具栏 ── */}
      <div className="flex items-center gap-1.5 border-b border-border-subtle px-2.5 py-1.5 shrink-0">
        {/* 场景选择器 */}
        <div className="relative">
          <button
            onClick={() => setShowScenarioPicker(!showScenarioPicker)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors"
            style={currentScenario ? {
              backgroundColor: 'rgba(99,102,241,0.12)',
              color: '#818cf8',
            } : undefined}
          >
            {ScenarioIcon ? <ScenarioIcon size={11} /> : <Layout size={11} />}
            <span className={currentScenario ? '' : 'text-text-muted'}>
              {currentScenario ? currentScenario.name : '场景'}
            </span>
            <ChevronDown size={10} className="opacity-50" />
          </button>
          {showScenarioPicker && (
            <ScenarioPicker
              scenarios={SCENARIOS}
              selectedId={canvasScenario}
              onSelect={(id) => { setCanvasScenario(id); setShowScenarioPicker(false) }}
              onClose={() => setShowScenarioPicker(false)}
            />
          )}
        </div>

        {/* 风格选择器 */}
        <div className="relative">
          <button
            onClick={() => setShowStylePicker(!showStylePicker)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors"
            style={appliedStyle ? {
              backgroundColor: `${appliedStyle.tokens.accent}15`,
              color: appliedStyle.tokens.accent,
            } : undefined}
          >
            <Palette size={11} />
            <span className={appliedStyle ? '' : 'text-text-muted'}>
              {appliedStyle ? appliedStyle.name : '风格'}
            </span>
            {appliedStyle && (
              <span
                className="ml-0.5 h-2 w-2 rounded-full"
                style={{ backgroundColor: appliedStyle.tokens.accent }}
              />
            )}
            <ChevronDown size={10} className="opacity-50" />
          </button>
          {showStylePicker && (
            <StylePicker
              styles={STYLES}
              selectedId={canvasStyleId}
              onSelect={(id) => { setCanvasStyle(id); setShowStylePicker(false) }}
              onClose={() => setShowStylePicker(false)}
            />
          )}
        </div>

        <div className="flex-1" />

        {/* 已放置数量 */}
        {canvasItems.length > 0 && (
          <span className="flex items-center gap-1 rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
            <Layers size={9} />
            {canvasItems.length}
          </span>
        )}

        {/* 清空 */}
        {canvasItems.length > 0 && (
          <button
            onClick={clearCanvas}
            className="icon-btn rounded-lg p-1 text-text-muted hover:text-red-400"
            title="清空画布"
          >
            <Trash2 size={12} />
          </button>
        )}

        {/* 发送给 Agent */}
        <button
          onClick={() => void sendCanvasToAgent()}
          disabled={canvasItems.length === 0 || isStreaming}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
            canvasItems.length > 0 && !isStreaming
              ? 'bg-accent text-white hover:scale-105 active:scale-95'
              : 'bg-bg-elevated text-text-muted cursor-not-allowed'
          }`}
          title="发送给 Agent 开发"
        >
          <Send size={11} />
          发送
        </button>
      </div>

      {/* ── 场景布局模板区（选择场景后显示） ── */}
      {currentScenario && currentScenario.layouts.length > 0 && (
        <div className="shrink-0 border-b border-border-subtle bg-bg-surface/50">
          <div className="px-2.5 pt-1.5 pb-0.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Layout size={9} className="text-text-muted" />
              <span className="text-[9px] font-medium text-text-muted uppercase tracking-wide">
                {currentScenario.name}布局模板
              </span>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-2.5 pb-2">
            {currentScenario.layouts.map(layout => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onApply={() => applyLayout(layout.items)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 画布区域 ── */}
      <div
        ref={canvasRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex-1 overflow-auto transition-colors ${
          dragOver ? 'bg-accent/5' : 'bg-bg-base/30'
        }`}
        style={{
          backgroundImage: `
            radial-gradient(circle, ${dragOver ? 'rgba(99,102,241,0.15)' : 'rgba(120,120,140,0.08)'} 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      >
        {/* 空状态 */}
        {canvasItems.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/15 to-purple-500/15">
              <Box size={24} className="text-accent/60" />
            </div>
            <p className="text-xs font-medium text-text-secondary">自由画布</p>
            <p className="mt-1 text-[10px] text-text-muted leading-relaxed">
              {currentScenario
                ? `已选「${currentScenario.name}」场景 — 点击上方布局模板快速开始\n或从下方组件库拖拽到此处`
                : '选择场景和风格，或从下方组件库拖拽到此处\n排列后点击「发送」交给 Agent'
              }
            </p>
          </div>
        )}

        {/* 已放置的组件卡片 */}
        {canvasItems.map(item => (
          <CanvasCard
            key={item.id}
            item={item}
            onMouseDown={handleItemMouseDown}
            onRemove={() => removeCanvasItem(item.id)}
          />
        ))}
      </div>

      {/* ── 底部组件 dock ── */}
      <div className="shrink-0 border-t border-border-subtle">
        <div className="px-2 pt-1.5 pb-1">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索组件..."
              className="w-full rounded-md bg-bg-elevated/60 py-1 pl-7 pr-2 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>
        </div>

        <div className="max-h-32 overflow-y-auto px-2 pb-1.5">
          {groupedDock.map(([cat, comps]) => (
            <div key={cat} className="mb-1">
              <div className="px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-text-muted">
                {cat} ({comps.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {comps.map(comp => (
                  <ComponentChip key={comp.id} comp={comp} />
                ))}
              </div>
            </div>
          ))}
          {filteredComponents.length === 0 && (
            <div className="py-3 text-center text-[10px] text-text-muted">未找到匹配组件</div>
          )}
        </div>
      </div>
    </div>
  )
}
