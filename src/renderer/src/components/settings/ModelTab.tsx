import { useState } from 'react'
import { Plus, Brain, Sparkles, MessageSquareText } from 'lucide-react'
import type { AppSettings, ModelProvider, ReasoningEffort, TestResult } from '@shared/types'
import { genCustomProviderId } from '../../../../shared/providers'
import { SectionTitle, Divider, ToggleRow } from './shared-components'
import { ProviderCard } from './ProviderCard'

/** 空表单模板 */
function emptyForm(): ModelProvider {
  return { id: '', name: '', kind: 'custom', baseUrl: '', apiKey: '', models: [], supportsThinking: false }
}

export function ModelTab({
  local,
  update
}: {
  local: AppSettings
  update: (patch: Partial<AppSettings>) => void
}): React.ReactElement {
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<ModelProvider>(emptyForm())
  const [fetching, setFetching] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  // 每个服务商的连接测试状态
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

  const providers = local.providers ?? []

  /** 获取模型：卡片模式拉取后合并去重写回；表单模式（draft 无 id）拉取后写入 draft.models */
  const handleFetchModels = async (provider: ModelProvider): Promise<void> => {
    const isDraft = !provider.id
    setFetching(isDraft ? 'draft' : provider.id)
    setFetchError(null)
    try {
      const res = await window.api.providers.fetchModels(provider.baseUrl, provider.apiKey)
      if (!res.success || !res.models) {
        setFetchError(res.error ?? '获取失败')
        return
      }
      if (isDraft) {
        setDraft((d) => ({ ...d, models: [...new Set([...d.models, ...(res.models ?? [])])] }))
      } else {
        const merged = [...new Set([...provider.models, ...res.models])]
        update({ providers: providers.map((p) => (p.id === provider.id ? { ...provider, models: merged } : p)) })
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e))
    } finally {
      setFetching(null)
    }
  }

  /** 测试服务商连接可用性 */
  const handleTest = async (provider: ModelProvider): Promise<void> => {
    const model = provider.models[0]
    if (!model) return
    setTesting(provider.id)
    const result = await window.api.chat.test(provider.apiKey, provider.baseUrl, model)
    setTestResults((prev) => ({ ...prev, [provider.id]: result }))
    setTesting(null)
  }

  /** 切换服务商/模型 — 写入本地 draft，随「保存设置」统一持久化 */
  const handleSwitch = (providerId: string, model?: string): void => {
    const provider = providers.find((p) => p.id === providerId)
    if (!provider) return
    const nextModel = model ?? provider.models[0] ?? local.model
    update({
      activeProviderId: providerId,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: nextModel
    })
  }

  /** 更新单个服务商 — 写入本地 draft */
  const handleUpdate = (provider: ModelProvider): void => {
    update({ providers: providers.map((p) => (p.id === provider.id ? provider : p)) })
  }

  /** 删除服务商 — 若删除当前激活项则回退到第一个 */
  const handleRemove = (providerId: string): void => {
    const next = providers.filter((p) => p.id !== providerId)
    const patch: Partial<AppSettings> = { providers: next }
    if (local.activeProviderId === providerId) {
      const fallback = next[0]
      if (fallback) {
        patch.activeProviderId = fallback.id
        patch.baseUrl = fallback.baseUrl
        patch.apiKey = fallback.apiKey
        patch.model = fallback.models[0] ?? local.model
      }
    }
    update(patch)
  }

  const handleSaveCustom = (): void => {
    if (!draft.name.trim() || !draft.baseUrl.trim()) return
    const provider: ModelProvider = {
      ...draft,
      id: draft.id || genCustomProviderId(providers),
      kind: 'custom',
      supportsThinking: draft.baseUrl.includes('deepseek.com')
    }
    update({ providers: [...providers, provider] })
    setShowForm(false)
    setDraft(emptyForm())
  }

  return (
    <div className="space-y-5">
      <SectionTitle title="模型服务商" desc="预设服务商一键切换，自定义服务商支持任意 OpenAI 兼容端点；每个服务商可单独测试可用性" />

      <div className="space-y-2.5">
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            isActive={p.id === local.activeProviderId}
            activeModel={local.model}
            fetching={fetching === p.id}
            testing={testing === p.id}
            testResult={testResults[p.id] ?? null}
            onSwitch={handleSwitch}
            onFetchModels={(prov) => void handleFetchModels(prov)}
            onRemove={handleRemove}
            onUpdate={handleUpdate}
            onTest={(prov) => void handleTest(prov)}
          />
        ))}
      </div>

      {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="chip text-[11px]"><Plus size={11} /> 添加自定义服务商</button>
      )}

      {showForm && (
        <div className="space-y-2 rounded-xl border border-border-subtle bg-bg-elevated/50 p-4">
          <SectionTitle title="自定义服务商" desc="填写 OpenAI 兼容端点信息" />
          <div className="grid grid-cols-1 gap-2 text-xs">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="名称（如 我的网关）" className="rounded-lg border border-border bg-bg-input px-2.5 py-1.5 text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none" />
            <input value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} placeholder="Base URL（如 https://api.example.com/v1）" className="rounded-lg border border-border bg-bg-input px-2.5 py-1.5 text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none" />
            <input value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} type="password" placeholder="API Key" className="rounded-lg border border-border bg-bg-input px-2.5 py-1.5 text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none" />
            <div className="flex items-center gap-1.5">
              <input value={draft.models.join(', ')} onChange={(e) => setDraft({ ...draft, models: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="模型名（逗号分隔，或用下方按钮拉取）" className="min-w-0 flex-1 rounded-lg border border-border bg-bg-input px-2.5 py-1.5 text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none" />
              <button onClick={() => void handleFetchModels(draft)} disabled={fetching === 'draft'} className="chip shrink-0 text-[11px]">{fetching === 'draft' ? '获取中' : '获取模型'}</button>
            </div>
          </div>
          <div className="flex justify-end gap-1.5">
            <button onClick={() => { setShowForm(false); setDraft(emptyForm()) }} className="chip text-[11px]">取消</button>
            <button onClick={() => void handleSaveCustom()} className="chip text-[11px] text-accent">保存</button>
          </div>
        </div>
      )}

      <Divider />

      {/* ===== 推理参数区 ===== */}

      <SectionTitle title="推理参数" desc="控制模型的推理行为与输出风格" />

      {/* 思考模式 */}
      <ToggleRow
        icon={<Brain size={15} />}
        label="思考模式"
        desc="开启后模型输出思维链推理过程（reasoning_content）"
        active={local.thinkingMode}
        onToggle={() => {
          const newMode = !local.thinkingMode
          update({
            thinkingMode: newMode,
            // 关闭思考模式时自动将 effort 设为 off，开启时恢复为 high
            reasoningEffort: newMode ? (local.reasoningEffort === 'off' ? 'high' : local.reasoningEffort) : 'off'
          })
        }}
        activeText="已开启 · 输出思维链"
        inactiveText="已关闭 · 快速回答"
      />

      {/* 思考强度 — 仅在思考模式开启时显示 */}
      {local.thinkingMode && (
        <div className="ios-card p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent" />
            <div>
              <p className="text-sm font-medium text-text-primary">思考强度</p>
              <p className="text-xs text-text-muted">控制推理深度，强度越高回答越精准但耗时更长</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {([
              { value: 'off' as ReasoningEffort, label: '关闭', desc: '不输出思维链' },
              { value: 'high' as ReasoningEffort, label: 'High', desc: '深度推理' },
              { value: 'max' as ReasoningEffort, label: 'Max', desc: '极致推理' },
              { value: 'ultra' as ReasoningEffort, label: 'Ultra', desc: '范式+监督' }
            ]).map((level) => (
              <button
                key={level.value}
                onClick={() => update({ reasoningEffort: level.value })}
                className={`flex-1 rounded-lg border p-2.5 text-center transition-all duration-200 ${
                  local.reasoningEffort === level.value
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-bg-elevated hover:border-border-hover'
                }`}
              >
                <p className={`text-xs font-semibold ${
                  local.reasoningEffort === level.value ? 'text-accent' : 'text-text-primary'
                }`}>
                  {level.label}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">{level.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 温度 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">温度（Temperature）</label>
          <span className="rounded bg-bg-elevated px-2 py-0.5 text-xs font-mono text-accent">
            {local.temperature.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={local.temperature}
          onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
          className="w-full accent-accent"
          disabled={local.thinkingMode}
        />
        <div className="mt-1 flex justify-between text-[10px] text-text-muted">
          <span>精确 (0)</span>
          <span>平衡 (1.0)</span>
          <span>发散 (2.0)</span>
        </div>
        {local.thinkingMode && (
          <p className="mt-1.5 text-xs text-amber-400/70">
            思考模式下温度参数不生效（由模型自主控制推理强度）
          </p>
        )}
      </div>

      <Divider />

      {/* 自定义提示词 */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <MessageSquareText size={15} className="text-accent" />
          <label className="text-sm font-medium text-text-primary">自定义附加指令</label>
        </div>
        <textarea
          value={local.customPrompt}
          onChange={(e) => update({ customPrompt: e.target.value })}
          rows={4}
          placeholder="输入额外指令，将追加到所有模式的系统提示词之后。例如：&#10;- 始终用中文回答&#10;- 输出更简洁，避免冗余解释&#10;- 代码注释用英文"
          className="w-full resize-none rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-text-muted">
          这些指令会附加到每个模式的系统提示词末尾，影响所有对话
        </p>
      </div>
    </div>
  )
}
