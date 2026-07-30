import type { AgentEntry } from './data'
import {
  DIVISION_TOOLS,
  KEYWORD_TOOL_RULES,
  DIVISION_WORKFLOWS,
  DEFAULT_TOOLS,
  DEFAULT_WORKFLOW
} from './data'

/**
 * 分析专家提示词，推断所需工具和预设工作流
 * 综合考虑：部门归属 + 描述/人格/风格中的关键词
 */
export function analyzeExpert(agent: AgentEntry): { tools: string[]; workflow: string } {
  // 1. 基于部门获取基础工具集
  const baseTools = DIVISION_TOOLS[agent.division] ?? DEFAULT_TOOLS
  const toolSet = new Set<string>(baseTools)

  // 2. 关键词扫描，叠加额外工具
  const fullText = `${agent.description} ${agent.personality} ${agent.vibe}`.toLowerCase()
  for (const rule of KEYWORD_TOOL_RULES) {
    if (rule.keywords.some(kw => fullText.includes(kw.toLowerCase()))) {
      for (const t of rule.tools) toolSet.add(t)
    }
  }

  // 3. 如果专家数据自带 tools 字段，也纳入
  if (agent.tools && agent.tools.length > 0) {
    for (const t of agent.tools) toolSet.add(t)
  }

  // 4. 获取预设工作流
  const workflow = DIVISION_WORKFLOWS[agent.division] ?? DEFAULT_WORKFLOW

  return { tools: Array.from(toolSet), workflow }
}

/** 生成专家系统提示词 */
export function buildExpertSystemPrompt(agent: AgentEntry): string {
  const { tools, workflow } = analyzeExpert(agent)

  return `你现在扮演 **${agent.name}**（${agent.emoji}）。

${agent.personality}

## 你的核心能力
${agent.description}

## 你的工作风格
${agent.vibe}

## 可用工具
你已被配置以下工具，请在需要时主动使用：
${tools.map(t => `- \`${t}\``).join('\n')}

## ${workflow}

## 输出要求
- 始终以 ${agent.name} 的专业视角分析和回答问题
- 使用该领域专业术语，但确保可理解
- 给出可操作的具体建议，而非泛泛而谈
- 主动使用可用工具以提升回答质量
- 按照预设工作流的步骤推进任务，确保有序执行`
}
