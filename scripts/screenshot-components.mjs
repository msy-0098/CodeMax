/**
 * 截图+GIF生成脚本 — 为所有 UI 组件生成预览 GIF
 *
 * 使用 Electron 内置 Chromium 渲染组件 HTML，多帧截图后合成 GIF。
 * 无需额外安装 Playwright 浏览器。
 *
 * 用法: node scripts/screenshot-components.mjs
 * 强制重新截图: node scripts/screenshot-components.mjs --force
 */

import { readFileSync, mkdirSync, existsSync, writeFileSync, statSync } from 'fs'
import { resolve, join } from 'path'

// ─── 配置 ────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, '..')
const CACHE_PATH = join(ROOT, 'src/renderer/src/components/design/ui-components-precompiled.json')
const OUTPUT_DIR = join(ROOT, 'src/renderer/public/ui-previews')
const MANIFEST_PATH = join(OUTPUT_DIR, 'manifest.json')

const WIDTH = 480
const HEIGHT = 320
const FRAME_COUNT = 15        // GIF 帧数
const FRAME_INTERVAL_MS = 200 // 帧间隔 (ms)
const INITIAL_WAIT_MS = 3000  // 初始等待渲染时间

// ─── 读取预编译缓存 ──────────────────────────────────
const cache = JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
const ids = Object.keys(cache).sort()
const force = process.argv.includes('--force')
console.log(`📷 共 ${ids.length} 个组件待截图\n`)

// ─── 确保输出目录存在 ──────────────────────────────
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

// ─── 构建 HTML ─────────────────────────────────────

function buildHead(cdnScriptsHtml) {
  return `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>tailwind.config={darkMode:'class'}<\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  ${cdnScriptsHtml}
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0f172a; color:#e2e8f0; }
    #root { min-height:100vh; }
  </style>`
}

const BODY_PREFIX = `<div id="root"></div>`

