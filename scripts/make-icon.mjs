/**
 * 将 logo.jpg 处理为四边圆角图标
 *
 * 生成:
 *   build/icon.png     — 256×256 圆角 PNG（electron-builder 安装包图标）
 *   build/icon.ico     — 256×256 ICO（Windows 任务栏/窗口图标）
 *   build/icon-512.png — 512×512 圆角 PNG（高分辨率备份）
 *
 * 用法: node scripts/make-icon.mjs
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = join(__dirname, '..')

const SIZES = [256, 512]
const RADIUS_RATIO = 0.22 // 圆角半径占边长的比例

/**
 * 构造一个带四边圆角的 SVG 蒙版
 * rect 的 rx/ry 即为圆角半径
 */
function roundedMaskSVG(size) {
  const r = Math.round(size * RADIUS_RATIO)
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}"/>
</svg>`
  )
}

async function main() {
  const inputPath = join(root, 'logo.jpg')
  const outDir = join(root, 'build')

  console.log('[make-icon] 读取源图:', inputPath)
  const source = readFileSync(inputPath)

  for (const size of SIZES) {
    const mask = roundedMaskSVG(size)
    const outPath = join(outDir, `icon${size === 256 ? '' : '-' + size}.png`)

    await sharp(source)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toFile(outPath)

    console.log(`[make-icon] ✓ 生成 ${size}×${size} 圆角 PNG: ${outPath}`)
  }

  // 生成 256×256 ICO（Windows 标准格式）
  // ICO 格式 = 6 字节头 + 16 字节目录条目 + PNG 数据
  const png256 = await sharp(source)
    .resize(256, 256, { fit: 'cover', position: 'center' })
    .composite([{ input: roundedMaskSVG(256), blend: 'dest-in' }])
    .png()
    .toBuffer()

  const icoHeader = Buffer.alloc(6)
  icoHeader.writeUInt16LE(0, 0)   // reserved
  icoHeader.writeUInt16LE(1, 2)  // type = ICO
  icoHeader.writeUInt16LE(1, 4)   // 1 image

  const icoDir = Buffer.alloc(16)
  icoDir.writeUInt8(0, 0)         // width = 256 → 0
  icoDir.writeUInt8(0, 1)         // height = 256 → 0
  icoDir.writeUInt8(0, 2)         // no palette
  icoDir.writeUInt8(0, 3)         // reserved
  icoDir.writeUInt16LE(1, 4)      // color planes
  icoDir.writeUInt16LE(32, 6)     // bits per pixel
  icoDir.writeUInt32LE(png256.length, 8)  // image size
  icoDir.writeUInt32LE(22, 12)    // offset = header(6) + dir(16)

  const icoPath = join(outDir, 'icon.ico')
  writeFileSync(icoPath, Buffer.concat([icoHeader, icoDir, png256]))
  console.log(`[make-icon] ✓ 生成 256×256 圆角 ICO: ${icoPath}`)

  // 生成 favicon.ico（16+32+48 多尺寸 ICO，用于 index.html）
  const favSizes = [16, 32, 48]
  const favPngs = []
  for (const s of favSizes) {
    const png = await sharp(source)
      .resize(s, s, { fit: 'cover', position: 'center' })
      .composite([{ input: roundedMaskSVG(s), blend: 'dest-in' }])
      .png()
      .toBuffer()
    favPngs.push({ size: s, png })
  }

  const favHeader = Buffer.alloc(6)
  favHeader.writeUInt16LE(0, 0)
  favHeader.writeUInt16LE(1, 2)
  favHeader.writeUInt16LE(favPngs.length, 4)

  let offset = 6 + 16 * favPngs.length
  const dirEntries = []
  for (const { size, png } of favPngs) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size === 256 ? 0 : size, 0)
    entry.writeUInt8(size === 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    dirEntries.push(entry)
    offset += png.length
  }

  const favPath = join(outDir, 'favicon.ico')
  writeFileSync(favPath, Buffer.concat([
    favHeader,
    ...dirEntries,
    ...favPngs.map(p => p.png)
  ]))
  console.log(`[make-icon] ✓ 生成 favicon.ico: ${favPath}`)

  // 同步 favicon.ico 到 src/renderer/public/（供 index.html 引用）
  const rendererPublicDir = join(root, 'src', 'renderer', 'public')
  const rendererFavPath = join(rendererPublicDir, 'favicon.ico')
  const { mkdirSync, copyFileSync } = await import('fs')
  try {
    mkdirSync(rendererPublicDir, { recursive: true })
    copyFileSync(favPath, rendererFavPath)
    console.log(`[make-icon] ✓ 同步 favicon.ico 到 src/renderer/public/`)
  } catch {
    console.warn(`[make-icon] ⚠ 跳过同步 favicon.ico 到 renderer/public`)
  }

  console.log('[make-icon] 全部完成！')
}

main().catch((e) => {
  console.error('[make-icon] 失败:', e)
  process.exit(1)
})
