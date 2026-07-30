import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import type { AppSettings, Conversation, Skill, McpServerConfig, ImportedSkill, Mode } from '../shared/types'
import { loadSettings, saveSettings, loadConversations, saveConversations, loadMemory, saveMemory } from './store'
import { loadSkills, saveSkills, startRecording, stopRecording, isRecording, getRecordingSession, getRrwebEventCount } from './SkillStore'
import { loadMcpServers, saveMcpServers, parseMcpConfig } from './McpStore'
import { loadImportedSkills, saveImportedSkills, parseSkillMarkdown } from './ImportedSkillStore'
import { getCheckpointStore, removeCheckpointStore } from './CheckpointStore'
import { registerChatHandlers } from './ipc/chat-handler'
import { registerFsHandlers } from './ipc/fs-handlers'
import { registerNetworkHandlers } from './ipc/network-handlers'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ---------- GPU 硬件加速 ----------
// 必须在 app.whenReady() 之前设置，Chromium GPU 进程启动时读取
// 从设置文件同步读取开关状态（默认开启）
function isGpuAccelerationEnabled(): boolean {
  try {
    const { readFileSync, existsSync } = require('fs')
    const settingsPath = join(app.getPath('userData'), 'ximo-agent', 'settings.json')
    if (!existsSync(settingsPath)) return true
    const raw = readFileSync(settingsPath, 'utf-8')
    const settings = JSON.parse(raw)
    return settings.gpuAcceleration !== false
  } catch {
    return true // 读取失败时默认开启
  }
}

if (isGpuAccelerationEnabled()) {
  // 忽略 GPU 黑名单，强制启用硬件加速（部分旧驱动会被 Chromium 默认禁用）
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
  // 启用 GPU 光栅化 — 将 CSS 像素绘制交给 GPU 而非 CPU
  app.commandLine.appendSwitch('enable-gpu-rasterization')
  // 启用零拷贝光栅化 — 减少 GPU 内存拷贝，提升渲染吞吐量
  app.commandLine.appendSwitch('enable-zero-copy')
  // 禁用软件光栅化回退 — 确保使用 GPU 渲染，避免静默降级到 CPU
  app.commandLine.appendSwitch('disable-software-rasterizer')

  if (process.platform === 'win32') {
    // Windows: 使用 Direct3D 11 作为 ANGLE 图形后端（性能最佳）
    app.commandLine.appendSwitch('use-angle', 'd3d11')
    // 强制使用高性能 GPU（独显优先，无独显时自动回退到核显）
    app.commandLine.appendSwitch('force_high_performance_gpu')
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#090b10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      backgroundThrottling: false,
      spellcheck: false,
      paintWhenInitiallyHidden: true
    }
  })

  // 窗口由 window:ready IPC 触发显示（渲染进程首帧完成后通知）
  // backgroundColor + paintWhenInitiallyHidden 确保 DWM 在 show 时已有深色内容，
  // 不会出现黑窗闪烁

  // 安全兜底：5 秒后若渲染进程仍未通知，强制显示（防止 JS 异常导致永久白屏）
  const showFallback = setTimeout(() => {
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  }, 5000)

  ipcMain.handle('window:ready', () => {
    clearTimeout(showFallback)
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  })

  // 监听窗口最大化/还原状态变化，通知渲染进程
  mainWindow.on('maximize', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximizeChange', true)
    }
  })
  mainWindow.on('unmaximize', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximizeChange', false)
    }
  })

  // 外部链接用系统浏览器打开（仅允许 http/https 协议，防止恶意协议调用）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url)
      }
    } catch { /* 无效 URL，忽略 */ }
    return { action: 'deny' }
  })

  // 渲染进程崩溃恢复
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] 渲染进程崩溃:', details.reason)
    if (details.reason !== 'clean-exit' && !mainWindow.isDestroyed()) {
      mainWindow.reload()
    }
  })

  // 开发环境加载 dev server，生产环境加载打包文件
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---------- IPC 处理 ----------

// 窗口控制
ipcMain.handle('window:minimize', () => {
  BrowserWindow.getFocusedWindow()?.minimize()
})
ipcMain.handle('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  }
})
ipcMain.handle('window:close', () => {
  BrowserWindow.getFocusedWindow()?.close()
})
ipcMain.handle('window:isMaximized', () => {
  return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false
})

