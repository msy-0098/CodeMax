import type { ComponentMeta } from '../../../shared/types'
import uiComponentsCatalog from '../components/design/ui-components-catalog.json'
import type { CanvasItem, StoreState } from './useStore'

type Set = (partial: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)) => void
type Get = () => StoreState

export interface CanvasSlice {
  canvasItems: CanvasItem[]
  canvasStyleId: string | null
  canvasScenario: string | null
  addCanvasItem: (item: Omit<CanvasItem, 'id' | 'zIndex'>) => void
  updateCanvasItem: (id: string, updates: Partial<CanvasItem>) => void
  removeCanvasItem: (id: string) => void
  clearCanvas: () => void
  setCanvasStyle: (id: string | null) => void
  setCanvasScenario: (scenario: string | null) => void
  applyLayout: (items: Array<{ componentId: string; x: number; y: number; w: number; h: number }>) => void
  sendCanvasToAgent: () => Promise<void>
}

export function createCanvasSlice(set: Set, get: Get): CanvasSlice {
  return {
    canvasItems: [],
    canvasStyleId: null,
    canvasScenario: null,

    addCanvasItem: (item) => set((s) => ({
      canvasItems: [...s.canvasItems, {
        ...item,
        id: `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        zIndex: s.canvasItems.length + 1,
      }]
    })),

    updateCanvasItem: (id, updates) => set((s) => ({
      canvasItems: s.canvasItems.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    })),

    removeCanvasItem: (id) => set((s) => ({
      canvasItems: s.canvasItems.filter(item => item.id !== id)
    })),

    clearCanvas: () => set({ canvasItems: [] }),
    setCanvasStyle: (id) => set({ canvasStyleId: id }),
    setCanvasScenario: (scenario) => set({ canvasScenario: scenario }),

    applyLayout: (items) => {
      const componentCatalog = (uiComponentsCatalog as { components: ComponentMeta[] }).components
      const newItems: CanvasItem[] = items.map((tpl, idx) => {
        const comp = componentCatalog.find(c => c.id === tpl.componentId)
        return {
          id: `canvas-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          componentId: tpl.componentId,
          componentName: comp?.name || tpl.componentId,
          componentNameCn: comp?.nameCn || tpl.componentId,
          category: comp?.category || 'Components',
          dependencies: comp?.dependencies || [],
          x: tpl.x,
          y: tpl.y,
          width: tpl.w,
          height: tpl.h,
          zIndex: idx + 1,
        }
      })
      set({ canvasItems: newItems })
    },

    sendCanvasToAgent: async () => {
      const state = get()
      if (state.canvasItems.length === 0) return

      const scenarioNames: Record<string, string> = {
        website: '网站', app: 'APP', desktop: '桌面软件', miniprogram: '小程序',
      }
      const scenarioName = state.canvasScenario ? scenarioNames[state.canvasScenario] || state.canvasScenario : null

      const sorted = [...state.canvasItems].sort((a, b) => a.y - b.y)

      const scenarioLine = scenarioName ? `\n📱 目标场景: ${scenarioName}` : ''
      const styleLine = state.canvasStyleId
        ? `\n🎨 应用设计风格: ${state.canvasStyleId}（请在生成时使用该风格的设计令牌）`
        : ''

      const layoutLines = sorted.map((item, idx) => {
        const section = item.y < 120 ? '顶部' : item.y < 300 ? '中部' : '底部'
        const widthDesc = item.width >= 300 ? '全宽' : item.width >= 180 ? '半宽' : '三分之一'
        return `${idx + 1}. [${item.componentId}] ${item.componentNameCn}(${item.componentName})
   位置: ${section} · 宽度: ${widthDesc}
   依赖: ${item.dependencies.length > 0 ? item.dependencies.join(', ') : '无'}`
      }).join('\n')

      const componentCalls = sorted.map(item =>
        `design_component(action="get", component_id="${item.componentId}")`
      ).join('\n')

      const styleCall = state.canvasStyleId
        ? `\ndesign_style(action="apply", style_id="${state.canvasStyleId}")`
        : ''

      const message = `请根据以下画布设计稿生成完整页面。${scenarioLine}${styleLine}

📋 页面布局（从上到下）:
${layoutLines}

🔧 请先逐个获取以下组件源码，再按布局顺序组合到 HTML 中：
${componentCalls}${styleCall}`

      get().clearCanvas()
      await get().sendMessage(message, { skipNetworkHint: true })
    },
  }
}
