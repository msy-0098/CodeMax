import { useState, useEffect, useRef } from 'react'
import { Cpu, ChevronDown, Server } from 'lucide-react'
import { useStore } from '../../store/useStore'

/** 服务商→模型 两级下拉 — 毛玻璃风格下拉面板 */
export function ModelSelector(): React.ReactElement {
  const settings = useStore((s) => s.settings)
  const switchProvider = useStore((s) => s.switchProvider)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
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
        setExpanded(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

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

      {/* 下拉面板：服务商列表 → 展开模型列表 */}
      {open && (
        <div className="absolute bottom-full right-0 mb-2 min-w-[240px] max-h-[60vh] overflow-y-auto rounded-xl border border-border-subtle bg-bg-elevated shadow-glass animate-fade-scale">
          {providers.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-text-muted">尚未配置模型服务商，请前往设置</div>
          ) : (
            providers.map((p) => {
            const isActive = p.id === activeProvider?.id
            const isExpanded = expanded === p.id
            return (
              <div key={p.id}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : p.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                >
                  <span className="flex items-center gap-2 text-[12px] font-medium">
                    <Server size={12} className={isActive ? 'text-accent' : 'text-text-muted'} />
                    {p.name}
                    {isActive && <span className="text-[9px] text-accent">当前</span>}
                  </span>
                  <span className="text-[10px] text-text-muted">{p.models.length} 模型</span>
                </button>
                {isExpanded &&
                  p.models.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        void switchProvider(p.id, m)
                        setOpen(false)
                        setExpanded(null)
                      }}
                      className={`flex w-full items-center gap-2 pl-8 pr-3 py-1.5 text-left text-[12px] transition-colors ${
                        m === currentModel && isActive
                          ? 'bg-accent/10 text-accent'
                          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                      }`}
                    >
                      <Cpu size={10} className="shrink-0" />
                      <span className="truncate">{m}</span>
                    </button>
                  ))}
              </div>
            )
          })
          )}
        </div>
      )}
    </div>
  )
}
