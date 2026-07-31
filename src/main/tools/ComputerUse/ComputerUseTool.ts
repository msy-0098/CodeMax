import type { Tool } from '../Tool'
import type { ToolDefinition, ToolCall, ToolResult, StreamChunk } from '../../../shared/types'
import { piBridge } from './PiBridge'

/**
 * ComputerUseTool — 一体化桌面操控工具
 *
 * 合并了 find_roots / observe_ui / search_ui / act_ui / wait_for 五个工具为一个，
 * Agent 只需一次调用就能完成"观察 → 定位 → 操作 → 验证"全流程。
 *
 * 同时新增直接鼠标键盘控制：
 * - mouse_move / mouse_click / mouse_drag — 直接坐标操控
 * - key_press / key_type — 直接键盘输入
 * - screenshot — 截屏查看
 *
 * action 参数决定执行哪种操作，一步到位，无需多轮工具往返。
 */
export class ComputerUseTool implements Tool {
  readonly definition: ToolDefinition = {
    name: 'computer_use',
    description:
      '一体化桌面操控工具，合并观察、定位、操作、验证为一次调用。通过 action 参数指定操作类型（screenshot/observe/find_window/click_element/set_text/read_text/mouse_click/mouse_move/mouse_drag/mouse_scroll/key_press/key_type/wait）。\n操作策略：screenshot 看屏幕 → observe 获取 @e 元素引用 → click_element/set_text 语义操作（不生效时 mouse_click 坐标兜底）→ key_type 输入文本 / key_press 快捷键。一步能完成的不拆多步。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '操作类型',
          enum: [
            'screenshot', 'observe', 'find_window',
            'click_element', 'set_text', 'read_text',
            'mouse_click', 'mouse_move', 'mouse_drag', 'mouse_scroll',
            'key_press', 'key_type',
            'wait'
          ]
        },
        // 感知类参数
        window: { type: 'string', description: 'observe/find_window: 窗口引用(@rN)或标题关键词', default: '' },
        // 操作类参数
        ref: { type: 'string', description: 'click_element/set_text/read_text: UI 元素引用(@eN)', default: '' },
        text: { type: 'string', description: 'set_text/key_type: 要输入的文本', default: '' },
        // 直接操控参数
        x: { type: 'number', description: 'mouse_click/mouse_move/mouse_scroll: X 坐标', default: 0 },
        y: { type: 'number', description: 'mouse_click/mouse_move/mouse_scroll: Y 坐标', default: 0 },
        button: { type: 'string', description: 'mouse_click: 鼠标按钮', enum: ['left', 'right', 'middle'], default: 'left' },
        clickCount: { type: 'number', description: 'mouse_click: 点击次数', default: 1 },
        path: {
          type: 'array',
          description: 'mouse_drag: 拖拽路径坐标数组',
          items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } }
        },
        scrollX: { type: 'number', description: 'mouse_scroll: 水平滚动量', default: 0 },
        scrollY: { type: 'number', description: 'mouse_scroll: 垂直滚动量', default: 0 },
        keys: {
          type: 'array',
          description: 'key_press: 按键组合，如 ["Ctrl","S"] 或 ["Enter"]',
          items: { type: 'string' }
        },
        // wait 参数
        until: { type: 'string', description: 'wait: 条件方向 present(出现)/absent(消失)', enum: ['present', 'absent'], default: 'present' },
        timeoutMs: { type: 'number', description: 'wait: 超时毫秒数', default: 10000 },
        // 通用
        stateId: { type: 'string', description: 'UI 状态 ID（observe 返回），用于引用绑定', default: '' }
      },
      required: ['action']
    }
  }

  async execute(
    toolCall: ToolCall,
    onChunk?: (chunk: StreamChunk) => void,
    _signal?: AbortSignal
  ): Promise<ToolResult> {
    const action = (toolCall.arguments.action as string) || ''
    onChunk?.({ toolStatus: 'calling', toolName: 'computer_use' })

    try {
      switch (action) {
        // ── 感知类 ──
        case 'screenshot':
          return await this.doScreenshot(toolCall)
        case 'observe':
          return await this.doObserve(toolCall)
        case 'find_window':
          return await this.doFindWindow(toolCall)

        // ── 语义操作类 ──
        case 'click_element':
          return await this.doClickElement(toolCall)
        case 'set_text':
          return await this.doSetText(toolCall)
        case 'read_text':
          return await this.doReadText(toolCall)

        // ── 直接鼠标控制 ──
        case 'mouse_click':
          return await this.doMouseClick(toolCall)
        case 'mouse_move':
          return await this.doMouseMove(toolCall)
        case 'mouse_drag':
          return await this.doMouseDrag(toolCall)
        case 'mouse_scroll':
          return await this.doMouseScroll(toolCall)

        // ── 直接键盘控制 ──
        case 'key_press':
          return await this.doKeyPress(toolCall)
        case 'key_type':
          return await this.doKeyType(toolCall)

        // ── 验证类 ──
        case 'wait':
          return await this.doWait(toolCall)

        default:
          return this.error(toolCall.id, `未知操作类型: ${action}`)
      }
    } catch (e) {
      return this.error(toolCall.id, `操控失败 [${action}]：${(e as Error).message}`)
    }
  }

  // ── 感知类实现 ──

  private async doScreenshot(toolCall: ToolCall): Promise<ToolResult> {
    const result = await piBridge.command<Record<string, unknown>>('look', {
      readText: 'never',
      includeImage: true,
      maxDimension: 1280
    }, 15_000)

    const image = result?.image
    const stateId = result?.stateId || ''
    const outline = result?.outline

    const lines = ['## 📸 屏幕截图']
    if (stateId) lines.push(`stateId: \`${stateId}\``)
    if (outline) {
      lines.push('', '**可交互元素摘要：**', '', formatOutlineCompact(outline as Record<string, unknown>))
    }

    const toolResult: ToolResult = {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: lines.join('\n'),
      success: true, displayType: 'text',
      metadata: { action: 'screenshot', stateId }
    }
    if (image && typeof image === 'string') {
      toolResult.screenshot = image.startsWith('data:') ? image : `data:image/png;base64,${image}`
    }
    return toolResult
  }

  private async doObserve(toolCall: ToolCall): Promise<ToolResult> {
    const window = (toolCall.arguments.window as string) || ''

    const args: Record<string, unknown> = {
      readText: 'auto',
      includeImage: true,
      maxDimension: 1280
    }
    if (window) {
      // 如果是 @r 引用，直接用；否则作为标题关键词查找
      if (window.startsWith('@r')) {
        args.windowRef = window
      } else {
        // 先查找窗口
        const findResult = await piBridge.command<{ roots?: unknown[] }>('listRoots', { title: window }, 10_000)
        const roots = Array.isArray((findResult as any)?.roots) ? (findResult as any).roots : []
        if (roots.length > 0) {
          args.windowRef = (roots[0] as any)?.rootRef || `@r1`
        }
      }
    }

    const result = await piBridge.command<Record<string, unknown>>('look', args, 20_000)
    const outline = (result as any)?.outline
    const stateId = (result as any)?.stateId || ''
    const image = (result as any)?.image

    if (!outline) {
      return {
        toolCallId: toolCall.id, toolName: 'computer_use',
        content: '观察完成但未获取到 UI 大纲。请确认目标窗口是否存在。',
        success: true, displayType: 'text',
        metadata: { action: 'observe', stateId }
      }
    }

    const lines = [
      `## 🔍 UI 观察${window ? ` — ${window}` : ''}`,
      '',
      `**stateId:** \`${stateId}\``,
      '',
      formatOutlineFull(outline)
    ]

    const toolResult: ToolResult = {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: lines.join('\n'),
      success: true, displayType: 'text',
      metadata: { action: 'observe', stateId, window }
    }
    if (image && typeof image === 'string') {
      toolResult.screenshot = image.startsWith('data:') ? image : `data:image/png;base64,${image}`
    }
    return toolResult
  }

  private async doFindWindow(toolCall: ToolCall): Promise<ToolResult> {
    const window = (toolCall.arguments.window as string) || ''

    const args: Record<string, unknown> = {}
    if (window) args.title = window

    const result = await piBridge.command<{ roots?: unknown[] }>('listRoots', args, 10_000)
    const roots = Array.isArray((result as any)?.roots) ? (result as any).roots : []

    if (roots.length === 0) {
      return {
        toolCallId: toolCall.id, toolName: 'computer_use',
        content: window ? `未找到匹配 "${window}" 的窗口。` : '当前没有打开的窗口。',
        success: true
      }
    }

    const lines = ['## 🖥️ 桌面窗口列表', '']
    for (let i = 0; i < roots.length; i++) {
      const r = roots[i] as Record<string, unknown>
      const rootRef = (r.rootRef as string) || `@r${i + 1}`
      const title = (r.title as string) || '(无标题)'
      const appName = (r.appName as string) || ''
      const isFocused = r.isFocused ? ' 🔥' : ''
      lines.push(`**${i + 1}.** \`${rootRef}\` — ${title}${isFocused}`)
      if (appName) lines.push(`   应用：${appName}`)
      lines.push('')
    }
    lines.push(`共 ${roots.length} 个窗口。使用 action=observe window=@rN 查看元素。`)

    return {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: lines.join('\n'),
      success: true, displayType: 'text',
      metadata: { action: 'find_window', rootCount: roots.length }
    }
  }

  // ── 语义操作类 ──

  private async doClickElement(toolCall: ToolCall): Promise<ToolResult> {
    const ref = (toolCall.arguments.ref as string) || ''
    if (!ref) return this.error(toolCall.id, 'click_element 需要 ref 参数（@e 引用）')

    const actResult = await piBridge.command<Record<string, unknown>>('act', {
      lookId: 'look',
      action: 'press',
      target: { ref },
      policy: 'default',
      params: {}
    }, 15_000)

    const outcome = (actResult as any)?.performed?.outcome || 'unknown'
    const newLookId = (actResult as any)?.lookId || 'look'

    // 操作后快速截图确认（轻量，不重新 observe 全树）
    let screenshot: string | undefined
    try {
      const lookResult = await piBridge.command<Record<string, unknown>>('look', {
        readText: 'never',
        includeImage: true,
        maxDimension: 800
      }, 8_000)
      const img = (lookResult as any)?.image
      if (img && typeof img === 'string') {
        screenshot = img.startsWith('data:') ? img : `data:image/png;base64,${img}`
      }
    } catch { /* 忽略截图失败 */ }

    const success = outcome === 'worked'
    const result: ToolResult = {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: success
        ? `✅ 已点击 ${ref}`
        : outcome === 'didnt'
          ? `❌ 点击 ${ref} 未生效`
          : `⚠️ 点击 ${ref} 结果不确定`,
      success,
      displayType: 'text',
      metadata: { action: 'click_element', ref, outcome, lookId: newLookId }
    }
    if (screenshot) result.screenshot = screenshot
    return result
  }

  private async doSetText(toolCall: ToolCall): Promise<ToolResult> {
    const ref = (toolCall.arguments.ref as string) || ''
    const text = (toolCall.arguments.text as string) || ''
    if (!ref) return this.error(toolCall.id, 'set_text 需要 ref 参数')

    const actResult = await piBridge.command<Record<string, unknown>>('act', {
      lookId: 'look',
      action: 'setText',
      target: { ref },
      policy: 'default',
      params: { text }
    }, 15_000)

    const outcome = (actResult as any)?.performed?.outcome || 'unknown'
    const success = outcome === 'worked'

    return {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: success
        ? `✅ 已设置 ${ref} 的文本为 "${text.slice(0, 50)}"`
        : `❌ 设置 ${ref} 文本未生效`,
      success,
      displayType: 'text',
      metadata: { action: 'set_text', ref, outcome, textLength: text.length }
    }
  }

  private async doReadText(toolCall: ToolCall): Promise<ToolResult> {
    const ref = (toolCall.arguments.ref as string) || ''
    if (!ref) return this.error(toolCall.id, 'read_text 需要 ref 参数')

    const result = await piBridge.command<string>('uiaReadText', { ref, offset: 0 }, 10_000)
    const text = typeof result === 'string' ? result : JSON.stringify(result)

    return {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: `## 📄 ${ref} 文本内容\n\n${text || '(无文本内容)'}`,
      success: true, displayType: 'text',
      metadata: { action: 'read_text', ref, length: text?.length ?? 0 }
    }
  }

  // ── 直接鼠标控制 ──

  private async doMouseClick(toolCall: ToolCall): Promise<ToolResult> {
    const x = Number(toolCall.arguments.x) || 0
    const y = Number(toolCall.arguments.y) || 0
    const button = (toolCall.arguments.button as string) || 'left'
    const clickCount = Number(toolCall.arguments.clickCount) || 1

    const actResult = await piBridge.command<Record<string, unknown>>('act', {
      lookId: 'look',
      action: 'click',
      target: { x, y },
      policy: 'default',
      params: { button, clickCount }
    }, 10_000)

    const outcome = (actResult as any)?.performed?.outcome || 'unknown'
    const success = outcome === 'worked' || outcome === 'unknown'

    return {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: success
        ? `✅ 已点击 (${x}, ${y}) [${button}]`
        : `❌ 点击 (${x}, ${y}) 未生效`,
      success,
      displayType: 'text',
      metadata: { action: 'mouse_click', x, y, button, clickCount, outcome }
    }
  }

  private async doMouseMove(toolCall: ToolCall): Promise<ToolResult> {
    const x = Number(toolCall.arguments.x) || 0
    const y = Number(toolCall.arguments.y) || 0

    await piBridge.command<Record<string, unknown>>('act', {
      lookId: 'look',
      action: 'moveMouse',
      target: { x, y },
      policy: 'default',
      params: {}
    }, 10_000)

    return {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: `✅ 鼠标已移动到 (${x}, ${y})`,
      success: true, displayType: 'text',
      metadata: { action: 'mouse_move', x, y }
    }
  }

  private async doMouseDrag(toolCall: ToolCall): Promise<ToolResult> {
    const path = (toolCall.arguments.path as Array<{ x: number; y: number }>) || []
    if (path.length < 2) return this.error(toolCall.id, 'mouse_drag 需要 path 参数（至少 2 个坐标点）')

    const actResult = await piBridge.command<Record<string, unknown>>('act', {
      lookId: 'look',
      action: 'drag',
      target: {},
      policy: 'default',
      params: { path }
    }, 15_000)

    const outcome = (actResult as any)?.performed?.outcome || 'unknown'
    const success = outcome === 'worked' || outcome === 'unknown'

    return {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: success
        ? `✅ 已拖拽 ${path.length} 个路径点`
        : `❌ 拖拽未生效`,
      success,
      displayType: 'text',
      metadata: { action: 'mouse_drag', pathLength: path.length, outcome }
    }
  }

  private async doMouseScroll(toolCall: ToolCall): Promise<ToolResult> {
    const x = Number(toolCall.arguments.x) || 0
    const y = Number(toolCall.arguments.y) || 0
    const scrollX = Number(toolCall.arguments.scrollX) || 0
    const scrollY = Number(toolCall.arguments.scrollY) || 0

    const actResult = await piBridge.command<Record<string, unknown>>('act', {
      lookId: 'look',
      action: 'scroll',
      target: { x, y },
      policy: 'default',
      params: { scrollX, scrollY }
    }, 10_000)

    const outcome = (actResult as any)?.performed?.outcome || 'unknown'

    return {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: `✅ 已滚动 (${scrollX}, ${scrollY}) at (${x}, ${y})`,
      success: true, displayType: 'text',
      metadata: { action: 'mouse_scroll', x, y, scrollX, scrollY, outcome }
    }
  }

  // ── 直接键盘控制 ──

  private async doKeyPress(toolCall: ToolCall): Promise<ToolResult> {
    const keys = Array.isArray(toolCall.arguments.keys)
      ? (toolCall.arguments.keys as string[])
      : [String(toolCall.arguments.keys || 'Enter')]

    const actResult = await piBridge.command<Record<string, unknown>>('act', {
      lookId: 'look',
      action: 'keypress',
      target: {},
      policy: 'default',
      params: { keys }
    }, 10_000)

    const outcome = (actResult as any)?.performed?.outcome || 'unknown'

    return {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: `✅ 已按键 [${keys.join('+')}]`,
      success: true, displayType: 'text',
      metadata: { action: 'key_press', keys, outcome }
    }
  }

  private async doKeyType(toolCall: ToolCall): Promise<ToolResult> {
    const text = (toolCall.arguments.text as string) || ''
    if (!text) return this.error(toolCall.id, 'key_type 需要 text 参数')

    const actResult = await piBridge.command<Record<string, unknown>>('act', {
      lookId: 'look',
      action: 'typeText',
      target: {},
      policy: 'default',
      params: { text }
    }, 10_000)

    const outcome = (actResult as any)?.performed?.outcome || 'unknown'

    return {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: `✅ 已输入文本 "${text.slice(0, 50)}"`,
      success: true, displayType: 'text',
      metadata: { action: 'key_type', textLength: text.length, outcome }
    }
  }

  // ── 验证类 ──

  private async doWait(toolCall: ToolCall): Promise<ToolResult> {
    const text = (toolCall.arguments.text as string) || ''
    const until = (toolCall.arguments.until as string) || 'present'
    const timeoutMs = Math.min(Number(toolCall.arguments.timeoutMs) || 10_000, 60_000)

    if (!text) return this.error(toolCall.id, 'wait 需要 text 参数')

    const args: Record<string, unknown> = {
      text,
      until,
      timeoutMs
    }

    const result = await piBridge.command<Record<string, unknown>>('uiaWaitFor', args, timeoutMs + 5_000)
    const satisfied = (result as any)?.satisfied !== false
    const condition = until === 'present' ? '出现' : '消失'

    return {
      toolCallId: toolCall.id, toolName: 'computer_use',
      content: satisfied
        ? `✅ 条件已满足："${text}" 已${condition}`
        : `⏰ 等待超时：在 ${timeoutMs}ms 内 "${text}" 未${condition}`,
      success: true, displayType: 'text',
      metadata: { action: 'wait', satisfied, text, until }
    }
  }

  private error(id: string, msg: string): ToolResult {
    return { toolCallId: id, toolName: 'computer_use', content: '', success: false, error: msg }
  }
}

