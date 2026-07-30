/**
 * 最小 YAML frontmatter 解析器
 *
 * 从 open-design-main 的 packages/plugin-runtime/src/parsers/frontmatter.ts
 * 移植，简化为仅支持设计模板所需的子集。
 *
 * 支持：
 * - 标量字符串 / 数字 / 布尔 / null
 * - 块字面量 (|) 字符串
 * - 内联数组 ([a, b, c])
 * - 短横线前缀数组
 */

export type FrontmatterScalar = string | number | boolean | null
export type FrontmatterValue = FrontmatterScalar | FrontmatterArray | FrontmatterObject
export interface FrontmatterArray extends Array<FrontmatterValue> {}
export interface FrontmatterObject extends Record<string, FrontmatterValue> {}

export function parseFrontmatter(src: string): { data: FrontmatterObject; body: string } {
  const text = src.replace(/^\uFEFF/, '')

  let markerStart = -1
  if (text.startsWith('---\n')) {
    markerStart = 4
  } else if (text.startsWith('---\r\n')) {
    markerStart = 5
  } else {
    return { data: {}, body: text }
  }

  let closeIndex = markerStart - 1
  while (true) {
    closeIndex = text.indexOf('\n---', closeIndex + 1)
    if (closeIndex === -1) {
      return { data: {}, body: text }
    }
    const nextChar = text[closeIndex + 4]
    if (nextChar === undefined || nextChar === '\n' || nextChar === '\r') {
      break
    }
  }

  const hasCr = text[closeIndex - 1] === '\r'
  const yamlEnd = hasCr ? closeIndex - 1 : closeIndex
  const yamlRaw = text.slice(markerStart, yamlEnd)
  const yaml = yamlRaw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  let bodyStart = closeIndex + 4
  if (bodyStart < text.length) {
    if (text.startsWith('\r\n', bodyStart)) {
      bodyStart += 2
    } else if (text[bodyStart] === '\n' || text[bodyStart] === '\r') {
      bodyStart += 1
    }
  }

  return { data: parseYamlSubset(yaml), body: text.slice(bodyStart) }
}

function parseYamlSubset(src: string): FrontmatterObject {
  const lines = src.split(/\r?\n/)
  const root: FrontmatterObject = {}
  const stack: { indent: number; container: FrontmatterObject | FrontmatterArray; key: string | null }[] = [
    { indent: -1, container: root, key: null }
  ]
  let i = 0

  while (i < lines.length) {
    const raw = lines[i] ?? ''
    if (/^\s*(#.*)?$/.test(raw)) {
      i++
      continue
    }
    const indent = raw.match(/^\s*/)?.[0].length ?? 0
    const line = raw.slice(indent)

    const isSeqItem = line.startsWith('- ')
    while (stack.length > 1 && indent <= (stack[stack.length - 1]?.indent ?? -1)) {
      const entry = stack[stack.length - 1]
      if (
        entry &&
        isSeqItem &&
        indent === entry.indent &&
        entry.key !== null &&
        (Array.isArray(entry.container) || Object.keys(entry.container).length === 0)
      ) {
        break
      }
      stack.pop()
    }
    const top = stack[stack.length - 1]
    if (!top) break

    if (line.startsWith('- ')) {
      const value = line.slice(2).trim()
      let container = top.container
      if (!Array.isArray(container)) {
        const parent = stack[stack.length - 2]
        if (parent && top.key) {
          if (!Array.isArray(parent.container)) {
            ;(parent.container as FrontmatterObject)[top.key] = []
          }
          container = (parent.container as FrontmatterObject)[top.key] as FrontmatterArray
          top.container = container
        } else {
          i++
          continue
        }
      }
      if (value.includes(':')) {
        const obj: FrontmatterObject = {}
        const colonIdx = value.indexOf(':')
        const key = value.slice(0, colonIdx).trim()
        const valRaw = value.slice(colonIdx + 1).trim()
        if (valRaw) obj[key] = coerce(valRaw)
        ;(container as FrontmatterArray).push(obj)
        stack.push({ indent, container: obj, key: null })
      } else {
        ;(container as FrontmatterArray).push(coerce(value))
      }
      i++
      continue
    }

    const kv = /^([^:]+):\s*(.*)$/.exec(line)
    if (!kv) {
      i++
      continue
    }
    const key = (kv[1] ?? '').trim()
    const val = kv[2]

    if (val === '' || val === undefined) {
      if (Array.isArray(top.container)) {
        i++
        continue
      }
      ;(top.container as FrontmatterObject)[key] = {}
      stack.push({ indent, container: (top.container as FrontmatterObject)[key] as FrontmatterObject, key })
      i++
      continue
    }

    if (val === '|' || val === '|-' || val === '>' || val === '>-') {
      const collected: string[] = []
      let blockIndent = -1
      i++
      while (i < lines.length) {
        const next = lines[i] ?? ''
        if (/^\s*$/.test(next)) {
          collected.push('')
          i++
          continue
        }
        const nIndent = next.match(/^\s*/)?.[0].length ?? 0
        if (nIndent <= indent) break
        if (blockIndent === -1) blockIndent = nIndent
        if (nIndent < blockIndent) break
        collected.push(next.slice(blockIndent))
        i++
      }
      if (!Array.isArray(top.container)) {
        ;(top.container as FrontmatterObject)[key] = collected.join('\n').trimEnd()
      }
      continue
    }

    if (val === '[]') {
      if (!Array.isArray(top.container)) {
        ;(top.container as FrontmatterObject)[key] = []
      }
      i++
      continue
    }

    if (val.startsWith('[') && val.endsWith(']')) {
      if (!Array.isArray(top.container)) {
        ;(top.container as FrontmatterObject)[key] = splitInlineArray(val.slice(1, -1))
      }
      i++
      continue
    }

    if (!Array.isArray(top.container)) {
      ;(top.container as FrontmatterObject)[key] = coerce(val)
    }
    i++
  }

  return root
}

function splitInlineArray(inner: string): FrontmatterValue[] {
  return splitInlineArrayItems(inner)
    .map((s) => coerce(s.trim()))
    .filter((v): v is FrontmatterValue => v !== '')
}

function splitInlineArrayItems(inner: string): string[] {
  const items: string[] = []
  let buf = ''
  let quote: '"' | "'" | null = null
  for (const ch of inner) {
    if (quote) {
      buf += ch
      if (ch === quote) quote = null
    } else if ((ch === '"' || ch === "'") && buf.trim() === '') {
      quote = ch
      buf += ch
    } else if (ch === ',') {
      items.push(buf)
      buf = ''
    } else {
      buf += ch
    }
  }
  items.push(buf)
  return items
}

function coerce(raw: string | undefined): FrontmatterValue {
  if (raw === undefined) return ''
  const v = raw.trim()
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1)
  }
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null' || v === '~') return null
  if (/^-?\d+$/.test(v)) return Number(v)
  if (/^-?\d*\.\d+$/.test(v)) return Number(v)
  return v
}
