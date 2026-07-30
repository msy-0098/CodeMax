import {
  Terminal,
  Cpu,
  Type,
  Monitor,
  Clock,
  Globe,
  Search,
  Database,
  Network,
  Server,
  Eye,
  Zap
} from 'lucide-react'
import type { AppSettings } from '../../../../shared/types'
import {
  CollapsibleSection,
  NumberInputRow,
  ToggleRow
} from './shared-components'

export function ToolsTab({
  local,
  update
}: {
  local: AppSettings
  update: (patch: Partial<AppSettings>) => void
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <CollapsibleSection
        icon={<Zap size={16} />}
        title="GPU 硬件加速"
        desc="独显/核显加速渲染 UI，关闭后使用软件渲染"
        defaultOpen
      >
        <ToggleRow
          icon={<Zap size={15} />}
          label="GPU 硬件加速"
          desc="优先调用独显渲染 UI，无独显时自动使用核显。更改后需重启软件生效。"
          active={local.gpuAcceleration ?? true}
          onToggle={() => update({ gpuAcceleration: !(local.gpuAcceleration ?? true) })}
          activeText="已开启 · GPU 加速渲染"
          inactiveText="已关闭 · 软件渲染"
        />
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Terminal size={16} />}
        title="终端与代码执行"
        desc="命令超时、输出截断、代码执行默认参数"
      >
        <NumberInputRow
          icon={<Terminal size={15} />}
          label="终端命令默认超时"
          desc="terminal_exec 工具的默认超时"
          value={local.terminalTimeout ?? 60}
          min={10}
          max={300}
          step={10}
          unit="秒"
          onChange={(v) => update({ terminalTimeout: v })}
        />
        <NumberInputRow
          icon={<Cpu size={15} />}
          label="代码执行默认超时"
          desc="code_execute 工具的默认超时"
          value={local.codeExecTimeout ?? 60}
          min={10}
          max={300}
          step={10}
          unit="秒"
          onChange={(v) => update({ codeExecTimeout: v })}
        />
        <NumberInputRow
          icon={<Type size={15} />}
          label="终端输出截断长度"
          desc="超长输出截断防止占满上下文"
          value={local.terminalOutputLimit ?? 50000}
          min={10000}
          max={200000}
          step={5000}
          unit="字符"
          onChange={(v) => update({ terminalOutputLimit: v })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Monitor size={16} />}
        title="浏览器自动化"
        desc="无头模式、空闲超时、视口尺寸"
      >
        <ToggleRow
          icon={<Monitor size={15} />}
          label="浏览器无头模式"
          desc="开启后台运行，关闭显示窗口（调试用）"
          active={local.browserHeadless ?? true}
          onToggle={() => update({ browserHeadless: !(local.browserHeadless ?? true) })}
          activeText="已开启 · 后台运行"
          inactiveText="已关闭 · 显示窗口"
        />
        <NumberInputRow
          icon={<Clock size={15} />}
          label="浏览器空闲超时"
          desc="空闲多久后自动关闭释放内存"
          value={local.browserIdleTimeout ?? 5}
          min={1}
          max={30}
          step={1}
          unit="分钟"
          onChange={(v) => update({ browserIdleTimeout: v })}
        />
        <NumberInputRow
          icon={<Monitor size={15} />}
          label="浏览器视口宽度"
          desc="页面渲染宽度"
          value={local.browserViewportWidth ?? 1280}
          min={800}
          max={2560}
          step={40}
          unit="px"
          onChange={(v) => update({ browserViewportWidth: v })}
        />
        <NumberInputRow
          icon={<Monitor size={15} />}
          label="浏览器视口高度"
          desc="页面渲染高度"
          value={local.browserViewportHeight ?? 800}
          min={600}
          max={1440}
          step={40}
          unit="px"
          onChange={(v) => update({ browserViewportHeight: v })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Globe size={16} />}
        title="联网搜索与网页抓取"
        desc="搜索引擎偏好、结果数量、抓取长度、缓存"
      >
        <div className="ios-card p-3.5 space-y-3 my-2">
          <div className="flex items-center gap-2">
            <Globe size={15} className="text-accent" />
            <div>
              <p className="text-sm font-medium text-text-primary">默认搜索引擎</p>
              <p className="text-xs text-text-muted">主引擎失败时自动降级</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {([
              { value: 'bing', label: 'Bing', desc: '国际' },
              { value: 'baidu', label: '百度', desc: '国内' },
              { value: 'duckduckgo', label: 'DuckDuckGo', desc: '隐私' }
            ]).map((engine) => (
              <button
                key={engine.value}
                onClick={() => update({ defaultSearchEngine: engine.value as 'bing' | 'baidu' | 'duckduckgo' })}
                className={`flex-1 rounded-lg border p-2.5 text-center transition-all duration-200 ${
                  (local.defaultSearchEngine ?? 'bing') === engine.value
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-bg-elevated hover:border-border-hover'
                }`}
              >
                <p className={`text-xs font-semibold ${
                  (local.defaultSearchEngine ?? 'bing') === engine.value ? 'text-accent' : 'text-text-primary'
                }`}>
                  {engine.label}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">{engine.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <NumberInputRow
          icon={<Search size={15} />}
          label="搜索结果默认数量"
          desc="web_search 默认返回数量"
          value={local.searchResultsCount ?? 5}
          min={3}
          max={20}
          step={1}
          unit="条"
          onChange={(v) => update({ searchResultsCount: v })}
        />
        <NumberInputRow
          icon={<Globe size={15} />}
          label="网页抓取内容上限"
          desc="web_fetch 默认返回最大字符数"
          value={local.webFetchMaxLength ?? 10000}
          min={5000}
          max={50000}
          step={1000}
          unit="字符"
          onChange={(v) => update({ webFetchMaxLength: v })}
        />
        <ToggleRow
          icon={<Database size={15} />}
          label="网页缓存"
          desc="本地缓存减少重复请求"
          active={local.webCacheEnabled ?? true}
          onToggle={() => update({ webCacheEnabled: !(local.webCacheEnabled ?? true) })}
          activeText="已开启 · 本地缓存"
          inactiveText="已关闭 · 不缓存"
        />
        <NumberInputRow
          icon={<Database size={15} />}
          label="网页缓存最大大小"
          desc="超限自动清理最旧条目"
          value={local.webCacheMaxSizeMB ?? 100}
          min={10}
          max={500}
          step={10}
          unit="MB"
          onChange={(v) => update({ webCacheMaxSizeMB: v })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Monitor size={16} />}
        title="桌面操控"
        desc="pi-computer-use Helper 命令超时"
      >
        <NumberInputRow
          icon={<Monitor size={15} />}
          label="Helper 命令超时"
          desc="Helper 命令执行超时"
          value={local.helperCommandTimeout ?? 30}
          min={5}
          max={120}
          step={5}
          unit="秒"
          onChange={(v) => update({ helperCommandTimeout: v })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Network size={16} />}
        title="网络抓包"
        desc="内嵌浏览器抓包行为"
      >
        <NumberInputRow
          icon={<Network size={15} />}
          label="抓包最大请求数"
          desc="最多保存多少条抓包记录"
          value={local.maxCapturedRequests ?? 500}
          min={100}
          max={5000}
          step={100}
          unit="条"
          onChange={(v) => update({ maxCapturedRequests: v })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Server size={16} />}
        title="MCP 集成"
        desc="MCP 服务器连接超时"
      >
        <NumberInputRow
          icon={<Server size={15} />}
          label="MCP 连接超时"
          desc="MCP 服务器连接和请求超时"
          value={local.mcpConnectTimeout ?? 30}
          min={5}
          max={60}
          step={5}
          unit="秒"
          onChange={(v) => update({ mcpConnectTimeout: v })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Eye size={16} />}
        title="视觉模型（Agent 的眼睛）"
        desc="Agnes 2.5 Flash — 让 Agent 具备图像理解能力"
        defaultOpen
      >
        <div className="ios-card p-3.5 space-y-3 my-2">
          <div className="flex items-center gap-2">
            <Eye size={15} className="text-accent" />
            <div>
              <p className="text-sm font-medium text-text-primary">视觉模型配置</p>
              <p className="text-xs text-text-muted">Agent 通过此模型分析截图、UI 设计稿和图片内容</p>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-text-muted">API Key</label>
              <input
                type="password"
                value={local.visionApiKey ?? ''}
                onChange={(e) => update({ visionApiKey: e.target.value })}
                placeholder="sk-..."
                className="mt-1 w-full rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Base URL</label>
              <input
                type="text"
                value={local.visionBaseUrl ?? ''}
                onChange={(e) => update({ visionBaseUrl: e.target.value })}
                placeholder="https://api.agnes-ai.cn/v1"
                className="mt-1 w-full rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">模型名称</label>
              <input
                type="text"
                value={local.visionModel ?? ''}
                onChange={(e) => update({ visionModel: e.target.value })}
                placeholder="agnes-2.5-flash"
                className="mt-1 w-full rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
