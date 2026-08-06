# 设计文档：ModelProvider 抽象层（多模型服务商支持）

日期：2026-08-03
状态：已确认（待用户审阅）
涉及版本：ximo-agent v1.0.6 → v1.1.0（目标）

---

## 1. 背景与目标

当前 ximo-agent 只能对接 DeepSeek：模型选择被写死为 `deepseek-v4-pro` / `deepseek-v4-flash` 两个选项，请求层硬编码 DeepSeek 专属参数（`enable_thinking` / `reasoning_effort`），token 计数使用 DeepSeek BPE 分词器。

目标：让用户能够**选择/配置任意 OpenAI 兼容模型服务商**，包括：

- 内置常见厂商预设，一键切换
- 支持自定义服务商（Base URL + 独立 API Key + 模型列表）
- 点击「获取模型」从服务商 `/models` 端点拉取可用模型
- 跨厂商请求自动兼容（DeepSeek 保留思考链参数，其他厂商走标准 OpenAI 格式）

## 2. 决策记录（用户已确认）

| 决策点 | 结论 |
|---|---|
| 实现方案 | 方案 B：完整 Provider 抽象层 |
| 接入方式 | 预设 + 自定义都要 |
| 兼容策略 | 按服务商自动区分（DeepSeek 发专属参数，其他走标准格式） |
| 预设厂商 | OpenAI、智谱 GLM、Kimi（Moonshot）、通义 Qwen、硅基流动（+ DeepSeek 原默认） |
| 模型获取 | 新增「获取模型」按钮，调用 `GET {baseUrl}/models` |
| 兼容策略（数据） | 保留顶层 `model/baseUrl/apiKey/subAgentModel` 作为活动连接快照，主进程/工具层/会话持久化零改动 |

## 3. 数据模型

### 3.1 新增 `ModelProvider`（共享类型，`src/shared/types/settings.ts`）

```ts
interface ModelProvider {
  id: string                    // 'deepseek' | 'openai' | 'glm' | 'kimi' | 'qwen' | 'siliconflow' | 'custom-xxx'
  name: string                  // 显示名
  kind: 'preset' | 'custom'     // 预设不可删，自定义可增删改
  baseUrl: string
  apiKey: string                // 每个服务商独立 Key
  models: string[]              // 可选模型列表（预设自带，自定义可增删）
  supportsThinking: boolean     // 是否支持 enable_thinking / reasoning_content
}
```

### 3.2 `AppSettings` 变更

新增字段：

```ts
providers: ModelProvider[]
activeProviderId: string
```

保留字段（活动连接快照，切换 provider 时由 store 同步）：

```ts
apiKey: string
baseUrl: string
model: ModelId
subAgentModel?: ModelId
```

### 3.3 `ModelId` 类型放宽

`src/shared/types/core.ts`：

```ts
// 旧：export type ModelId = 'deepseek-v4-pro' | 'deepseek-v4-flash'
export type ModelId = string
```

现有 `'deepseek-v4-pro' as ModelId` 类型断言处仍可编译，无破坏。

## 4. 预设常量表

新建 `src/shared/providers.ts`，导出 `PROVIDER_PRESETS: Omit<ModelProvider, 'apiKey'>[]` 与 `buildPresetProvider(preset): ModelProvider`：

| id | name | baseUrl | 默认模型 | supportsThinking |
|---|---|---|---|---|
| deepseek | DeepSeek | `https://api.deepseek.com/v1` | `deepseek-v4-pro`, `deepseek-v4-flash` | true |
| openai | OpenAI | `https://api.openai.com/v1` | `gpt-4o`, `gpt-4o-mini`, `o3` | false |
| glm | 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus`, `glm-4-flash` | false |
| kimi | Kimi（Moonshot） | `https://api.moonshot.cn/v1` | `moonshot-v1-8k`, `moonshot-v1-32k`, `moonshot-v1-128k` | false |
| qwen | 通义 Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max`, `qwen-plus`, `qwen-turbo` | false |
| siliconflow | 硅基流动 | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3`, `Qwen/Qwen2.5-72B-Instruct` | false |

## 5. 请求层适配（`src/main/deepseek/api.ts`）

`callDeepSeekStreamOnce` 增加 `supportsThinking: boolean` 参数（由调用链从 active provider 传入）：

- `supportsThinking === true && thinkingMode === true` → 请求体包含 `enable_thinking: true` + `reasoning_effort`
- 否则 → **不发送** DeepSeek 专属字段，仅标准 OpenAI 参数（`model/messages/stream/max_tokens/stream_options/tools/tool_choice/temperature`）

`reasoning_content` 响应解析保留——其他厂商不返回该字段时自然忽略，天然兼容。

调用链穿透：`agentLoop()` → `callDeepSeekStream()` → `callDeepSeekStreamOnce()` 逐层新增 `supportsThinking` 参数。`streamChat` 同理。

`testConnection` 已通用（标准 `/chat/completions`），不动。

## 6. token 计数

- DeepSeek BPE 分词器（`src/main/deepseek/tokenizer.ts`）保留不动
- 新增 `estimateTokens(text: string, providerId: string): number`：`providerId === 'deepseek'` 走 BPE，否则 `Math.ceil(text.length / 4)` 近似
- API 返回的真实 usage（`normaliseUsage`）显示不受影响

## 7. 数据迁移（`src/main/store.ts`）

`loadSettings` 增加迁移逻辑：

