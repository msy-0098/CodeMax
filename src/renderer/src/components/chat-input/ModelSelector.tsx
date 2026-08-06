import { useState, useEffect, useRef } from 'react'
import { Cpu, ChevronDown, Server, Check } from 'lucide-react'
import { useStore } from '../../store/useStore'

/**
 * 模型选择器 — 两级导航：
 * 左列一级分类（供应商）→ 点击后在右侧区域展开该供应商下的模型列表
 */
export function ModelSelector(): React.ReactElement {
  const settings = useStore((s) => s.settings)
  const switchProvider = useStore((s) => s.switchProvider)
  const [open, setOpen] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const providers = settings?.providers ?? []
  const activeProvider = providers.find((p) => p.id === settings?.activeProviderId) ?? providers[0]
  const currentModel = settings?.model ?? ''
  const display = activeProvider ? `${activeProvider.name} · ${currentModel}` : currentModel

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSelectedProviderId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // 展开时默认选中当前活跃供应商
  const shownProviderId = selectedProviderId ?? activeProvider?.id ?? null
  const shownProvider = providers.find((p) => p.id === shownProviderId)

  const handleSelect = (providerId: string, model: string): void => {
    void switchProvider(providerId, model)
    setOpen(false)
    setSelectedProviderId(null)
  }

  return (
    <div className="relative" ref={ref}>
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className={`chip flex cursor-pointer items-center gap-1 px-2 py-1 text-[11px] transition-all duration-200 active:scale-95 ${
          open ? 'border-accent/40 text-accent bg-accent/8' : 'text-text-secondary hover:text-text-primary hover:border-border-hover'
        }`}
      >
        <Cpu size={11} />
        <span className="max-w-[140px] truncate">{display || (providers.length === 0 ? '未配置模型' : '选择模型')}</span>
        <ChevronDown size={10} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 两级导航下拉面板 */}
      {open && (
        <div className="panel absolute bottom-full right-0 mb-2 w-[420px] animate-fade-scale flex" style={{ maxHeight: '60vh' }}>
          {/* 一级：供应商列表 */}
          <div className="flex w-[168px] shrink-0 flex-col border-r border-border-subtle">
            <div className="panel__header">服务商</div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {providers.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-text-muted">
                  尚未配置模型服务商
                  <br />
                  <span className="text-[10px]">请前往设置</span>
                </div>
              ) : (
                providers.map((p) => {
                  const isActive = p.id === activeProvider?.id
                  const isShown = p.id === shownProviderId
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProviderId(p.id)}
                      className={`panel__item mb-0.5 ${isShown ? 'panel__item--active' : ''}`}
                    >
                      <Server size={13} className={isActive ? 'text-accent' : 'text-text-muted'} />
                      <span className="min-w-0 flex-1 truncate text-[12px]">{p.name}</span>
                      {isActive && <Check size={12} className="shrink-0 text-accent" />}
                      <span className="shrink-0 text-[9px] text-text-muted">{p.models.length}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* 二级：当前供应商的模型列表（侧边展开） */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="panel__header">
              <span className="truncate">{shownProvider ? shownProvider.name : '模型'}</span>
              <span className="text-[10px] text-text-muted">{shownProvider?.models.length ?? 0} 个模型</span>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {shownProvider ? (
                shownProvider.models.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[11px] text-text-muted">
                    暂无模型
                    <br />
                    <span className="text-[10px]">可在设置中「获取模型」或手动添加</span>
                  </div>
                ) : (
                  shownProvider.models.map((m) => {
                    const isCurrent = m === currentModel && shownProvider.id === activeProvider?.id
                    return (
                      <button
                        key={m}
                        onClick={() => handleSelect(shownProvider.id, m)}
                        className={`panel__item ${isCurrent ? 'panel__item--active' : ''}`}
                      >
                        <Cpu size={12} className={isCurrent ? 'text-accent' : 'text-text-muted'} />
                        <span className="min-w-0 flex-1 truncate text-[12px]">{m}</span>
                        {isCurrent && <Check size={12} className="shrink-0 text-accent" />}
                      </button>
                    )
                  })
                )
              ) : (
                <div className="px-3 py-6 text-center text-[11px] text-text-muted">选择左侧服务商查看模型</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
