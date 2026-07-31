import { useState, useEffect, useMemo } from 'react'
import {
  Cpu,
  Zap,
  Bot,
  Clock,
  Users,
  Search,
  Sparkles,
  MessageSquareText,
  Shield,
  Globe,
  RotateCcw,
  Layers,
  Gauge,
  Type,
  Brain
} from 'lucide-react'
import { ensureAgentsLoaded, getAgentById, searchAgents, ALL_AGENTS } from '@renderer/agents'
import type { AppSettings, ModelId, ReasoningEffort } from '../../../../shared/types'
import {
  SectionTitle,
  Divider,
  ModelCard,
  ToggleRow,
  CollapsibleSection,
  NumberInputRow
} from './shared-components'

// ==================== 主 Agent 专家选择器 ====================

function MainAgentExpertPicker({ selectedId, onSelect }: {
  selectedId: string | undefined
  onSelect: (id: string | undefined) => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (open && !ready) {
      ensureAgentsLoaded().then(() => setReady(true))
    }
  }, [open, ready])

  const selected = selectedId ? getAgentById(selectedId) : undefined

  const filtered = useMemo(() => {
    if (!ready) return []
    if (search.trim()) return searchAgents(search)
    return ALL_AGENTS.slice(0, 50)
  }, [search, ready])

  return (
    <div className="ios-card p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={selected ? 'text-accent' : 'text-text-muted'}><Users size={15} /></span>
          <div>
            <p className="text-sm font-medium text-text-primary">专家注入</p>
            <p className="text-xs text-text-muted">
              {selected ? `${selected.emoji} ${selected.name}` : '未选择专家，主 Agent 使用默认行为'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {selected && (
            <button
              onClick={() => onSelect(undefined)}
              className="rounded-lg px-2 py-1 text-xs text-text-muted hover:text-red-400 transition-colors"
            >
              清除
            </button>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="rounded-lg bg-bg-elevated px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition-colors"
          >
            {open ? '收起' : '选择'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-input px-2.5 py-1.5">
            <Search size={13} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索专家..."
              className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto space-y-1">
            {!ready ? (
              <div className="py-4 text-center text-xs text-text-muted">加载中...</div>
            ) : filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-text-muted">未找到匹配的专家</div>
            ) : (
              filtered.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => { onSelect(agent.id); setOpen(false) }}
                  className={`flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors ${
                    selectedId === agent.id ? 'bg-accent/15 text-accent' : 'hover:bg-bg-hover'
                  }`}
                >
                  <span className="text-base flex-shrink-0">{agent.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{agent.name}</p>
                    <p className="text-[10px] text-text-muted truncate">{agent.description}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Agent 编排标签 ====================

export function AgentTab({
  local,
  update
}: {
  local: AppSettings
  update: (patch: Partial<AppSettings>) => void
}): React.ReactElement {
  return (
    <div className="space-y-5">
      <SectionTitle title="主Agent模式" desc="控制编排模式下主 Agent 的行为风格" />

      <ToggleRow
        icon={<Bot size={15} />}
        label="狂暴模式"
        desc="开启后，主 Agent 进入狂暴状态：强制主动决策、绝不推诿，遇到困难必须自己想办法解决，绝不说「做不到」。"
        active={local.orchestratorEnforce ?? true}
        onToggle={() => update({ orchestratorEnforce: !(local.orchestratorEnforce ?? true) })}
        activeText="已开启 · 狂暴状态，绝不推诿"
        inactiveText="已关闭 · 普通状态，遇困难可建议调整"
      />

      <SectionTitle title="Agent 自定义" desc="自定义主 Agent 的人格和行为，或从专家库注入专家人格" />

      <MainAgentExpertPicker
        selectedId={local.mainAgentExpertId}
        onSelect={(id) => update({ mainAgentExpertId: id })}
      />

      <div>
        <div className="mb-2 flex items-center gap-2">
          <MessageSquareText size={15} className="text-accent" />
          <label className="text-sm font-medium text-text-primary">主 Agent 自定义提示词</label>
        </div>
        <textarea
          value={local.mainAgentCustomPrompt ?? ''}
          onChange={(e) => update({ mainAgentCustomPrompt: e.target.value })}
          rows={4}
          placeholder="为主 Agent 定义人格、行为风格、工作偏好等。例如：&#10;- 始终以简洁的方式回答，避免冗余解释&#10;- 遇到问题先分析根因再行动&#10;- 优先使用工具完成任务，而非直接回答"
          className="w-full resize-none rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-text-muted">
          此提示词会注入到主 Agent 的系统提示词中，影响所有对话
        </p>
      </div>

      <Divider />

      <SectionTitle title="子 Agent 模型" desc="子 Agent（专家）发起独立 API 调用时使用的模型，建议用 Flash 降低成本" />

      <div className="grid grid-cols-2 gap-3">
        <ModelCard
          active={(local.subAgentModel ?? 'deepseek-v4-flash') === 'deepseek-v4-pro'}
          onClick={() => update({ subAgentModel: 'deepseek-v4-pro' as ModelId })}
          icon={<Cpu size={18} />}
          title="V4-Pro"
          subtitle="旗舰版"
          specs={['深度推理', '高质量']}
          desc="子 Agent 回复质量更高，但耗时和成本更大"
        />
        <ModelCard
          active={(local.subAgentModel ?? 'deepseek-v4-flash') === 'deepseek-v4-flash'}
          onClick={() => update({ subAgentModel: 'deepseek-v4-flash' as ModelId })}
          icon={<Zap size={18} />}
          title="V4-Flash"
          subtitle="轻量版"
          specs={['快速响应', '低成本']}
          desc="子 Agent 回复更快更省，推荐默认选择"
        />
      </div>

      <Divider />

      <SectionTitle title="子 Agent 参数" desc="控制子 Agent 的推理行为" />

      {/* 子 Agent 温度 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">子 Agent 温度</label>
          <span className="rounded bg-bg-elevated px-2 py-0.5 text-xs font-mono text-accent">
            {(local.subAgentTemperature ?? 0.7).toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={local.subAgentTemperature ?? 0.7}
          onChange={(e) => update({ subAgentTemperature: parseFloat(e.target.value) })}
          className="w-full accent-accent"
        />
        <div className="mt-1 flex justify-between text-[10px] text-text-muted">
          <span>精确 (0)</span>
          <span>平衡 (1.0)</span>
          <span>发散 (2.0)</span>
        </div>
      </div>

      {/* 子 Agent 超时 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">子 Agent 超时</label>
          <div className="flex items-center gap-1">
            <Clock size={12} className="text-text-muted" />
            <span className="rounded bg-bg-elevated px-2 py-0.5 text-xs font-mono text-accent">
              {(local.subAgentTimeout ?? 60)}s
            </span>
          </div>
        </div>
        <input
          type="range"
          min="10"
          max="300"
          step="10"
          value={local.subAgentTimeout ?? 60}
          onChange={(e) => update({ subAgentTimeout: parseInt(e.target.value) || 60 })}
          className="w-full accent-accent"
        />
        <div className="mt-1 flex justify-between text-[10px] text-text-muted">
          <span>10s</span>
          <span>60s</span>
          <span>300s</span>
        </div>
        <p className="mt-1.5 text-xs text-text-muted">
          子 Agent 超过此时间未返回将自动中断，主 Agent 可降级为自行处理
        </p>
      </div>

      {/* 子 Agent 思考强度 */}
      <div className="ios-card p-3.5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-accent" />
          <div>
            <p className="text-sm font-medium text-text-primary">子 Agent 思考强度</p>
            <p className="text-xs text-text-muted">控制子 Agent 的推理深度，强度越高回答越精准但耗时更长</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {([
            { value: 'off' as ReasoningEffort, label: '关闭', desc: '不输出思维链' },
            { value: 'high' as ReasoningEffort, label: 'High', desc: '深度推理' },
            { value: 'max' as ReasoningEffort, label: 'Max', desc: '极致推理' }
          ]).map((level) => (
            <button
              key={level.value}
              onClick={() => update({ subAgentReasoningEffort: level.value })}
              className={`flex-1 rounded-lg border p-2.5 text-center transition-all duration-200 ${
                (local.subAgentReasoningEffort ?? 'high') === level.value
                  ? level.value === 'max'
                    ? 'border-accent bg-accent/15 shadow-[0_0_12px_color-mix(in_srgb,var(--theme-color)_40%,transparent)]'
                    : level.value === 'high'
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-bg-elevated'
                  : 'border-border bg-bg-elevated hover:border-border-hover'
              }`}
            >
              <p className={`text-xs font-semibold ${
                (local.subAgentReasoningEffort ?? 'high') === level.value ? 'text-accent' : 'text-text-primary'
              }`}>
                {level.label}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">{level.desc}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          关闭时子 Agent 使用温度参数进行采样；开启时使用思维链推理，温度参数不生效
        </p>
      </div>

      <CollapsibleSection
        icon={<Layers size={15} />}
        title="Agent 循环与上下文"
        desc="工具调用循环次数、上下文压缩策略"
      >
        <NumberInputRow
          icon={<Layers size={15} />}
          label="最大工具调用轮次"
          desc="防止死循环的安全上限"
          value={local.maxToolRounds ?? 30}
          min={5}
          max={100}
          step={5}
          unit="轮"
          onChange={(v) => update({ maxToolRounds: v })}
        />
        <NumberInputRow
          icon={<Gauge size={15} />}
          label="上下文窗口上限"
          desc="超限自动压缩旧消息"
          value={local.maxContextChars ?? 300000}
          min={100000}
          max={800000}
          step={50000}
          unit="字符"
          onChange={(v) => update({ maxContextChars: v })}
        />
        <NumberInputRow
          icon={<Type size={15} />}
          label="工具结果截断长度"
          desc="单个工具返回结果的最大字符数"
          value={local.maxToolResultChars ?? 16000}
          min={4000}
          max={50000}
          step={2000}
          unit="字符"
          onChange={(v) => update({ maxToolResultChars: v })}
        />
        <NumberInputRow
          icon={<Shield size={15} />}
          label="上下文保护窗口"
          desc="最近 N 条消息不会被压缩"
          value={local.contextRecentKeep ?? 8}
          min={4}
          max={20}
          step={1}
          unit="条"
          onChange={(v) => update({ contextRecentKeep: v })}
        />
        <NumberInputRow
          icon={<Sparkles size={15} />}
          label="Snip 保留字符数"
          desc="软阈值：旧工具结果截断为前 N 字符"
          value={local.contextSnippedKeep ?? 200}
          min={100}
          max={500}
          step={50}
          unit="字符"
          onChange={(v) => update({ contextSnippedKeep: v })}
        />
        <NumberInputRow
          icon={<Sparkles size={15} />}
          label="Prune 保留字符数"
          desc="硬阈值：进一步缩短到前 N 字符"
          value={local.contextPrunedKeep ?? 80}
          min={50}
          max={200}
          step={10}
          unit="字符"
          onChange={(v) => update({ contextPrunedKeep: v })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Shield size={15} />}
        title="自动化与安全"
        desc="Auto Mode、联网搜索、检查点快照"
      >
        <div className="ios-card p-3.5 space-y-3 my-2">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-accent" />
            <div>
              <p className="text-sm font-medium text-text-primary">Auto Mode 默认等级</p>
              <p className="text-xs text-text-muted">每次启动应用后的默认自动化等级</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {([
              { value: 'off', label: '手动确认', desc: '每次操作需确认' },
              { value: 'safe', label: '安全模式', desc: '读操作自动' },
              { value: 'yolo', label: 'YOLO', desc: '全部自动' }
            ]).map((level) => (
              <button
                key={level.value}
                onClick={() => update({ defaultAutoModeLevel: level.value as 'off' | 'safe' | 'yolo' })}
                className={`flex-1 rounded-lg border p-2.5 text-center transition-all duration-200 ${
                  (local.defaultAutoModeLevel ?? 'off') === level.value
                    ? level.value === 'yolo'
                      ? 'border-accent bg-accent/15 shadow-[0_0_12px_color-mix(in_srgb,var(--theme-color)_40%,transparent)]'
                      : level.value === 'safe'
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-bg-elevated'
                    : 'border-border bg-bg-elevated hover:border-border-hover'
                }`}
              >
                <p className={`text-xs font-semibold ${
                  (local.defaultAutoModeLevel ?? 'off') === level.value ? 'text-accent' : 'text-text-primary'
                }`}>
                  {level.label}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">{level.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <ToggleRow
          icon={<Globe size={15} />}
          label="联网搜索默认开启"
          desc="每次启动应用后联网搜索是否默认开启"
          active={local.defaultNetworkSearchOn ?? false}
          onToggle={() => update({ defaultNetworkSearchOn: !(local.defaultNetworkSearchOn ?? false) })}
          activeText="已开启 · 默认联网搜索"
          inactiveText="已关闭 · 默认不联网"
        />

        <ToggleRow
          icon={<RotateCcw size={15} />}
          label="检查点自动快照"
          desc="文件编辑前自动创建检查点快照，支持代码回退"
          active={local.checkpointEnabled ?? true}
          onToggle={() => update({ checkpointEnabled: !(local.checkpointEnabled ?? true) })}
          activeText="已开启 · 支持代码回退"
          inactiveText="已关闭 · 无法回退代码"
        />

        <ToggleRow
          icon={<Brain size={15} />}
          label="长期记忆"
          desc="每个模式独立的跨会话记忆，Agent 自主记录用户习惯、踩过的坑、工具语法，每次对话自动注入"
          active={local.memoryEnabled ?? true}
          onToggle={() => update({ memoryEnabled: !(local.memoryEnabled ?? true) })}
          activeText="已开启 · Agent 跨会话学习"
          inactiveText="已关闭 · 无持久记忆"
        />
      </CollapsibleSection>
    </div>
  )
}
