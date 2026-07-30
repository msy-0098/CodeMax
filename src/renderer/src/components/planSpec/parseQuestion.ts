/**
 * 解析 plan_ask 工具发来的问题文本，自动检测问题类型：
 * - choice：包含 A. B. C. 等选项的选择题
 * - confirm：请求用户确认/接受方案的确认题
 * - text：开放性提问（回退）
 */

export interface ChoiceOption {
  label: string
  text: string
}

export type ParsedQuestion =
  | { kind: 'choice'; options: ChoiceOption[]; body: string }
  | { kind: 'confirm'; body: string }
  | { kind: 'text'; body: string }

// 匹配 "A. 选项文本" / "A) 选项文本" / "A：选项文本" / "A: 选项文本"
const OPTION_LINE_REGEX = /^([A-Z])[.):：]\s+(.+)/

/**
 * 解析问题内容，检测问题类型并提取结构化数据
 */
export function parseQuestion(content: string): ParsedQuestion {
  const lines = content.split('\n')

  // ── 检测选择题：收集所有匹配 A. xxx 格式的行 ──
  const optionEntries: { label: string; text: string; lineIdx: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(OPTION_LINE_REGEX)
    if (m) {
      optionEntries.push({ label: m[1], text: m[2].trim(), lineIdx: i })
    }
  }

  if (optionEntries.length >= 2) {
    // 选项前的内容作为问题正文
    const firstOptIdx = optionEntries[0].lineIdx
    const body = lines.slice(0, firstOptIdx).join('\n').trim()
    const options = optionEntries.map((o) => ({ label: o.label, text: o.text }))
    return { kind: 'choice', options, body }
  }

  // ── 检测确认题：末尾几行包含确认关键词 + 问号 ──
  const tail = lines.slice(-5).join('\n')
  const hasConfirmKeyword = /请确认|是否确认|是否同意|是否接受|确认执行|是否开始|确认以上|接受以上|同意以上/.test(tail)
  const hasQuestionMark = /[？?]/.test(tail)
  if (hasConfirmKeyword && hasQuestionMark) {
    return { kind: 'confirm', body: content }
  }

  // ── 回退：开放性问题 ──
  return { kind: 'text', body: content }
}
