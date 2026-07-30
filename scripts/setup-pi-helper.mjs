#!/usr/bin/env node
/**
 * setup-pi-helper.mjs — 安装 pi-computer-use Windows Helper
 *
 * 用法：
 *   node scripts/setup-pi-helper.mjs          # 从 prebuilt 目录安装
 *   node scripts/setup-pi-helper.mjs --check  # 仅检查是否已安装
 *
 * Windows Helper 会被安装到 Electron userData 目录下的：
 *   pi-computer-use/windows-bridge.exe
 */

import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')

// prebuilt 目录中已编译的 Helper
const PREBUILT_HELPER = join(PROJECT_ROOT, 'prebuilt', 'win-x64', 'windows-bridge.exe')

// 安装目标路径（Electron userData — 硬编码与 app.getPath('userData') 一致）
const userDataDir = join(homedir(), 'AppData', 'Roaming', 'ximo-agent')
const HELPER_DIR = join(userDataDir, 'pi-computer-use')
const HELPER_DEST = join(HELPER_DIR, 'windows-bridge.exe')

function isInstalled(): boolean {
  return existsSync(HELPER_DEST)
}

// 主流程
const args = process.argv.slice(2)
const checkOnly = args.includes('--check')

if (checkOnly) {
  if (isInstalled()) {
    console.log('[pi-computer-use] Windows Helper 已安装。')
    process.exit(0)
  } else {
    console.log('[pi-computer-use] Windows Helper 未安装。')
    process.exit(1)
  }
}

// 检查是否已安装
if (isInstalled()) {
  console.log('[pi-computer-use] Windows Helper 已安装，跳过。')
  process.exit(0)
}

// 从 prebuilt 目录复制
if (!existsSync(PREBUILT_HELPER)) {
  console.error('[pi-computer-use] 未找到 prebuilt Helper，请确保 prebuilt/win-x64/windows-bridge.exe 存在。')
  console.error(`  期望路径：${PREBUILT_HELPER}`)
  process.exit(1)
}

try {
  mkdirSync(HELPER_DIR, { recursive: true })
  copyFileSync(PREBUILT_HELPER, HELPER_DEST)
  console.log(`[pi-computer-use] ✅ Windows Helper 已安装到：${HELPER_DEST}`)
} catch (e) {
  console.error('[pi-computer-use] ❌ 安装失败：', (e as Error).message)
  process.exit(1)
}
