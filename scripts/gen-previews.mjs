/**
 * 为 UI 库中的每个组件生成自包含 HTML 预览文件。
 *
 * 每个 HTML 文件包含:
 * 1. 组件 JSX 源码（在 Node.js 端用 TypeScript 编译为纯 JS）
 * 2. import map — 将所有 npm 包导入解析到 esm.sh CDN
 * 3. 组件 CSS（内联到 <style>）
 * 4. 从 Demo 文件提取的 DEFAULT_PROPS
 *
 * 输出: src/renderer/public/ui-previews/{ComponentId}.html
 *
 * 用法: node scripts/gen-previews.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const COMPONENTS_DIR = join(ROOT, 'src/main/tools/Design/ui-components')
const CATALOG_PATH = join(ROOT, 'src/renderer/src/components/design/ui-components-catalog.json')
const OUTPUT_DIR = join(ROOT, 'src/renderer/public/ui-previews')

// ─── esm.sh CDN 导入映射 ──────────────────────────────

const IMPORT_MAP = {
  imports: {
    'react': 'https://esm.sh/react@19.0.0',
    'react/jsx-runtime': 'https://esm.sh/react@19.0.0/jsx-runtime',
    'react-dom': 'https://esm.sh/react-dom@19.0.0',
    'react-dom/client': 'https://esm.sh/react-dom@19.0.0/client',
    'motion/react': 'https://esm.sh/motion@12.23.12/react?external=react,react-dom',
    'gsap': 'https://esm.sh/gsap@3.13.0',
    'gsap/': 'https://esm.sh/gsap@3.13.0/',
    '@gsap/react': 'https://esm.sh/@gsap/react@2.1.2?external=gsap,react',
    'ogl': 'https://esm.sh/ogl@1.0.11',
    'three': 'https://esm.sh/three@0.180.0',
    'three/': 'https://esm.sh/three@0.180.0/',
    '@react-three/fiber': 'https://esm.sh/@react-three/fiber@9.3.0?external=react,react-dom,three',
    '@react-three/drei': 'https://esm.sh/@react-three/drei@10.7.4?external=react,three,@react-three/fiber',
    '@react-three/postprocessing': 'https://esm.sh/@react-three/postprocessing@3.0.4?external=react,three,@react-three/fiber,postprocessing',
    '@react-three/rapier': 'https://esm.sh/@react-three/rapier@2.1.0?external=react,three,@react-three/fiber',
    'postprocessing': 'https://esm.sh/postprocessing@6.36.0?external=three',
    'matter-js': 'https://esm.sh/matter-js@0.20.0',
    'react-icons/': 'https://esm.sh/react-icons@5.5.0/',
    'lucide-react': 'https://esm.sh/lucide-react@0.542.0?external=react',
    'lenis': 'https://esm.sh/lenis@1.3.13',
    'meshline': 'https://esm.sh/meshline@3.3.1?external=three',
    'gl-matrix': 'https://esm.sh/gl-matrix@3.4.3',
    'maath': 'https://esm.sh/maath@0.10.8?external=three',
    '@use-gesture/react': 'https://esm.sh/@use-gesture/react@10.2.27?external=react',
    'face-api.js': 'https://esm.sh/face-api.js@0.22.2',
  }
}

// ─── 源码处理 ──────────────────────────────────────────

function processSource(code) {
  // 移除 'use client' 指令
  code = code.replace(/^['"]use client['"];?\s*\n?/m, '')
  // 移除 CSS 导入（CSS 会被内联到 <style> 标签）
  code = code.replace(/^\s*import\s+['"]\.\/[^'"]+\.css['"];?\s*$/gm, '')
  // 将二进制资源导入替换为空字符串常量
  code = code.replace(
    /^import\s+(\w+)\s+from\s+['"]\.\/[^'"]+\.(glb|png|jpg|jpeg|gif|svg|webp|mp4|webm)['"];?\s*$/gm,
    'const $1 = "";'
  )
  // 移除 export 关键字（保留变量/函数声明）
  code = code.replace(/^export\s+default\s+/gm, '')
  code = code.replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ')
  return code.trim()
}

// 确保 React 在作用域内（classic JSX runtime 需要）
function ensureReactImport(code) {
  if (/^import\s+React\b/m.test(code) || /^import\s+\*\s+as\s+React\b/m.test(code)) {
    return code
  }
  return "import * as React from 'react';\n" + code
}

// ─── 从 Demo 文件提取 DEFAULT_PROPS ────────────────────

function extractDefaultProps(demoPath) {
  if (!existsSync(demoPath)) return '{}'
  const code = readFileSync(demoPath, 'utf8')
  const marker = 'const DEFAULT_PROPS'
  const start = code.indexOf(marker)
  if (start === -1) return '{}'
  const braceStart = code.indexOf('{', start)
  if (braceStart === -1) return '{}'
  let depth = 0
  for (let i = braceStart; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}') {
      depth--
      if (depth === 0) return code.slice(braceStart, i + 1)
    }
  }
  return '{}'
}

// ─── 用 TypeScript 编译 JSX → JS ──────────────────────

function compileJSX(code) {
  const result = ts.transpileModule(code, {
    fileName: 'component.jsx',
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      allowJs: true,
      esModuleInterop: true,
    },
  })
  return result.outputText
}

// ─── 生成 HTML ─────────────────────────────────────────

function generateHTML(component) {
  const { id, category, files } = component
  const componentDir = join(COMPONENTS_DIR, category, id)

  // 读取组件源码
  const jsxPath = join(componentDir, files.jsx)
  let source = readFileSync(jsxPath, 'utf8')
  source = processSource(source)
  source = ensureReactImport(source)

  // 读取 CSS
  let css = ''
  if (files.css) {
    const cssPath = join(componentDir, files.css)
    if (existsSync(cssPath)) {
      css = readFileSync(cssPath, 'utf8')
    }
  }

  // 从 Demo 提取 DEFAULT_PROPS
  const demoPath = join(COMPONENTS_DIR, 'demos', category, `${id}Demo.jsx`)
  const defaultProps = extractDefaultProps(demoPath)

  // 根据分类调整容器样式
  const isBackground = category === 'Backgrounds'
  const isAnimation = category === 'Animations'
  const containerStyle = (isBackground || isAnimation)
    ? '#root{width:100vw;height:100vh}'
    : '#root{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}'

  // 组合源码 + 渲染代码
  const fullCode = `${source}

import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(React.createElement(${id}, ${defaultProps}));`

  // 编译 JSX → JS
  let compiled
  try {
    compiled = compileJSX(fullCode)
  } catch (e) {
    return errorHTML(id, e.message)
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${id} Preview</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f172a;color:#e2e8f0;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
${containerStyle}
${css}
</style>
<script type="importmap">${JSON.stringify(IMPORT_MAP)}</script>
</head>
<body>
<div id="root"><div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#475569;font-size:13px;">Loading ${id}...</div></div>
<script type="module">
${compiled}
</script>
</body>
</html>`
}

function errorHTML(id, message) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${id} Error</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f172a;color:#ff6b6b;font-family:monospace;font-size:12px;padding:16px}</style>
</head><body><pre>Compile Error (${id}):

${message}</pre></body></html>`
}

// ─── 主逻辑 ────────────────────────────────────────────

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

let ok = 0, fail = 0
const failures = []

for (const comp of catalog.components) {
  try {
    const html = generateHTML(comp)
    writeFileSync(join(OUTPUT_DIR, `${comp.id}.html`), html, 'utf8')
    ok++
  } catch (e) {
    fail++
    failures.push({ id: comp.id, error: e.message })
  }
}

console.log(`\n✅ 成功生成 ${ok} 个预览文件`)
if (fail > 0) {
  console.log(`❌ ${fail} 个失败:`)
  failures.forEach(f => console.log(`   - ${f.id}: ${f.error}`))
}
console.log(`📁 输出目录: ${OUTPUT_DIR}`)
