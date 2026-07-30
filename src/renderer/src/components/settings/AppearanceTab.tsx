import { useState, useEffect } from 'react'
import {
  Type,
  Sun,
  Moon,
  Palette,
  Sparkles,
  Zap,
  CheckCircle2,
  Download,
  Upload,
  Trash2,
  XCircle,
  Clock,
  Layers
} from 'lucide-react'
import type { AppSettings, FontSize } from '../../../../shared/types'
import {
  THEME_PRESETS,
  SectionTitle,
  Divider,
  CollapsibleSection,
  ToggleRow,
  NumberInputRow,
  DataRow
} from './shared-components'

// 系统字体缓存 — 模块级变量负责同会话内缓存，localStorage 负责跨会话持久化
const FONTS_CACHE_KEY = 'cached-system-fonts'
const FONTS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 天后过期，确保字体列表不会太陈旧
let _cachedFonts: string[] | null = null

/** 从 localStorage 读取缓存的字体列表（含 TTL 检查） */
function readFontCache(): string[] | null {
  try {
    const raw = localStorage.getItem(FONTS_CACHE_KEY)
    if (!raw) return null
    const { fonts, time } = JSON.parse(raw) as { fonts: string[]; time: number }
    if (Date.now() - time < FONTS_CACHE_TTL) return fonts
  } catch { /* ignore */ }
  return null
}

/** 将字体列表写入 localStorage */
function writeFontCache(fonts: string[]): void {
  try {
    localStorage.setItem(FONTS_CACHE_KEY, JSON.stringify({ fonts, time: Date.now() }))
  } catch { /* ignore */ }
}

