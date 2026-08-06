import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, ChevronDown, Loader2, Plus, RefreshCw, Server, Trash2, X } from 'lucide-react'
import type { ModelProvider, TestResult } from '@shared/types'

interface ProviderCardProps {
  provider: ModelProvider
  isActive: boolean
  activeModel: string
  fetching: boolean
  testing: boolean
  testResult: TestResult | null
  onSwitch: (providerId: string, model?: string) => void
  onFetchModels: (provider: ModelProvider) => void
  onRemove: (id: string) => void
  onUpdate: (provider: ModelProvider) => void
  onTest: (provider: ModelProvider) => void
}

/** 模型服务商卡片 — 含模型下拉选择 + 可用性测试标识 */
export function ProviderCard({
  provider,
  isActive,
  activeModel,
  fetching,
  testing,
  testResult,
  onSwitch,
  onFetchModels,
  onRemove,
  onUpdate,
  onTest
}: ProviderCardProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [addModel, setAddModel] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const currentModel = isActive && provider.models.includes(activeModel) ? activeModel : undefined

  const handleAddModel = (): void => {
    const m = addModel.trim()
    if (!m) return
    onUpdate({ ...provider, models: [...provider.models, m] })
    setAddModel('')
  }

  return (
    <div
      ref={ref}
      className={`rounded-xl border bg-bg-elevated/50 transition-colors ${
        isActive ? 'border-accent/30' : 'border-border-subtle'
      }`}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Server size={14} className="shrink-0 text-text-muted" />
          <span className="truncate text-sm font-semibold text-text-primary">{provider.name}</span>
          {isActive && (
            <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">当前</span>
          )}
          {testResult && (
            <span
              className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                testResult.success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'
              }`}
              title={testResult.message}
            >
              {testResult.success ? <Check size={9} /> : <AlertCircle size={9} />}
              {testResult.success ? (testResult.latency ? `${testResult.latency}ms` : '可用') : '不可用'}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!isActive && (
            <button onClick={() => onSwitch(provider.id)} className="chip text-[11px]">设为当前</button>
          )}
          <button
            onClick={() => onTest(provider)}
            disabled={testing || provider.models.length === 0}
            className="chip text-[11px]"
            title={provider.models.length === 0 ? '请先获取或添加模型' : '测试连接可用性'}
          >
            {testing ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            {testing ? '测试中' : '测试'}
          </button>
          <button
            onClick={() => onFetchModels(provider)}
            disabled={fetching}
            className="chip text-[11px]"
          >
            <RefreshCw size={11} className={fetching ? 'animate-spin' : ''} />
            {fetching ? '获取中' : '获取模型'}
          </button>
          {provider.kind === 'custom' && (
            <button onClick={() => onRemove(provider.id)} className="chip text-[11px] text-red-400">
              <Trash2 size={11} /> 删除
            </button>
          )}
        </div>
      </div>

      {/* 连接信息 */}
      <div className="mt-2.5 space-y-1.5 px-4 pb-3.5 text-xs text-text-muted">
        <div>
          Base URL：<span className="font-mono text-text-secondary">{provider.baseUrl}</span>
        </div>
        <div className="flex items-center gap-1.5">
          API Key：
          <input
            value={provider.apiKey}
            onChange={(e) => onUpdate({ ...provider, apiKey: e.target.value })}
            type="password"
            className="w-56 rounded-md border border-border bg-bg-input px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none"
            placeholder="sk-..."
          />
        </div>

        {/* 不可用错误提示 */}
        {testResult && !testResult.success && (
          <div className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-red-400">
            {testResult.message}
          </div>
        )}

        {/* 模型下拉选择 */}
        <div className="relative pt-0.5">
          <button
            onClick={() => setOpen(!open)}
            className="flex w-full items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-accent/35"
          >
            <span className="text-[11px] text-text-muted">模型</span>
            <span className={`truncate text-[11px] font-medium ${currentModel ? 'text-text-primary' : 'text-text-muted'}`}>
              {currentModel ?? (provider.models.length > 0 ? '点击选择模型' : '暂无模型')}
            </span>
            <span className="rounded-full bg-bg-elevated px-1.5 text-[9px] text-text-muted">{provider.models.length}</span>
            <ChevronDown size={12} className={`ml-auto shrink-0 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="panel absolute left-0 right-0 top-full z-20 mt-1">
              <div className="max-h-52 overflow-y-auto p-1">
                {provider.models.map((m) => (
                  <div
                    key={m}
                    onClick={() => { onSwitch(provider.id, m); setOpen(false) }}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                      m === currentModel ? 'bg-accent/10' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <span className={`min-w-0 flex-1 truncate text-xs ${m === currentModel ? 'font-medium text-accent' : 'text-text-secondary'}`}>{m}</span>
                    {m === currentModel && <Check size={12} className="shrink-0 text-accent" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdate({ ...provider, models: provider.models.filter((x) => x !== m) }) }}
                      className="shrink-0 rounded p-0.5 text-text-muted opacity-0 transition-opacity hover:bg-bg-hover hover:text-red-400 group-hover:opacity-100"
                      title="移除模型"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {provider.models.length === 0 && (
                  <div className="px-2 py-3 text-center text-[10px] text-text-muted">暂无模型，点击「获取模型」或手动添加</div>
                )}
              </div>
              {/* 添加模型 */}
              <div className="flex items-center gap-1.5 border-t border-border-subtle p-1.5">
                <input
                  value={addModel}
                  onChange={(e) => setAddModel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddModel() }}
                  placeholder="添加模型名，回车确认"
                  className="min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-input px-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none"
                />
                <button onClick={handleAddModel} className="chip shrink-0 text-[11px] text-accent"><Plus size={11} /> 添加</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
