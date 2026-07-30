export interface StyleEntry {
  id: string
  name: string
  category: string
  tokens: { accent: string; bg: string; fg: string; surface: string }
}

export interface ComponentMeta {
  id: string
  name: string
  nameCn: string
  category: string
  categoryCn: string
  dependencies: string[]
  props: string[]
  files: { jsx: string; css: string | null; assets: string[] | null }
}

export interface LayoutItem {
  componentId: string
  x: number
  y: number
  w: number
  h: number
  label: string
}

export interface LayoutTemplate {
  id: string
  name: string
  desc: string
  blocks: string[]
  items: LayoutItem[]
}

export interface ScenarioEntry {
  id: string
  name: string
  icon: string
  layouts: LayoutTemplate[]
}
