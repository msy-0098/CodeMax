export { BrowserManager } from './BrowserManager'
export { BrowserNavigateTool } from './BrowserNavigateTool'
export { BrowserScreenshotTool } from './BrowserScreenshotTool'
export { BrowserClickTool } from './BrowserClickTool'
export { BrowserTypeTool } from './BrowserTypeTool'
export { BrowserGetContentTool } from './BrowserGetContentTool'
export { BrowserExecuteJSTool } from './BrowserExecuteJSTool'
export { BrowserNetworkTool } from './BrowserNetworkTool'

/**
 * 清理 Playwright 原始错误消息，提取核心信息。
 * Playwright 的 "Executable doesn't exist" 错误包含大量 ASCII 框线字符和提示，
 * 直接展示给用户会造成 UI 污染。
 */
export function cleanBrowserError(rawMsg: string): string {
  // Playwright "Executable doesn't exist" 错误
  if (rawMsg.includes("Executable doesn't exist")) {
    return 'Playwright 浏览器未安装。请在终端执行 `npx playwright install chromium`，或在右侧面板开启内嵌浏览器。'
  }
  // 截断过长的错误消息（保留前 200 字符）
  if (rawMsg.length > 200) {
    return rawMsg.slice(0, 200) + '…'
  }
  return rawMsg
}