export function AppearanceTab({
  local,
  update,
  onExport,
  onImport,
  onClearAll,
  importMsg,
  fileInputRef,
  convoCount,
  transitionFileRef,
  transitionMsg,
  onImportTransition
}: {
  local: AppSettings
  update: (patch: Partial<AppSettings>) => void
  onExport: () => void
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearAll: () => void
  importMsg: { ok: boolean; text: string } | null
  fileInputRef: React.RefObject<HTMLInputElement>
  convoCount: number
  transitionFileRef: React.RefObject<HTMLInputElement>
  transitionMsg: { ok: boolean; text: string } | null
  onImportTransition: (e: React.ChangeEvent<HTMLInputElement>) => void
}): React.ReactElement {
  const [confirmClear, setConfirmClear] = useState(false)
  // 初始化：模块级缓存 → localStorage → 空（仅首次打开或缓存过期时才发起 IPC）
  const [systemFonts, setSystemFonts] = useState<string[]>(() => {
    if (_cachedFonts) return _cachedFonts
    const stored = readFontCache()
    if (stored) { _cachedFonts = stored; return stored }
    return []
  })
  const [fontsLoading, setFontsLoading] = useState(false)

  useEffect(() => {
    if (!(local.startupAnimationEnabled ?? true) || systemFonts.length > 0 || fontsLoading) return
    setFontsLoading(true)
    window.api.fonts.list().then(fonts => {
      _cachedFonts = fonts
      writeFontCache(fonts)
      setSystemFonts(fonts)
      setFontsLoading(false)
    }).catch(() => setFontsLoading(false))
  }, [local.startupAnimationEnabled, systemFonts.length, fontsLoading])

  return (
    <div className="space-y-5">
      <SectionTitle title="聊天外观" desc="调整对话界面的显示偏好" />

      {/* 字体大小 */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Type size={15} className="text-accent" />
          <label className="text-sm font-medium text-text-primary">消息字体大小</label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['sm', 'md', 'lg'] as FontSize[]).map((fs) => (
            <button
              key={fs}
              onClick={() => update({ fontSize: fs })}
              className={`rounded-lg border p-3 text-center transition-colors ${
                local.fontSize === fs
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-bg-elevated hover:border-border-hover'
              }`}
            >
              <p
                className={`font-medium ${
                  local.fontSize === fs ? 'text-accent' : 'text-text-primary'
                }`}
                style={{
                  fontSize: fs === 'sm' ? '13px' : fs === 'md' ? '15px' : '17px'
                }}
              >
                {fs === 'sm' ? '小' : fs === 'md' ? '中' : '大'}
              </p>
              <p className="mt-0.5 text-[10px] text-text-muted">
                {fs === 'sm' ? '13px' : fs === 'md' ? '15px' : '17px'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 明暗主题 */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          {local.theme === 'dark' ? <Moon size={15} className="text-accent" /> : <Sun size={15} className="text-accent" />}
          <label className="text-sm font-medium text-text-primary">界面主题</label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => update({ theme: 'light' })}
            className={`rounded-lg border p-3 text-center transition-colors ${
              local.theme === 'light'
                ? 'border-accent bg-accent/10'
                : 'border-border bg-bg-elevated hover:border-border-hover'
            }`}
          >
            <Sun size={18} className={`mx-auto ${local.theme === 'light' ? 'text-accent' : 'text-text-muted'}`} />
            <p className={`mt-1 text-xs font-medium ${local.theme === 'light' ? 'text-accent' : 'text-text-primary'}`}>浅色</p>
          </button>
          <button
            onClick={() => update({ theme: 'dark' })}
            className={`rounded-lg border p-3 text-center transition-colors ${
              local.theme === 'dark'
                ? 'border-accent bg-accent/10'
                : 'border-border bg-bg-elevated hover:border-border-hover'
            }`}
          >
            <Moon size={18} className={`mx-auto ${local.theme === 'dark' ? 'text-accent' : 'text-text-muted'}`} />
            <p className={`mt-1 text-xs font-medium ${local.theme === 'dark' ? 'text-accent' : 'text-text-primary'}`}>深色</p>
          </button>
        </div>
      </div>

      {/* 主题颜色 */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Palette size={15} className="text-accent" />
          <label className="text-sm font-medium text-text-primary">主题颜色</label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => update({ themeColor: preset.value })}
              className={`h-8 w-8 rounded-full transition-all ${
                local.themeColor.toLowerCase() === preset.value.toLowerCase()
                  ? 'ring-2 ring-offset-2 ring-offset-bg-surface'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: preset.value, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
              title={preset.name}
            >
              {local.themeColor.toLowerCase() === preset.value.toLowerCase() && (
                <CheckCircle2 size={14} className="mx-auto text-white drop-shadow" />
              )}
            </button>
          ))}
          {/* 自定义颜色 */}
          <label
            className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-text-muted transition-colors hover:border-accent hover:text-accent"
            title="自定义颜色"
          >
            <Palette size={14} />
            <input
              type="color"
              value={local.themeColor}
              onChange={(e) => update({ themeColor: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-text-muted">当前：</span>
          <span className="rounded bg-bg-elevated px-2 py-0.5 font-mono text-xs text-text-secondary">
            {local.themeColor}
          </span>
        </div>
      </div>

      <CollapsibleSection
        icon={<Sparkles size={16} />}
        title="开屏动画"
        desc="启动动画文字、转场样式与配色"
      >
        <ToggleRow
          icon={<Zap size={15} />}
          label="开屏动画"
          desc="启动时显示草书逐字描边动画"
          active={local.startupAnimationEnabled ?? true}
          onToggle={() => update({ startupAnimationEnabled: !(local.startupAnimationEnabled ?? true) })}
          activeText="已开启 · 启动播放动画"
          inactiveText="已关闭 · 直接进入主界面"
        />

        {(local.startupAnimationEnabled ?? true) && (
          <>
            {/* 开屏文字 */}
            <div className="py-2">
              <div className="mb-2 flex items-center gap-2">
                <Type size={15} className="text-text-muted" />
                <label className="text-sm font-medium text-text-primary">开屏文字</label>
              </div>
              <input
                type="text"
                value={local.startupText ?? 'ximo-Agent'}
                onChange={(e) => update({ startupText: e.target.value })}
                placeholder="ximo-Agent"
                maxLength={30}
                className="w-full rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
              <p className="mt-1 text-xs text-text-muted">启动时逐字描边的文字，建议 3~15 个字符</p>
            </div>

            <NumberInputRow
              icon={<Type size={15} />}
              label="文字大小"
              desc="SVG 渲染的 fontSize"
              value={local.startupTextSize ?? 76}
              min={40}
              max={120}
              step={4}
              unit="px"
              onChange={(v) => update({ startupTextSize: v })}
            />

            <NumberInputRow
              icon={<Clock size={15} />}
              label="描边时长"
              desc="每个字的描边动画时长"
              value={local.startupStrokeDuration ?? 460}
              min={200}
              max={1000}
              step={40}
              unit="ms"
              onChange={(v) => update({ startupStrokeDuration: v })}
            />

            {/* 开屏字体 */}
            <div className="py-2">
              <div className="mb-2 flex items-center gap-2">
                <Type size={15} className="text-text-muted" />
                <label className="text-sm font-medium text-text-primary">开屏字体</label>
              </div>
              <select
                value={local.startupFontFamily ?? "'Dancing Script', cursive"}
                onChange={(e) => update({ startupFontFamily: e.target.value })}
                className="w-full rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
              >
                <option value="'Dancing Script', cursive">Dancing Script（默认草书）</option>
                {systemFonts.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
                {fontsLoading && <option disabled>正在加载系统字体…</option>}
              </select>
              <p className="mt-1 text-xs text-text-muted">选择开屏文字的字体，列表来自系统已安装字体</p>
            </div>

            <Divider />

            <ToggleRow
              icon={<Sparkles size={15} />}
              label="转场效果"
              desc="描边完成后是否播放转场效果"
              active={local.burstTransitionEnabled ?? true}
              onToggle={() => update({ burstTransitionEnabled: !(local.burstTransitionEnabled ?? true) })}
              activeText="已开启 · 播放转场"
              inactiveText="已关闭 · 直接淡入"
            />

            {(local.burstTransitionEnabled ?? true) && (
              <>
                {/* 转场样式 */}
                <div className="ios-card p-3.5 space-y-3 my-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-accent" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">转场样式</p>
                        <p className="text-xs text-text-muted">描边完成后的粒子效果类型</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => transitionFileRef.current?.click()}
                        className="flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
                        title="从 JSON 文件导入转场动画"
                      >
                        <Upload size={12} />
                        导入动画
                      </button>
                    </div>
                  </div>
                  <input
                    ref={transitionFileRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={onImportTransition}
                    className="hidden"
                  />
                  {transitionMsg && (
                    <p className={`text-[11px] ${transitionMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>
                      {transitionMsg.text}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'rose', label: '玫瑰花瓣', desc: '泪滴形花瓣飞散' },
                      { value: 'fireworks', label: '烟花', desc: '多点放射爆裂' },
                      { value: 'confetti', label: '彩纸', desc: '矩形纸片下落' },
                      { value: 'aura', label: '光环', desc: '同心圆环扩张' },
                      { value: 'lightfall', label: '光瀑', desc: '垂直光带倾泻' },
                      { value: 'fade', label: '纯淡入', desc: '无粒子，仅渐隐' },
                      { value: 'custom', label: '自定义', desc: '从文件导入动画' }
                    ]).map((style) => (
                      <button
                        key={style.value}
                        onClick={() => update({ burstTransitionStyle: style.value as 'rose' | 'fireworks' | 'confetti' | 'fade' | 'aura' | 'lightfall' | 'custom' })}
                        className={`rounded-lg border p-2.5 text-center transition-all duration-200 ${
                          (local.burstTransitionStyle ?? 'rose') === style.value
                            ? 'border-accent bg-accent/10'
                            : 'border-border bg-bg-elevated hover:border-border-hover'
                        }`}
                      >
                        <p className={`text-xs font-semibold ${
                          (local.burstTransitionStyle ?? 'rose') === style.value ? 'text-accent' : 'text-text-primary'
                        }`}>
                          {style.label}
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">{style.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 配色主题 */}
                <div className="ios-card p-3.5 space-y-3 my-2">
                  <div className="flex items-center gap-2">
                    <Palette size={15} className="text-accent" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">转场配色</p>
                      <p className="text-xs text-text-muted">粒子的颜色色系</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { value: 'rose', label: '玫瑰', color: '#e84393' },
                      { value: 'ocean', label: '海蓝', color: '#0984e3' },
                      { value: 'gold', label: '金色', color: '#f1c40f' },
                      { value: 'aurora', label: '极光', color: '#a29bfe' }
                    ]).map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => update({ burstColorTheme: theme.value as 'rose' | 'ocean' | 'gold' | 'aurora' })}
                        className={`rounded-lg border p-2 text-center transition-all duration-200 ${
                          (local.burstColorTheme ?? 'rose') === theme.value
                            ? 'border-accent bg-accent/10'
                            : 'border-border bg-bg-elevated hover:border-border-hover'
                        }`}
                      >
                        <div
                          className="mx-auto mb-1 h-4 w-4 rounded-full"
                          style={{ background: theme.color }}
                        />
                        <p className={`text-[10px] font-medium ${
                          (local.burstColorTheme ?? 'rose') === theme.value ? 'text-accent' : 'text-text-primary'
                        }`}>
                          {theme.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <NumberInputRow
                  icon={<Layers size={15} />}
                  label="粒子数量"
                  desc={local.burstTransitionStyle === 'fade' ? '淡入模式不使用粒子' : '转场粒子的数量'}
                  value={local.burstParticleCount ?? 120}
                  min={0}
                  max={300}
                  step={10}
                  unit="个"
                  onChange={(v) => update({ burstParticleCount: v })}
                />

                <NumberInputRow
                  icon={<Clock size={15} />}
                  label="转场时长"
                  desc="转场效果的总持续时间"
                  value={local.burstDuration ?? 2500}
                  min={1000}
                  max={5000}
                  step={250}
                  unit="ms"
                  onChange={(v) => update({ burstDuration: v })}
                />
              </>
            )}
          </>
        )}
      </CollapsibleSection>

      <Divider />

      <SectionTitle title="数据管理" desc="导出、导入或清除本地会话数据" />

      {/* 会话统计 */}
      <div className="rounded-lg border border-border-subtle bg-bg-elevated p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">本地会话数量</span>
          <span className="font-mono text-sm font-medium text-text-primary">{convoCount}</span>
        </div>
      </div>

      {/* 导出 */}
      <DataRow
        icon={<Download size={15} />}
        title="导出会话"
        desc="将所有会话保存为 JSON 文件，可用于备份或迁移"
      >
        <button
          onClick={onExport}
          disabled={convoCount === 0}
          className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          导出
        </button>
      </DataRow>

      {/* 导入 */}
      <DataRow
        icon={<Upload size={15} />}
        title="导入会话"
        desc="从 JSON 文件恢复会话（将覆盖当前会话）"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={onImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-bg-hover"
        >
          选择文件
        </button>
      </DataRow>

      {importMsg && (
        <div
          className={`flex items-center gap-2 rounded-lg p-2.5 text-xs ${
            importMsg.ok
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {importMsg.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {importMsg.text}
        </div>
      )}

      {/* 清空 */}
      <DataRow
        icon={<Trash2 size={15} />}
        title="清空所有会话"
        desc="永久删除所有本地会话数据，此操作不可撤销"
        danger
      >
        {confirmClear ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                onClearAll()
                setConfirmClear(false)
              }}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
            >
              确认清空
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="rounded-lg px-2 py-1.5 text-xs text-text-muted hover:text-text-primary"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            disabled={convoCount === 0}
            className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            清空
          </button>
        )}
      </DataRow>
    </div>
  )
}
