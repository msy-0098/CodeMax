import { BrowserWindow, ipcMain } from 'electron'
import type { AppSettings, Conversation, Skill, CapturedRequest, McpServerConfig, ImportedSkill, FileTreeNode, Mode } from '../shared/types'
import { loadSettings, saveSettings, loadConversations, saveConversations, loadMemory, saveMemory } from './store'
import { loadSkills, saveSkills, startRecording, stopRecording, isRecording, getRecordingSession, getRrwebEventCount } from './SkillStore'
import { loadMcpServers, saveMcpServers, parseMcpConfig } from './McpStore'
import { loadImportedSkills, saveImportedSkills, parseSkillMarkdown } from './ImportedSkillStore'
import { getCheckpointStore, removeCheckpointStore } from './CheckpointStore'

// 抓包状态
let networkCapturing = false
let capturedRequests: CapturedRequest[] = []
let maxCaptured = 500
const EMBEDDED_PARTITION = 'embedded-browser'

/** 注册所有非聊天类的 IPC handler */
export function registerIpcHandlers(): void {
  // ---- 窗口控制 ----
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

  // ---- 设置读写 ----
  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
    await saveSettings(settings)
    return true
  })

  // ---- 对话框 ----
  ipcMain.handle('dialog:openFolder', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
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

  // ---- 会话读写 ----
  ipcMain.handle('conversations:load', () => loadConversations())
  ipcMain.handle('conversations:save', async (_event, conversations: Conversation[]) => {
    await saveConversations(conversations)
    return true
  })

  // ---- 技能读写 ----
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

  // ---- MCP 服务器配置读写 ----
  ipcMain.handle('mcp:load', () => loadMcpServers())
  ipcMain.handle('mcp:save', async (_event, servers: McpServerConfig[]) => {
    await saveMcpServers(servers)
    return true
  })
  ipcMain.handle('mcp:parseConfig', (_event, raw: string) => parseMcpConfig(raw))

  // ---- 导入技能（SKILL.md 格式）读写 ----
  ipcMain.handle('imported-skills:load', () => loadImportedSkills())
  ipcMain.handle('imported-skills:save', async (_event, skills: ImportedSkill[]) => {
    await saveImportedSkills(skills)
    return true
  })
  ipcMain.handle('imported-skills:parseMarkdown', (_event, raw: string) => parseSkillMarkdown(raw))

  // ---- pi-computer-use Helper 状态查询 ----
  ipcMain.handle('pi-helper:status', async () => {
    const { piBridge, WINDOWS_HELPER_PATH } = await import('./tools/ComputerUse/PiBridge')
    try {
      await piBridge.ensureReady()
      return { ready: true, path: WINDOWS_HELPER_PATH }
    } catch (e) {
      return { ready: false, error: (e as Error).message, path: WINDOWS_HELPER_PATH }
    }
  })

  // ---- 终端命令执行 ----
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

  // ---- 文件系统：目录列表 ----
  ipcMain.handle('fs:listDir', async (_event, dirPath: string, maxDepth?: number) => {
    const { readdir, stat } = await import('fs/promises')
    const { join } = await import('path')
    const depth = Math.min(maxDepth ?? 3, 5)

    const excludeDirs = new Set([
      'node_modules', '.git', '.svn', 'dist', 'out', 'build', 'release',
      '.next', '.nuxt', 'coverage', '__pycache__', '.cache', '.idea', '.vscode',
      '.reasonix', '.trae', '.meituan-catpaw'
    ])

    async function buildTree(dir: string, currentDepth: number): Promise<FileTreeNode[]> {
      if (currentDepth >= depth) return []
      const nodes: FileTreeNode[] = []
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (excludeDirs.has(entry.name)) continue
          if (entry.name.startsWith('.') && entry.name !== '.gitignore' && entry.name !== '.env.example') continue
          const fullPath = join(dir, entry.name)
          const isDir = entry.isDirectory()
          let size: number | undefined
          if (!isDir) {
            try { size = (await stat(fullPath)).size } catch { /* skip */ }
          }
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: isDir ? 'directory' : 'file',
            size,
            children: isDir ? await buildTree(fullPath, currentDepth + 1) : undefined
          })
        }
      } catch { /* 无权限或不存在 */ }
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return nodes
    }

    return buildTree(dirPath, 0)
  })

  // ---- 文件系统：读取文件内容 ----
  ipcMain.handle('fs:readFileContent', async (_event, filePath: string, maxLines?: number) => {
    const { readFile } = await import('fs/promises')
    const { resolve, normalize } = await import('path')
    const { existsSync } = await import('fs')

    const normalized = normalize(resolve(filePath))
    if (!existsSync(normalized)) {
      return { success: false, error: `文件不存在：${normalized}` }
    }
    try {
      const buffer = await readFile(normalized)
      if (buffer.length > 2 * 1024 * 1024) {
        return { success: false, error: `文件过大 (${(buffer.length / 1024).toFixed(0)}KB)，超过 2MB 限制` }
      }
      let content = buffer.toString('utf-8')
      const totalLines = content.split('\n').length
      const limit = maxLines ?? 500
      if (limit > 0 && totalLines > limit) {
        content = content.split('\n').slice(0, limit).join('\n') + `\n...(仅显示前 ${limit} 行，共 ${totalLines} 行)`
      }
      return { success: true, content, totalLines, filePath: normalized }
    } catch (e) {
      return { success: false, error: `读取失败：${(e as Error).message}` }
    }
  })

  // ---- 文件系统：恢复文件快照 ----
  ipcMain.handle('fs:revertFile', async (_event, snapshotPath: string, targetPath: string) => {
    const { copyFile } = await import('fs/promises')
    const { existsSync } = await import('fs')
    const { resolve, normalize } = await import('path')

    const snap = normalize(resolve(snapshotPath))
    const target = normalize(resolve(targetPath))
    if (!existsSync(snap)) {
      return { success: false, error: `快照不存在：${snap}` }
    }
    try {
      await copyFile(snap, target)
      return { success: true, message: `已恢复：${target}` }
    } catch (e) {
      return { success: false, error: `恢复失败：${(e as Error).message}` }
    }
  })

  // ---- 文件系统：列出文件快照 ----
  ipcMain.handle('fs:listSnapshots', async (_event, targetFilePath?: string) => {
    const { readdir, stat } = await import('fs/promises')
    const { join, basename } = await import('path')
    const { tmpdir } = await import('os')

    const snapDir = join(tmpdir(), 'ximo-agent-snapshots')
    try {
      const files = await readdir(snapDir)
      const snapshots: Array<{ name: string; path: string; size: number; mtime: number }> = []
      for (const name of files) {
        if (!name.endsWith('.bak')) continue
        const fullPath = join(snapDir, name)
        try {
          const s = await stat(fullPath)
          if (targetFilePath) {
            const targetBase = basename(targetFilePath).replace(/[^\w.-]/g, '_')
            if (!name.startsWith(targetBase)) continue
          }
          snapshots.push({ name, path: fullPath, size: s.size, mtime: s.mtime.getTime() })
        } catch { /* skip */ }
      }
      snapshots.sort((a, b) => b.mtime - a.mtime)
      return { success: true, snapshots }
    } catch {
      return { success: true, snapshots: [] }
    }
  })

  // ---- 设计组件库：读取组件源码 ----
  ipcMain.handle('design:readComponent', async (_event, category: string, componentId: string) => {
    const { readFileSync, readdirSync, existsSync } = await import('fs')
    const { join, dirname } = await import('path')

    const mainDir = dirname(new URL(import.meta.url).pathname.replace(/^\//, ''))
    const candidates = [
      join(mainDir, 'tools/Design/ui-components'),
      join(mainDir, 'ui-components'),
      join(process.cwd(), 'src/main/tools/Design/ui-components'),
    ]
    let baseDir = ''
    for (const p of candidates) {
      if (existsSync(p)) { baseDir = p; break }
    }
    if (!baseDir) return { success: false, error: 'ui-components 目录未找到', jsx: '', css: '' }

    const compDir = join(baseDir, category, componentId)
    if (!existsSync(compDir)) return { success: false, error: `组件不存在: ${category}/${componentId}`, jsx: '', css: '' }

    try {
      const files = readdirSync(compDir)
      const jsxFile = files.find(f => f.endsWith('.jsx'))
      const cssFile = files.find(f => f.endsWith('.css'))
      const jsx = jsxFile ? readFileSync(join(compDir, jsxFile), 'utf8') : ''
      const css = cssFile ? readFileSync(join(compDir, cssFile), 'utf8') : ''
      return { success: true, jsx, css }
    } catch (err) {
      return { success: false, error: String(err), jsx: '', css: '' }
    }
  })

  // ---- 内嵌浏览器网络抓包 ----
  ipcMain.handle('network-capture:start', async () => {
    if (networkCapturing) return
    const settings = await loadSettings()
    maxCaptured = settings.maxCapturedRequests ?? 500
    const { session } = await import('electron')
    const ses = session.fromPartition(EMBEDDED_PARTITION)

    networkCapturing = true
    capturedRequests = []

    ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details) => {
      if (!networkCapturing) return
      const apiTypes = ['xhr', 'fetch']
      if (!apiTypes.includes(details.resourceType)) return
      const req: CapturedRequest = {
        id: String(details.id),
        url: details.url,
        method: details.method,
        resourceType: details.resourceType,
        timestamp: details.timestamp
      }
      capturedRequests.push(req)
      if (capturedRequests.length > maxCaptured) {
        capturedRequests = capturedRequests.slice(-maxCaptured)
      }
    })

    ses.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
      if (!networkCapturing) return
      const req = capturedRequests.find((r) => r.id === String(details.id))
      if (req) {
        req.statusCode = details.statusCode
        req.completedAt = details.timestamp
        req.duration = details.timestamp - req.timestamp
      }
    })

    return { success: true }
  })

  ipcMain.handle('network-capture:stop', async () => {
    networkCapturing = false
    const { session } = await import('electron')
    const ses = session.fromPartition(EMBEDDED_PARTITION)
    ses.webRequest.onBeforeRequest(null)
    ses.webRequest.onCompleted(null)
    return { success: true }
  })

  ipcMain.handle('network-capture:get', async () => {
    return capturedRequests
  })

  ipcMain.handle('network-capture:clear', async () => {
    capturedRequests = []
    return { success: true }
  })

  // ---- 技能录制保存（内嵌浏览器模式） ----
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

  // ---- 模式记忆读写 ----
  ipcMain.handle('memory:load', async (_event, mode: Mode) => {
    return loadMemory(mode)
  })
  ipcMain.handle('memory:save', async (_event, mode: Mode, content: string) => {
    await saveMemory(mode, content)
    return true
  })

  // ---- 操控电脑（pi-computer-use）启停 ----
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

  // ---- 系统字体 ----
  ipcMain.handle('fonts:list', async () => {
    try {
      const { execSync } = await import('child_process')
      const ps = `Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }`
      const out = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf-8', timeout: 10000 })
      return out.split(/\r?\n/).map(f => f.trim()).filter(Boolean)
    } catch {
      return []
    }
  })

  // ---- Checkpoint 系统 ----
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
}