// ── Outline 格式化工具函数 ──

/** 完整格式化 outline — 显示所有层级 */
function formatOutlineFull(node: Record<string, unknown>, indent = 0): string {
  const lines: string[] = []
  const prefix = '  '.repeat(indent)
  const ref = node.ref || ''
  const role = node.role || ''
  const label = node.label || node.title || ''
  const value = node.value ? ` = "${String(node.value).slice(0, 60)}"` : ''
  const capabilities = node.capabilities as Record<string, unknown> | undefined
  const capStr = capabilities
    ? Object.entries(capabilities)
        .filter(([, v]) => v === true)
        .map(([k]) => k.replace(/^can/, ''))
        .join(', ')
    : ''
  const capDisplay = capStr ? ` [${capStr}]` : ''

  const line = label
    ? `${prefix}${ref} ${role}: "${label}"${value}${capDisplay}`
    : `${prefix}${ref} ${role}${value}${capDisplay}`
  lines.push(line)

  const children = node.children as Record<string, unknown>[] | undefined
  if (Array.isArray(children)) {
    for (const child of children) {
      lines.push(formatOutlineFull(child, indent + 1))
    }
  }

  return lines.join('\n')
}

/** 紧凑格式化 outline — 只显示可交互元素 */
function formatOutlineCompact(node: Record<string, unknown>, indent = 0): string {
  const lines: string[] = []
  const prefix = '  '.repeat(indent)
  const ref = node.ref || ''
  const role = node.role || ''
  const label = node.label || node.title || ''
  const capabilities = node.capabilities as Record<string, unknown> | undefined

  const isInteractive = capabilities && (
    capabilities.canInvoke || capabilities.canPress || capabilities.canSetValue ||
    capabilities.isEnabled === false
  )
  if (label || isInteractive || indent === 0) {
    const capStr = capabilities
      ? Object.entries(capabilities)
          .filter(([, v]) => v === true)
          .map(([k]) => k.replace(/^can/, ''))
          .join(',')
      : ''
    const value = node.value ? `="${String(node.value).slice(0, 30)}"` : ''
    lines.push(`${prefix}${ref} ${role}: "${label}"${value}${capStr ? ` [${capStr}]` : ''}`)
  }

  const children = node.children as Record<string, unknown>[] | undefined
  if (Array.isArray(children)) {
    for (const child of children) {
      lines.push(formatOutlineCompact(child, indent + 1))
    }
  }

  return lines.join('\n')
}
