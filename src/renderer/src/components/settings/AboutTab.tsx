import { Cpu } from 'lucide-react'
import {
  SectionTitle,
  Divider,
  InfoCard,
  FeatureRow,
  LinkRow
} from './shared-components'

export function AboutTab(): React.ReactElement {
  return (
    <div className="space-y-5">
      {/* 应用信息 */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-bg-elevated p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-muted shadow-lg shadow-accent/20">
          <Cpu size={28} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-text-primary">XimoAgent</h3>
          <p className="text-sm text-text-secondary">DeepSeek-V4 全能 Agent 工作台</p>
          <p className="mt-0.5 text-xs text-text-muted">版本 1.0.0 · MIT License</p>
        </div>
      </div>

      {/* DeepSeek-V4 模型信息 */}
      <SectionTitle title="DeepSeek-V4 模型" desc="由深度求索于 2026 年 4 月发布的新一代旗舰大模型" />

      <div className="grid grid-cols-2 gap-2.5">
        <InfoCard label="上下文窗口" value="1M tokens" />
        <InfoCard label="架构" value="MoE 稀疏注意力" />
        <InfoCard label="V4-Pro 参数" value="1.6T / 49B 激活" />
        <InfoCard label="V4-Flash 参数" value="284B / 13B 激活" />
      </div>

      <Divider />

      {/* 三大模式 */}
      <SectionTitle title="功能模式" desc="针对不同场景优化的 Agent 能力" />
      <div className="space-y-2">
        <FeatureRow icon="📋" title="办公模式" desc="文档撰写、邮件、会议纪要、工作计划" />
        <FeatureRow icon="💻" title="编程模式" desc="代码生成、审查、解释、Bug 修复、重构" />
        <FeatureRow icon="🎨" title="设计模式" desc="架构设计、UI/UX、数据库建模、API 设计" />
      </div>

      <Divider />

      {/* 技术栈 */}
      <SectionTitle title="技术栈" />
      <div className="flex flex-wrap gap-1.5">
        {['Electron 33', 'React 18', 'TypeScript', 'Vite', 'TailwindCSS', 'Zustand', 'Mermaid 11'].map(
          (tech) => (
            <span
              key={tech}
              className="rounded-md border border-border bg-bg-elevated px-2.5 py-1 text-xs text-text-secondary"
            >
              {tech}
            </span>
          )
        )}
      </div>

      <Divider />

      {/* 链接 */}
      <SectionTitle title="相关链接" />
      <div className="space-y-2">
        <LinkRow href="https://platform.deepseek.com" label="DeepSeek 开放平台" />
        <LinkRow href="https://api-docs.deepseek.com" label="DeepSeek API 文档" />
        <LinkRow href="https://chat.deepseek.com" label="DeepSeek 在线体验" />
      </div>

      <p className="pt-2 text-center text-xs text-text-muted">
        内容由 AI 生成，仅供参考
      </p>
    </div>
  )
}
