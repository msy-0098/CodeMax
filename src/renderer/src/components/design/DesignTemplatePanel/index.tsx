import { useState } from 'react'
import { Box, Palette, type LucideIcon } from 'lucide-react'
import type { ComponentMeta, StyleEntry } from '@shared/types'
import designSystemsCatalog from '../design-systems-catalog.json'
import uiComponentsCatalog from '../ui-components-catalog.json'
import { ComponentsTab } from './ComponentsTab'
import { StylesTab } from './StylesTab'

type PanelTab = 'components' | 'styles'

const STYLES = designSystemsCatalog as StyleEntry[]
const COMPONENTS = (uiComponentsCatalog as { components: ComponentMeta[] }).components

/** 设计模板面板 — UI 组件库 + 风格系统 */
export function DesignTemplatePanel(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<PanelTab>('components')

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 顶部 Tab — 分段控件 */}
      <div className="shrink-0 border-b border-border-subtle px-1.5 py-1.5">
        <div className="flex rounded-lg bg-bg-elevated/50 p-0.5">
          <PanelTabBtn
            active={activeTab === 'components'}
            onClick={() => setActiveTab('components')}
            icon={Box}
            label="组件库"
            count={COMPONENTS.length}
          />
          <PanelTabBtn
            active={activeTab === 'styles'}
            onClick={() => setActiveTab('styles')}
            icon={Palette}
            label="风格系统"
            count={STYLES.length}
          />
        </div>
      </div>
      {activeTab === 'components' ? <ComponentsTab /> : <StylesTab />}
    </div>
  )
}

function PanelTabBtn({ active, onClick, icon: Icon, label, count }: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
  count: number
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-200 ${
        active ? 'bg-bg-surface text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'
      }`}
    >
      <Icon size={12} />
      {label}
      <span className={`rounded-full px-1.5 text-[9px] ${active ? 'bg-accent/15 text-accent' : 'bg-bg-elevated text-text-muted'}`}>{count}</span>
    </button>
  )
}
