# ximo-Agent

> DeepSeek-V4 驱动的全能 Agent 桌面工作台 —— 办公 / 编程 / 设计 三模式
>
> 基于 Electron + React + TypeScript，内置完整工具系统、技能录制、MCP 协议支持。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Electron 33 · electron-vite |
| 主进程 | TypeScript (Node.js) |
| 渲染层 | React 18 · Zustand · Tailwind CSS |
| AI | 自实现 DeepSeek 客户端 + 本地 BPE tokenizer |
| 浏览器自动化 | Playwright |
| 录屏回放 | rrweb / rrweb-player |
| Git | simple-git |
| 图表 | mermaid · react-markdown · react-syntax-highlighter |

## 目录结构

```
src/
├── main/                      主进程
│   ├── deepseek/             DeepSeek API 客户端 + Agent 循环 + BPE 分词器
│   ├── tools/                工具系统（核心）
│   │   ├── Browser/          浏览器自动化（点击 / 导航 / 截图 / JS 执行 / 抓包）
│   │   ├── CodeQuality/      代码格式化 / Lint / 依赖检查 / 项目索引
│   │   ├── ComputerUse/      电脑操控（pi-computer-use，含 Windows Helper 桥接）
│   │   ├── Design/           设计系统（130+ 品牌设计 token + 模板 + UI 组件目录）
│   │   ├── FileSystem/       文件 CRUD / 搜索 / TodoWrite
│   │   ├── Git/              Git 操作
│   │   ├── Mcp/              MCP（Model Context Protocol）客户端
│   │   ├── Network/         API 抽取 / JS Hook / 网络抓包 / Storage 检查
│   │   ├── Skill/           技能录制 / 回放 / 调用 + Agent Expert 子代理
│   │   ├── Terminal/        终端命令执行
│   │   ├── Vision/          图像视觉理解
│   │   ├── WebIntelligence/ Web Fetch / Search / Research + 缓存
│   │   ├── Tool.ts          工具抽象基类
│   │   └── ToolRegistry.ts  工具注册表（单例）
│   ├── ipc/                  IPC 处理器（chat / fs / network 分模块）
│   └── *.ts                  Store 模块（settings / conversations / skills / mcp / memory / checkpoint）
├── preload/                   预加载脚本（contextBridge）
└── renderer/                 React UI（含 100+ UI 预览组件库）
```

## 开发命令

```bash
npm run dev          # 启动开发模式（electron-vite dev）
npm run build        # 构建产物到 out/
npm run build:win    # 打包 Windows NSIS 安装包到 release/
npm run typecheck    # 类型检查（node + web）
npm run make-icon    # 重新生成图标
npm run gen-previews # 重新生成 UI 组件预览
```

## 核心特性

- **三模式工作台**：办公 / 编程 / 设计，每模式独立记忆与提示词
- **完整工具系统**：单例 `toolRegistry` 统一管理，向 LLM 暴露 `ToolDefinition[]`
- **内嵌 DeepSeek Agent Loop**：自实现工具调用循环 + 本地 BPE 分词器精确计 token
- **Checkpoint 系统**：会话级代码检查点，支持回滚到指定 turn
- **技能系统**：rrweb 录制 → 回放 → 调用；支持导入 SKILL.md 格式技能
- **MCP 协议支持**：可挂载外部 MCP 服务器扩展工具能力
- **130+ 设计系统**：苹果 / Stripe / Notion 等品牌设计 token，实现"按品牌风格生成 UI"
- **GPU 硬件加速**：Windows 上强制启用 D3D11 / 独显 / 零拷贝光栅化
- **安全沙箱**：`contextIsolation: true` + `nodeIntegration: false` + 外部链接白名单

## 扩展点

### 新增工具

1. 在 `src/main/tools/<域>/` 下新建 `XxxTool.ts`，实现 `Tool` 接口（见 [Tool.ts](src/main/tools/Tool.ts)）
2. 在该域的 `index.ts` 中导出
3. 在工具注册流程中注册到 `toolRegistry`

### 新增模式

1. 在 `shared/types.ts` 的 `Mode` 联合类型中追加
2. 在 `src/main/store.ts` 的 memory 逻辑中加入新模式
3. 在渲染层 prompts 中定义该模式系统提示词

### 接入 MCP 服务器

通过设置面板的 MCP 配置区添加 `McpServerConfig`，由 [McpClient.ts](src/main/tools/Mcp/McpClient.ts) 桥接为工具暴露给 LLM。

## 配置与约定

- 行为规范：见 [AGENTS.md](AGENTS.md)（编码前必读，含文件拆分硬性规则）
- 设置 / 会话 / 技能存储位置：`%APPDATA%/ximo-agent/`（Windows）
- 路径别名：渲染层 `@renderer` → `src/renderer/src`
- 构建：`electron.vite.config.ts` 中 `copyStaticAssets` 插件负责复制 design-systems / tokenizer 等非 JS 资源

## 致谢

本项目在开发过程中参考或使用了以下开源项目，特此致谢：

- [react-bits] — UI 动效组件库，渲染层动画组件的重要参考
- [open-design] — 开放设计系统，Design 工具品牌 token 体系的灵感来源
- [pi-computer-use] — 电脑操控能力，ComputerUse 工具的底层桥接
- [Reasonix] — Agent 编程能力
