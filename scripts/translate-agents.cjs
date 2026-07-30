/**
 * 将 agents-raw.json 中的所有专家描述翻译为中文
 * 使用 DeepSeek API 批量翻译
 * 
 * 用法: node scripts/translate-agents.cjs --key sk-xxx
 */
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

const INPUT_FILE = path.join(__dirname, '..', 'src', 'shared', 'agents-raw.json')
const CACHE_FILE = path.join(__dirname, '..', '.translate-cache.json')

// 解析命令行参数
const args = process.argv.slice(2)
let API_KEY = process.env.DEEPSEEK_API_KEY || ''
let BASE_URL = 'https://api.deepseek.com'
let MODEL = 'deepseek-chat'

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--key' && args[i + 1]) API_KEY = args[++i]
  if (args[i] === '--base-url' && args[i + 1]) BASE_URL = args[++i]
  if (args[i] === '--model' && args[i + 1]) MODEL = args[++i]
}

if (!API_KEY) {
  console.error('Please provide API Key:')
  console.error('  node scripts/translate-agents.cjs --key sk-xxx')
  process.exit(1)
}

// 读取数据
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'))
const agents = data.agents
console.log(`Total: ${agents.length} agents to translate\n`)

// 加载缓存
let cache = {}
if (fs.existsSync(CACHE_FILE)) {
  try {
    const cacheRaw = fs.readFileSync(CACHE_FILE, 'utf8')
    cache = JSON.parse(cacheRaw)
    console.log(`Loaded cache: ${Object.keys(cache).length} entries`)
  } catch { /* ignore */ }
}

/**
 * 用原生 http/https 模块调用 API（避免 fetch 编码问题）
 */
function callAPI(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const mod = urlObj.protocol === 'https:' ? https : http
    const payload = JSON.stringify(body)
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(payload, 'utf8')
      }
    }

    const req = mod.request(options, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        const text = buf.toString('utf8')
        if (res.statusCode !== 200) {
          reject(new Error(`API ${res.statusCode}: ${text.substring(0, 200)}`))
          return
        }
        try {
          resolve(JSON.parse(text))
        } catch (e) {
          reject(new Error(`JSON parse error: ${text.substring(0, 200)}`))
        }
      })
    })
    
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

/**
 * 翻译一批专家（每批5个）
 */
async function translateBatch(agentBatch) {
  // 检查缓存
  const uncached = agentBatch.filter(a => !cache[a.id])
  if (uncached.length === 0) {
    return agentBatch.map(a => cache[a.id])
  }

  const items = agentBatch.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    vibe: a.vibe,
    personality: a.personality
  }))

  const prompt = `Translate the following AI agent info to Chinese. Return a JSON array with same structure. Rules:
- name: concise Chinese job title (e.g. "Frontend Developer" -> "前端开发工程师")
- description: fluent Chinese description
- vibe: short, punchy Chinese style phrase
- personality: fluent Chinese, keep **bold** formatting
- Maintain professional accuracy

Input:
${JSON.stringify(items, null, 2)}

Return ONLY the JSON array, no markdown code blocks.`

  const result = await callAPI(`${BASE_URL}/chat/completions`, {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 4096
  })

  let content = result.choices[0].message.content.trim()
  // 去掉可能的 markdown 代码块标记
  content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')

  const translations = JSON.parse(content)
  
  // 建立缓存
  for (const t of translations) {
    cache[t.id] = t
  }
  
  return translations
}

// 主流程
async function main() {
  const BATCH_SIZE = 5
  const total = agents.length
  let translated = 0
  let failed = 0

  for (let i = 0; i < agents.length; i += BATCH_SIZE) {
    const batch = agents.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(agents.length / BATCH_SIZE)
    
    const names = batch.map(a => a.name).join(', ')
    console.log(`[${batchNum}/${totalBatches}] Translating: ${names}...`)
    
    try {
      const translations = await translateBatch(batch)
      
      // 应用翻译
      for (const agent of batch) {
        const t = translations.find(tr => tr.id === agent.id) || cache[agent.id]
        if (t) {
          agent.name = t.name || agent.name
          agent.description = t.description || agent.description
          agent.vibe = t.vibe || agent.vibe
          agent.personality = t.personality || agent.personality
          translated++
        } else {
          failed++
        }
      }
      
      // 验证翻译结果（输出一条样例）
      const sample = batch[0]
      console.log(`  => ${sample.name}: ${sample.description.substring(0, 50)}...`)
      
      // 每批保存缓存
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
    } catch (e) {
      console.error(`  FAILED batch ${batchNum}: ${e.message}`)
      failed += batch.length
    }

    // 速率限制
    if (i + BATCH_SIZE < agents.length) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  // 写入最终文件
  fs.writeFileSync(INPUT_FILE, JSON.stringify(data, null, 2), 'utf8')
  console.log(`\nDone! Translated: ${translated}, Failed: ${failed}, Total: ${total}`)
  
  // 保存最终缓存
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