// 设置读写
ipcMain.handle('settings:load', () => loadSettings())
ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
  await saveSettings(settings)
  return true
})

// 对话框
ipcMain.handle('dialog:openFolder', async () => {
  const { dialog } = await import('electron')
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0] ?? null
})
ipcMain.handle('dialog:openFile', async (_event, filters?: { name: string; extensions: string[] }[]) => {
  const { dialog } = await import('electron')
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  })
  return result.canceled ? [] : result.filePaths
})

// 剪贴板图片保存到 userData/pasted-images — 避免 Windows 8.3 短路径导致工具无法读取
ipcMain.handle('clipboard:saveImage', async () => {
  const { clipboard, app } = await import('electron')
  const { join } = await import('path')
  const { writeFile, mkdir } = await import('fs/promises')

  const image = clipboard.readImage()
  if (image.isEmpty()) return null

  const imgDir = join(app.getPath('userData'), 'pasted-images')
  await mkdir(imgDir, { recursive: true })

  const filename = `clip_${Date.now()}.png`
  const filePath = join(imgDir, filename)
  await writeFile(filePath, image.toPNG())

  return filePath
})

// 删除粘贴的临时图片 — 任务结束后用户选择清理时调用
ipcMain.handle('clipboard:deleteImages', async (_event, paths: string[]) => {
  const { unlink } = await import('fs/promises')
  await Promise.allSettled(paths.map((p: string) => unlink(p)))
  return { success: true }
})

// 会话读写
ipcMain.handle('conversations:load', () => loadConversations())
ipcMain.handle('conversations:save', async (_event, conversations: Conversation[]) => {
  await saveConversations(conversations)
  return true
})

// 技能读写
ipcMain.handle('skills:load', () => loadSkills())
ipcMain.handle('skills:save', async (_event, skills: Skill[]) => {
  await saveSkills(skills)
  return true
})
ipcMain.handle('skills:recordingStatus', () => ({
  isRecording: isRecording(),
  session: getRecordingSession(),
  rrwebEventCount: getRrwebEventCount()
}))
ipcMain.handle('skills:startRecording', (_event, url?: string) => startRecording(url))
ipcMain.handle('skills:stopRecording', () => stopRecording())

// MCP 服务器配置读写
ipcMain.handle('mcp:load', () => loadMcpServers())
ipcMain.handle('mcp:save', async (_event, servers: McpServerConfig[]) => {
  await saveMcpServers(servers)
  return true
})
ipcMain.handle('mcp:parseConfig', (_event, raw: string) => parseMcpConfig(raw))

// 导入技能（SKILL.md 格式）读写
ipcMain.handle('imported-skills:load', () => loadImportedSkills())
ipcMain.handle('imported-skills:save', async (_event, skills: ImportedSkill[]) => {
  await saveImportedSkills(skills)
  return true
})
ipcMain.handle('imported-skills:parseMarkdown', (_event, raw: string) => parseSkillMarkdown(raw))

// pi-computer-use Helper 状态查询
ipcMain.handle('pi-helper:status', async () => {
  const { piBridge, WINDOWS_HELPER_PATH } = await import('./tools/ComputerUse/PiBridge')
  try {
    await piBridge.ensureReady()
    return { ready: true, path: WINDOWS_HELPER_PATH }
  } catch (e) {
    return { ready: false, error: (e as Error).message, path: WINDOWS_HELPER_PATH }
  }
})

ipcMain.handle('terminal:execute', async (_event, command: string, cwd?: string) => {
  const { spawn } = await import('child_process')
  const isWin = process.platform === 'win32'
  const shell = isWin ? 'powershell.exe' : '/bin/sh'
  const shellArgs = isWin ? ['-NoProfile', '-Command', command] : ['-c', command]
  return new Promise((resolve) => {
    const child = spawn(shell, shellArgs, {
      cwd: cwd || undefined,
      windowsHide: true,
      timeout: 30000
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (data: Buffer) => { stdout += data.toString('utf-8') })
    child.stderr?.on('data', (data: Buffer) => { stderr += data.toString('utf-8') })
    child.on('close', (exitCode: number | null) => {
      const code = exitCode ?? 0
      resolve({
        stdout: stdout || '',
        stderr: stderr || (code !== 0 ? `Command exited with code ${code}` : ''),
        exitCode: code
      })
    })
    child.on('error', (err: Error) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || err.message,
        exitCode: 1
      })
    })
  })
})

