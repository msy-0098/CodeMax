/**
 * 从 agency-agents-main 目录解析所有 Agent MD 文件，
 * 生成 src/shared/agents-raw.json（中文版）
 *
 * 解析流程：
 *   1. 从 agency-agents-main/*.md 提取英文原始数据
 *   2. 从 scripts/agent-translations.json 加载中文翻译
 *   3. 按 id 合并翻译后输出到 agents-raw.json
 *
 * 用法: node scripts/parse-agents.cjs
 */
const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '..', 'agency-agents-main')
const OUT_FILE = path.join(__dirname, '..', 'src', 'shared', 'agents-raw.json')
const TRANSLATIONS_FILE = path.join(__dirname, 'agent-translations.json')

// 读取 divisions.json 获取部门元数据
const divisionsRaw = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'divisions.json'), 'utf8'))
const divisions = divisionsRaw.divisions

// 非部门目录（参考 divisions.json 的 _note）
const NON_DIVISION_DIRS = new Set(['examples', 'scripts', 'integrations', 'strategy'])

/**
 * 解析 Markdown frontmatter
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  
  const fm = {}
  const lines = match[1].split('\n')
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    // 去掉 YAML 字符串值的首尾引号（color: "#D97706" → #D97706）
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    fm[key] = val
  }
  return fm
}

/**
 * 获取 frontmatter 之后的第一段正文作为 personality（角色定义）
 * 只取第一段，避免 JSON 文件过大
 */
function extractPersonality(content) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return ''
  const body = match[1].trim()
  // 按行拆分，跳过 # 标题行，取第一个有实质内容的段落
  const lines = body.split('\n')
  let para = []
  let foundStart = false
  for (const line of lines) {
    const trimmed = line.trim()
    // 跳过标题行和空行
    if (trimmed.startsWith('#')) {
      if (foundStart) break // 已有内容，遇到二级标题就停
      continue
    }
    if (trimmed === '') {
      if (foundStart) break // 段落结束
      continue
    }
    foundStart = true
    para.push(trimmed)
  }
  return para.join(' ')
}

/**
 * 获取指定部门下所有 agent
 */
function getAgentsForDivision(divisionKey) {
  const dir = path.join(SRC_DIR, divisionKey)
  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
  const agents = []

  for (const file of files) {
    const filePath = path.join(dir, file)
    const content = fs.readFileSync(filePath, 'utf8')
    const fm = parseFrontmatter(content)

    if (!fm.name) continue // 非 agent 文件（如 README）

    // 从文件名提取 id: division-agent-name（去掉 .md）
    const id = file.replace(/\.md$/, '')

    const personality = extractPersonality(content)

    agents.push({
      id,
      division: divisionKey,
      name: fm.name || id,
      description: fm.description || '',
      tools: [], // 工具列表不在 frontmatter 中，留空
      color: fm.color || 'blue',
      emoji: fm.emoji || '🤖',
      vibe: fm.vibe || '',
      personality
    })
  }

  return agents
}

// 主流程
const allAgents = []
const divisionKeys = Object.keys(divisions).sort()

for (const divKey of divisionKeys) {
  if (NON_DIVISION_DIRS.has(divKey)) continue
  const agents = getAgentsForDivision(divKey)
  allAgents.push(...agents)
  console.log(`  ${divKey}: ${agents.length} agents`)
}

// 按 division + name 排序
allAgents.sort((a, b) => {
  if (a.division !== b.division) return a.division.localeCompare(b.division)
  return a.name.localeCompare(b.name)
})

// ---------- 加载中文翻译 ----------
let translations = {}
if (fs.existsSync(TRANSLATIONS_FILE)) {
  translations = JSON.parse(fs.readFileSync(TRANSLATIONS_FILE, 'utf8'))
  console.log(`\n📚 已加载中文翻译: ${Object.keys(translations).length} 条`)
} else {
  console.warn(`\n⚠️  未找到翻译文件: ${TRANSLATIONS_FILE}，将输出英文原始数据`)
}

// ---------- 应用翻译 ----------
let translatedCount = 0
let untranslatedCount = 0
for (const agent of allAgents) {
  const t = translations[agent.id]
  if (t) {
    agent.name = t.name || agent.name
    agent.description = t.description || agent.description
    agent.vibe = t.vibe || agent.vibe
    agent.personality = t.personality || agent.personality
    translatedCount++
  } else {
    untranslatedCount++
    console.warn(`  ⚠️  缺少中文翻译: ${agent.id} (${agent.name})`)
  }
}

const output = {
  agents: allAgents,
  total: allAgents.length
}

// 写入文件，确保无 BOM，UTF-8 编码
fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8')
console.log(`\n✅ 生成完成: ${allAgents.length} 位专家 → ${path.relative(process.cwd(), OUT_FILE)}`)
console.log(`   已翻译: ${translatedCount}，未翻译: ${untranslatedCount}`)
