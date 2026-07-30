import type { Tool } from '../Tool'
import type { ToolDefinition, ToolCall, ToolResult, StreamChunk } from '../../../shared/types'
import { BrowserManager } from './BrowserManager'
import { isEmbeddedBrowserActive, executeWebviewCommand } from './WebviewBridge'
import { cleanBrowserError } from './index'

export class BrowserTypeTool implements Tool {
  readonly definition: ToolDefinition = {
    name: 'browser_type',
    description: '在输入框中输入文本。会先清空输入框再填入。支持 CSS 选择器定位输入框。',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: '输入框的 CSS 选择器，如 "#email", "input[name=\'q\']"' },
        text: { type: 'string', description: '要输入的文本' }
      },
      required: ['selector', 'text']
    }
  }

  async execute(toolCall: ToolCall, onChunk?: (chunk: StreamChunk) => void, _signal?: AbortSignal): Promise<ToolResult> {
    const selector = (toolCall.arguments.selector as string) || ''
    const text = (toolCall.arguments.text as string) || ''
    if (!selector) return this.error(toolCall.id, '缺少 selector 参数')
    if (!text) return this.error(toolCall.id, '缺少 text 参数')

    onChunk?.({ toolStatus: 'calling', toolName: 'browser_type' })

    try {
      // 优先使用内嵌浏览器
      if (isEmbeddedBrowserActive()) {
        const result = await executeWebviewCommand('type', { selector, text }) as boolean
        if (!result) {
          return this.error(toolCall.id, `未找到输入框：${selector}`)
        }
        return {
          toolCallId: toolCall.id, toolName: 'browser_type',
          content: `已在内嵌浏览器中的 "${selector}" 输入：${text.slice(0, 100)}`,
          success: true, displayType: 'text',
          metadata: { selector, textLength: text.length, embedded: true }
        }
      }

      // 回退到 Playwright
      const page = await BrowserManager.getInstance().getPage()
      await page.locator(selector).first().fill(text, { timeout: 10000 })
      return {
        toolCallId: toolCall.id, toolName: 'browser_type',
        content: `已在 "${selector}" 中输入：${text.slice(0, 100)}`,
        success: true, displayType: 'text',
        metadata: { selector, textLength: text.length }
      }
    } catch (e) {
      return this.error(toolCall.id, `输入失败：${cleanBrowserError((e as Error).message)}`)
    }
  }

  private error(id: string, msg: string): ToolResult {
    return { toolCallId: id, toolName: 'browser_type', content: '', success: false, error: msg }
  }
}