- 若 `settings.providers` 为空/缺失：
  - 用现有 `settings.baseUrl` + `settings.model` + `settings.apiKey` 构造一个 provider：
    - `id: 'deepseek'`（baseUrl 含 `deepseek.com`）或 `id: 'custom-migrated'`（其他 baseUrl）
    - `supportsThinking` 按 baseUrl 是否含 `deepseek.com` 判定
    - `models: [settings.model]`
  - `activeProviderId` 指向该 provider
  - 写回 settings.json
- 老用户配置零丢失

## 8. UI 改动

### 8.1 `ModelTab.tsx` → 改造为「模型服务商」管理页

- 服务商卡片列表：每个卡片显示名称、Base URL、API Key 输入框、模型 chips（可删除）、「设为当前」按钮、「获取模型」按钮
- 预设卡片：可编辑 API Key、模型列表，不可删除
- 「添加自定义服务商」按钮 → 弹窗表单：名称 / Base URL / API Key / 模型列表
- 自定义卡片：可编辑、可删除
- 每个服务商旁保留「测试连接」按钮（复用现有 `chat:test`）

### 8.2 `ModelSelector.tsx` → 两级下拉

- 第一级：服务商（active provider 高亮）
- 第二级：该服务商下的模型列表
- 选择后调用 store 更新：`activeProviderId` + 同步顶层 `model/baseUrl/apiKey`

### 8.3 `ApiTab.tsx`

- 编辑当前服务商的 API Key / Base URL，直接同步到 `activeProvider`，顶层快照同步更新

### 8.4 store（`useStore.ts`）

新增 `switchProvider(providerId, model?)` action：

- 置 `activeProviderId`
- 同步顶层 `baseUrl/apiKey/model`
- 会话不重置

## 9. 获取模型功能

### 9.1 主进程 IPC（新增 `src/main/ipc/providers-handlers.ts`）

```ts
ipcMain.handle('providers:fetchModels', async (_e, baseUrl: string, apiKey: string) => {
  // GET {baseUrl}/models
  // Authorization: Bearer {apiKey}
  // 解析 { data: [{ id }] } → { success, models: string[], error? }
})
```

- 401 → `Key 无效或未授权`
- 404 → `该服务商不支持 /models 端点，请手动输入模型名`
- 网络错误 → 具体错误信息
- 返回的 models 按字母序去重排序

### 9.2 preload（`src/preload/index.ts`）

```ts
providers: {
  fetchModels: (baseUrl, apiKey) => ipcRenderer.invoke('providers:fetchModels', baseUrl, apiKey)
}
```

### 9.3 前端交互

- 自定义服务商表单：模型输入框旁「获取模型」按钮 → 拉取后以可勾选列表展示 → 勾选写入模型列表
- 预设服务商卡片：同样的按钮，拉取后**追加**去重到模型列表（一键同步新增模型）
- 拉取失败：显示错误提示，仍允许手动输入模型名（两种方式并存）

## 10. 改动文件清单

| 文件 | 改动 |
|---|---|
| `src/shared/types/core.ts` | `ModelId` → `string` |
| `src/shared/types/settings.ts` | 新增 `ModelProvider`、`providers`、`activeProviderId` |
| `src/shared/providers.ts` | **新增**：预设常量表 + 构造函数 |
| `src/shared/defaults.ts` | `providers` 默认值（deepseek 预设）、`activeProviderId` |
| `src/main/store.ts` | `loadSettings` 迁移逻辑 |
| `src/main/deepseek/api.ts` | `supportsThinking` 门控 |
| `src/main/deepseek/agent-loop.ts` | 传递 `supportsThinking` |
| `src/main/deepseek/index.ts` | 导出透传 |
| `src/main/ipc/chat-handler.ts` | 从 active provider 取 `apiKey/baseUrl`，toolContext 传递 `supportsThinking` |
| `src/main/ipc/providers-handlers.ts` | **新增**：`providers:fetchModels` |
| `src/main/index.ts` | 注册 providers-handlers |
| `src/main/chat-bridge.ts` | active provider 同步 |
| `src/preload/index.ts` | 暴露 `window.api.providers` |
| `src/main/deepseek/tokenizer.ts` | 新增 `estimateTokens` |
| `src/renderer/src/store/useStore.ts` | `switchProvider` action + 快照同步 |
| `src/renderer/src/components/settings/ModelTab.tsx` | 服务商管理页 |
| `src/renderer/src/components/settings/ApiTab.tsx` | 同步当前服务商编辑 |
| `src/renderer/src/components/chat-input/ModelSelector.tsx` | 两级下拉 |

## 11. 验证方式

1. `npm install` 后跑 `npm run typecheck`（node + web 全绿）
2. 数据迁移：旧 settings.json 启动后 providers 正确生成、原配置保留
3. 连接测试：各预设服务商 `chat:test` 通过
4. 获取模型：自定义服务商拉取列表成功；无效 Key 报错提示
5. 真实对话：DeepSeek 走思考链参数（reasoning_content 正常显示）；切换 OpenAI 兼容服务商后请求体不含 `enable_thinking`，正常流式回复
6. 子 Agent / 监督审查 / Vision 在切换服务商后行为正常

## 12. 风险与回退

| 风险 | 缓解 |
|---|---|
| 部分服务商对未知字段严格（如 Azure 400） | `supportsThinking=false` 时不发送专属字段 |
| 自定义服务商 `/models` 端点缺失 | 错误提示 + 手动输入并存 |
| 顶层快照与 providers 不同步 | store 统一走 `switchProvider`，禁止直接改顶层三字段 |
| 迁移误判 | 仅当 `providers` 缺失时触发，且写入前先构造校验 |
