import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'

/**
 * WebviewBridge — 主进程与内嵌浏览器 webview 之间的命令桥
 *
 * 工作流程：
 * 1. Agent 调用浏览器工具（browser_navigate, browser_click 等）
 * 2. 工具检查内嵌浏览器是否激活
 * 3. 如果激活，通过此桥向渲染进程发送命令
 * 4. 渲染进程在 webview 上执行命令并返回结果
 * 5. 主进程将结果返回给工具
 */

let embeddedBrowserActive = false

interface PendingCommand {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

const pendingCommands = new Map<string, PendingCommand>()
const COMMAND_TIMEOUT = 15_000

// 监听渲染进程返回的结果
ipcMain.on('webview:result', (_event, data: { id: string; success: boolean; result?: unknown; error?: string }) => {
  const pending = pendingCommands.get(data.id)
  if (!pending) return
  pendingCommands.delete(data.id)
  clearTimeout(pending.timer)
  if (data.success) {
    pending.resolve(data.result)
  } else {
    pending.reject(new Error(data.error || 'Webview 命令执行失败'))
  }
})

// 渲染进程通知内嵌浏览器开关状态
ipcMain.handle('embedded-browser:set-active', (_event, active: boolean) => {
  embeddedBrowserActive = active
  // 关闭时清理所有挂起的命令
  if (!active) {
    for (const [, pending] of pendingCommands) {
      clearTimeout(pending.timer)
      pending.reject(new Error('内嵌浏览器已关闭'))
    }
    pendingCommands.clear()
  }
  return { success: true }
})

/** 内嵌浏览器是否激活 */
export function isEmbeddedBrowserActive(): boolean {
  return embeddedBrowserActive
}

/**
 * 向内嵌浏览器发送命令并等待结果
 * @param cmd 命令名称（navigate, click, type, executeJS, getContent, getTitle, getURL, screenshot, back, forward, reload）
 * @param args 命令参数
 * @returns 命令执行结果
 */
export async function executeWebviewCommand(
  cmd: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  if (!embeddedBrowserActive) {
    throw new Error('内嵌浏览器未激活')
  }

  // 优先使用焦点窗口，回退到第一个可用窗口
  let win = BrowserWindow.getFocusedWindow()
  if (!win || win.isDestroyed()) {
    const all = BrowserWindow.getAllWindows()
    win = all.find((w) => !w.isDestroyed()) || null
  }
  if (!win) {
    throw new Error('无法找到活动窗口')
  }

  const id = randomUUID()

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(id)
      reject(new Error(`Webview 命令 '${cmd}' 超时（${COMMAND_TIMEOUT}ms）`))
    }, COMMAND_TIMEOUT)

    pendingCommands.set(id, { resolve, reject, timer })
    win.webContents.send('webview:command', { id, cmd, args })
  })
}