function buildHtml(entry) {
  if (entry.error || !entry.js) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{background:#0f172a;color:#94a3b8;display:flex;align-items:center;justify-content:center;min-height:100vh;font-size:12px;}</style></head><body>预编译失败</body></html>`
  }

  const cdnScripts = entry.cdnScripts || []
  const cdnHtml = cdnScripts.map(s => `<script src="${s}"><\/script>`).join('\n  ')

  const cssInject = entry.css
    ? `<script>;(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(entry.css)};document.head.appendChild(s);})();<\/script>`
    : ''

  const esmImports = []
  if (entry.isModule && entry.deps?.ogl) {
    esmImports.push(`const __OGL = await import('https://esm.sh/ogl@1.0.11');`)
    esmImports.push(`const { Renderer, Program, Mesh, Color, Triangle, Vec3, Vec2, Vec4, Texture, Camera, Orbit, RenderTarget, Flowmap, Geometry, Polyline, Curve, Mouse, Plane, Sphere, Box, Cylinder, Torus, Axes, GPGPU, Transform } = __OGL;`)
  }
  if (entry.isModule && entry.deps?.r3f) {
    esmImports.push(`const __R3F = await import('https://esm.sh/@react-three/fiber@8');`)
    esmImports.push(`window.ReactThreeFiber = __R3F;`)
  }
  if (entry.isModule && entry.deps?.drei) {
    esmImports.push(`const __Drei = await import('https://esm.sh/@react-three/drei@9');`)
    esmImports.push(`window.Drei = __Drei;`)
  }
  if (entry.isModule && entry.deps?.postprocessing) {
    esmImports.push(`const __PP = await import('https://esm.sh/postprocessing@6');`)
    esmImports.push(`window.postprocessing = __PP;`)
  }

  const scriptType = entry.isModule ? ' type="module"' : ''
  const finalCode = (esmImports.length > 0 ? esmImports.join('\n') + '\n' : '') + entry.js

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  ${buildHead(cdnHtml)}
</head>
<body class="dark">
  ${BODY_PREFIX}
  ${cssInject}
  <script${scriptType}>
    ${finalCode}
  <\/script>
</body>
</html>`
}

// ─── GIF 编码器 (轻量级,无需额外依赖) ──────────────

/**
 * 简易 GIF89a 编码器
 * 支持: 多帧、全局色表(256色量化)、LZW压缩
 * 参考: GIF89a 规范 + NeuQuant 量化思路
 */
class GifEncoder {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.frames = []    // { pixels: Uint8Array, delay: number }
    this.transparent = null
  }

  /** 添加一帧 (RGBA pixels) */
  addFrame(rgbaPixels, delayCs = 10) {
    // 量化到 256 色
    const { palette, indexed } = this._quantize(rgbaPixels)
    this.frames.push({ indexed, palette, delay: delayCs })
  }

  /** 输出 GIF 二进制 */
  encode() {
    const bufs = []

    // Header
    bufs.push(Buffer.from('GIF89a'))

    // Logical Screen Descriptor
    const lsd = Buffer.alloc(7)
    lsd.writeUInt16LE(this.width, 0)
    lsd.writeUInt16LE(this.height, 2)
    lsd[4] = 0x80 | 0x70 // global color table flag + 8-bit color depth (7+1)
    lsd[5] = 0            // background color index
    lsd[6] = 0            // pixel aspect ratio
    bufs.push(lsd)

    // Global Color Table (256 * 3 bytes) — 使用第一帧的色表
    if (this.frames.length > 0) {
      bufs.push(Buffer.from(this.frames[0].palette))
    }

    // Netscape Extension (loop forever)
    bufs.push(Buffer.from([0x21, 0xFF, 0x0B]))
    bufs.push(Buffer.from('NETSCAPE2.0'))
    bufs.push(Buffer.from([0x03, 0x01, 0x00, 0x00])) // sub-block: loop count = 0

    for (const frame of this.frames) {
      // Graphic Control Extension
      const gce = Buffer.alloc(8)
      gce[0] = 0x21 // extension introducer
      gce[1] = 0xF9 // graphic control label
      gce[2] = 0x04 // block size
      gce[3] = 0x00 // packed (no transparency, no user input)
      gce.writeUInt16LE(frame.delay, 4) // delay time (in 1/100 s)
      gce[6] = 0x00 // transparent color index
      gce[7] = 0x00 // block terminator
      bufs.push(gce)

      // Image Descriptor
      const imgd = Buffer.alloc(10)
      imgd[0] = 0x2C // image separator
      imgd.writeUInt16LE(0, 1)  // left
      imgd.writeUInt16LE(0, 3)  // top
      imgd.writeUInt16LE(this.width, 5)
      imgd.writeUInt16LE(this.height, 7)
      imgd[9] = 0x00 // packed (no local color table)
      bufs.push(imgd)

      // LZW compressed image data
      const lzw = this._lzwEncode(frame.indexed, 8)
      bufs.push(lzw)
    }

    // Trailer
    bufs.push(Buffer.from([0x3B]))

    return Buffer.concat(bufs)
  }

  /** 中位切色量化 — 将 RGBA 像素量化到 256 色 */
  _quantize(rgbaPixels) {
    const n = this.width * this.height
    // 收集唯一颜色
    const colorMap = new Map()
    const pixelIdx = new Uint8Array(n)

    for (let i = 0; i < n; i++) {
      const r = rgbaPixels[i * 4]
      const g = rgbaPixels[i * 4 + 1]
      const b = rgbaPixels[i * 4 + 2]
      const key = (r << 16) | (g << 8) | b
      if (!colorMap.has(key)) {
        if (colorMap.size < 256) {
          colorMap.set(key, colorMap.size)
        }
      }
    }

    // 如果颜色 <= 256, 直接使用
    if (colorMap.size <= 256) {
      const palette = new Uint8Array(256 * 3)
      for (const [key, idx] of colorMap) {
        palette[idx * 3] = (key >> 16) & 0xFF
        palette[idx * 3 + 1] = (key >> 8) & 0xFF
        palette[idx * 3 + 2] = key & 0xFF
      }
      for (let i = 0; i < n; i++) {
        const r = rgbaPixels[i * 4]
        const g = rgbaPixels[i * 4 + 1]
        const b = rgbaPixels[i * 4 + 2]
        const key = (r << 16) | (g << 8) | b
        pixelIdx[i] = colorMap.has(key) ? colorMap.get(key) : 0
      }
      return { palette, indexed: pixelIdx }
    }

    // 颜色 > 256: 简单采样量化
    const palette = new Uint8Array(256 * 3)
    let pidx = 0
    const keyToIdx = new Map()
    for (const [key, _] of colorMap) {
      if (pidx >= 256) break
      palette[pidx * 3] = (key >> 16) & 0xFF
      palette[pidx * 3 + 1] = (key >> 8) & 0xFF
      palette[pidx * 3 + 2] = key & 0xFF
      keyToIdx.set(key, pidx)
      pidx++
    }
    for (let i = 0; i < n; i++) {
      const r = rgbaPixels[i * 4]
      const g = rgbaPixels[i * 4 + 1]
      const b = rgbaPixels[i * 4 + 2]
      const key = (r << 16) | (g << 8) | b
      pixelIdx[i] = keyToIdx.has(key) ? keyToIdx.get(key) : (key % 256)
    }
    return { palette, indexed: pixelIdx }
  }

  /** LZW 编码 */
  _lzwEncode(indexed, minCodeSize) {
    const clearCode = 1 << minCodeSize
    const eoiCode = clearCode + 1
    const bufs = []
    let buf = 0
    let bufBits = 0

    const output = (code, size) => {
      buf |= (code << bufBits)
      bufBits += size
      while (bufBits >= 8) {
        bufs.push(buf & 0xFF)
        buf >>= 8
        bufBits -= 8
      }
    }

    // 初始化
    let codeSize = minCodeSize + 1
    let nextCode = eoiCode + 1
    output(clearCode, codeSize)

    let codeDict = {}
    let prefix = indexed[0]

    for (let i = 1; i < indexed.length; i++) {
      const suffix = indexed[i]
      const key = (prefix << 16) | suffix
      if (codeDict[key] !== undefined) {
        prefix = codeDict[key]
      } else {
        output(prefix, codeSize)
        codeDict[key] = nextCode++
        if (nextCode > (1 << codeSize)) {
          codeSize++
          if (codeSize > 12) {
            output(clearCode, codeSize - 1)
            codeDict = {}
            codeSize = minCodeSize + 1
            nextCode = eoiCode + 1
          }
        }
        prefix = suffix
      }
    }

    output(prefix, codeSize)
    output(eoiCode, codeSize)

    if (bufBits > 0) {
      bufs.push(buf & 0xFF)
    }

    // 封装为 GIF sub-blocks (每块最多 255 字节)
    const subBlocks = []
    let pos = 0
    while (pos < bufs.length) {
      const chunkLen = Math.min(255, bufs.length - pos)
      subBlocks.push(chunkLen)
      for (let j = 0; j < chunkLen; j++) {
        subBlocks.push(bufs[pos + j])
      }
      pos += chunkLen
    }
    subBlocks.push(0) // block terminator

    return Buffer.from(subBlocks)
  }
}

// ─── 主流程: 使用 Electron 渲染+截图 ──────────────

async function main() {
  // 动态导入 Electron
  let electron
  try {
    electron = await import('electron')
  } catch {
    console.error('❌ 无法加载 Electron。请在 Electron 环境中运行此脚本。')
    console.error('   或者使用: npx electron scripts/screenshot-components.mjs')
    process.exit(1)
  }

  const { app, BrowserWindow } = electron

  await app.whenReady()

  const manifest = {}
  let success = 0
  let failed = 0

  // 创建一个 BrowserWindow (复用)
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const entry = cache[id]
    const gifPath = join(OUTPUT_DIR, `${id}.gif`)

    // 跳过已存在的 (除非 --force)
    if (!force && existsSync(gifPath)) {
      try {
        const stat = statSync(gifPath)
        if (stat.size > 500) {
          manifest[id] = `${id}.gif`
          success++
          continue
        }
      } catch { /* ignore */ }
    }

    const html = buildHtml(entry)

    try {
      // 加载 HTML
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      // 等待初始渲染
      await new Promise(r => setTimeout(r, INITIAL_WAIT_MS))

      // 多帧截图
      const encoder = new GifEncoder(WIDTH, HEIGHT)
      for (let f = 0; f < FRAME_COUNT; f++) {
        const image = await win.webContents.capturePage()
        const bitmap = image.toBitmap()  // BGRA
        // 转换 BGRA → RGBA
        const rgba = new Uint8Array(bitmap.length)
        for (let j = 0; j < bitmap.length; j += 4) {
          rgba[j] = bitmap[j + 2]     // R
          rgba[j + 1] = bitmap[j + 1] // G
          rgba[j + 2] = bitmap[j]     // B
          rgba[j + 3] = bitmap[j + 3] // A
        }
        encoder.addFrame(rgba, FRAME_INTERVAL_MS / 10) // GIF delay 单位是 1/100 秒
        await new Promise(r => setTimeout(r, FRAME_INTERVAL_MS))
      }

      const gifBuf = encoder.encode()
      writeFileSync(gifPath, gifBuf)
      manifest[id] = `${id}.gif`
      success++
      console.log(`  ✅ [${i + 1}/${ids.length}] ${id} (${(gifBuf.length / 1024).toFixed(0)}KB)`)
    } catch (e) {
      failed++
      // 回退: 尝试截取单帧 PNG
      try {
        const image = await win.webContents.capturePage()
        const pngBuf = image.toPNG()
        const pngPath = join(OUTPUT_DIR, `${id}.png`)
        writeFileSync(pngPath, pngBuf)
        manifest[id] = `${id}.png`
        console.log(`  ⚠️ [${i + 1}/${ids.length}] ${id} → PNG fallback (${(pngBuf.length / 1024).toFixed(0)}KB)`)
      } catch {
        manifest[id] = null
        console.log(`  ❌ [${i + 1}/${ids.length}] ${id}: ${e.message?.slice(0, 80)}`)
      }
    }
  }

  win.close()
  app.quit()

  // 写入 manifest
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')

  console.log(`\n✨ 完成: ${success} 成功, ${failed} 失败`)
  console.log(`📁 输出: ${OUTPUT_DIR}`)
}

main().catch(e => {
  console.error('失败:', e)
  process.exit(1)
})
