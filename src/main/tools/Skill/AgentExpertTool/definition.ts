import type { ToolDefinition } from '../../../../shared/types'

const DEFINITION: ToolDefinition = {
  name: 'agent_expert',
  description:
    '调度 AI 专家子 Agent 协同工作。可列出/搜索 254 位专家，也可激活指定专家并附带任务描述让其独立处理子任务。\n\n' +
    '## 激活流程\n' +
    '当 action=activate 时，工具会自动完成以下分析：\n' +
    '1. 提取专家系统提示词（含人格、能力、工作风格）\n' +
    '2. 分析提示词，根据专家部门 + 关键词推断所需工具\n' +
    '3. 生成预设自动化工作流\n' +
    '4. 将工具配置和工作流注入专家系统提示词\n' +
    '5. 如附带 task，子 Agent 将以专家视角 + 配置好的工具独立处理任务\n\n' +
    '主 Agent 负责理解用户目的、分解任务、调度专家、综合结果——绝不推诿，遇到困难主动寻找替代方案。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: '操作类型：activate=激活专家（自动分析提示词、配置工具、预设工作流），deactivate=停用专家，list=列出专家，search=搜索专家',
        enum: ['activate', 'deactivate', 'list', 'search']
      },
      expert_id: {
        type: 'string',
        description: '专家 ID（如 engineering-frontend-developer），activate/deactivate 时必填'
      },
      task: {
        type: 'string',
        description: '交给该专家处理的子任务描述。activate 时填写则专家子 Agent 会以专家视角 + 配置好的工具独立处理后返回结果；不填则仅返回专家信息（含提示词分析、推荐工具、预设工作流）供主 Agent 参考。'
      },
      division: {
        type: 'string',
        description: '部门 key（如 engineering, design, marketing），list 时可选，用于筛选部门'
      },
      query: {
        type: 'string',
        description: '搜索关键词，search 时必填'
      }
    },
    required: ['action']
  }
}

export { DEFINITION }