// 技能录制保存（内嵌浏览器模式）
ipcMain.handle('skill-recording:save', async (_event, data: {
  name: string
  description: string
  steps: Array<{ tool: string; arguments: Record<string, unknown>; timestamp: number; description?: string }>
  apiEndpoints: string[]
  startUrl?: string
}) => {
  const skill: Skill = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: data.name,
    description: data.description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    invokeCount: 0,
    steps: data.steps,
    apiEndpoints: data.apiEndpoints,
    tags: [],
    source: 'recorded',
    startUrl: data.startUrl
  }

  const skills = await loadSkills()
  skills.unshift(skill)
  await saveSkills(skills)

  return { success: true, skill }
})

// 操控电脑（pi-computer-use）启停
ipcMain.handle('computer-use:start', async () => {
  try {
    const { piBridge } = await import('./tools/ComputerUse/PiBridge')
    await piBridge.ensureReady()
    return { success: true, running: true }
  } catch (e) {
    return { success: false, running: false, error: (e as Error).message }
  }
})

ipcMain.handle('computer-use:stop', async () => {
  try {
    const { piBridge } = await import('./tools/ComputerUse/PiBridge')
    piBridge.dispose()
    return { success: true, running: false }
  } catch {
    return { success: true, running: false }
  }
})

ipcMain.handle('computer-use:status', async () => {
  const { piBridge } = await import('./tools/ComputerUse/PiBridge')
  return { running: piBridge.ready }
})

// 系统字体
ipcMain.handle('fonts:list', async () => {
  try {
    const { execSync } = await import('child_process')
    // PowerShell 获取系统已安装字体名
    const ps = `Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }`
    const out = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf-8', timeout: 10000 })
    return out.split(/\r?\n/).map(f => f.trim()).filter(Boolean)
  } catch {
    return []
  }
})

// Checkpoint 系统
ipcMain.handle('checkpoint:list', async (_event, sessionId: string) => {
  const store = getCheckpointStore(sessionId)
  return { success: true, checkpoints: store.list() }
})

ipcMain.handle('checkpoint:restore', async (_event, sessionId: string, fromTurn: number) => {
  const store = getCheckpointStore(sessionId)
  const result = await store.restoreCode(fromTurn)
  return { success: true, ...result }
})

ipcMain.handle('checkpoint:bounds', async (_event, sessionId: string) => {
  const store = getCheckpointStore(sessionId)
  const bounds: Record<number, number> = {}
  for (const [turn, idx] of store.bounds()) {
    bounds[turn] = idx
  }
  return { success: true, bounds }
})

ipcMain.handle('checkpoint:clear', async (_event, sessionId: string) => {
  await removeCheckpointStore(sessionId)
  return { success: true }
})

// ---------- 模式记忆读写 ----------
ipcMain.handle('memory:load', async (_event, mode: Mode) => {
  return loadMemory(mode)
})
ipcMain.handle('memory:save', async (_event, mode: Mode, content: string) => {
  await saveMemory(mode, content)
  return true
})

// ---------- DeepSeek Tokenizer ----------
ipcMain.handle('tokenizer:count', async (_event, text: string) => {
  try {
    const { countTokens } = await import('./deepseek/tokenizer')
    return { success: true, count: countTokens(text) }
  } catch (e) {
    return { success: false, count: 0, error: (e as Error).message }
  }
})

ipcMain.handle('tokenizer:countMessages', async (_event, messages: { role: string; content: string }[]) => {
  try {
    const { countMessageTokens } = await import('./deepseek/tokenizer')
    return { success: true, count: countMessageTokens(messages) }
  } catch (e) {
    return { success: false, count: 0, error: (e as Error).message }
  }
})

// ---------- 注册拆分到独立文件的 IPC 处理器 ----------
registerChatHandlers()
registerFsHandlers()
registerNetworkHandlers()

// 全局异常兜底，防止未捕获异常导致应用崩溃
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled Rejection:', reason)
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // 关闭 pi-computer-use Helper
  import('./tools/ComputerUse/PiBridge').then(({ piBridge }) => piBridge.dispose()).catch(() => {})
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
