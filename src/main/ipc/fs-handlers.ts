import { ipcMain } from 'electron'
import type { FileTreeNode } from '../../shared/types'

export function registerFsHandlers(): void {
  // 文件树列表 — 供渲染进程直接读取项目目录结构
  ipcMain.handle('fs:listDir', async (_event, dirPath: string, maxDepth?: number) => {
    const { readdir, stat } = await import('fs/promises')
    const { join } = await import('path')
    const depth = Math.min(maxDepth ?? 3, 5)

    const excludeDirs = new Set([
      'node_modules', '.git', '.svn', 'dist', 'out', 'build', 'release',
      '.next', '.nuxt', 'coverage', '__pycache__', '.cache', '.idea', '.vscode',
      '.reasonix', '.trae', '.meituan-catpaw'
    ])

    async function buildTree(dir: string, currentDepth: number): Promise<FileTreeNode[]> {
      if (currentDepth >= depth) return []
      const nodes: FileTreeNode[] = []
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (excludeDirs.has(entry.name)) continue
          if (entry.name.startsWith('.') && entry.name !== '.gitignore' && entry.name !== '.env.example') continue

          const fullPath = join(dir, entry.name)
          const isDir = entry.isDirectory()
          let size: number | undefined
          if (!isDir) {
            try { size = (await stat(fullPath)).size } catch { /* skip */ }
          }

          nodes.push({
            name: entry.name,
            path: fullPath,
            type: isDir ? 'directory' : 'file',
            size,
            children: isDir ? await buildTree(fullPath, currentDepth + 1) : undefined
          })
        }
      } catch { /* 无权限或不存在 */ }

      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return nodes
    }

    return buildTree(dirPath, 0)
  })

  // 读取文件内容（供渲染进程 @file 引用注入上下文）
  ipcMain.handle('fs:readFileContent', async (_event, filePath: string, maxLines?: number) => {
    const { readFile } = await import('fs/promises')
    const { resolve, normalize } = await import('path')
    const { existsSync } = await import('fs')

    const normalized = normalize(resolve(filePath))
    if (!existsSync(normalized)) {
      return { success: false, error: `文件不存在：${normalized}` }
    }

    try {
      const buffer = await readFile(normalized)
      // 限制 2MB
      if (buffer.length > 2 * 1024 * 1024) {
        return { success: false, error: `文件过大 (${(buffer.length / 1024).toFixed(0)}KB)，超过 2MB 限制` }
      }
      let content = buffer.toString('utf-8')
      const totalLines = content.split('\n').length
      const limit = maxLines ?? 500
      if (limit > 0 && totalLines > limit) {
        content = content.split('\n').slice(0, limit).join('\n') + `\n...(仅显示前 ${limit} 行，共 ${totalLines} 行)`
      }
      return { success: true, content, totalLines, filePath: normalized }
    } catch (e) {
      return { success: false, error: `读取失败：${(e as Error).message}` }
    }
  })

  // 恢复文件快照（用于代码变更拒绝/版本回退）
  ipcMain.handle('fs:revertFile', async (_event, snapshotPath: string, targetPath: string) => {
    const { copyFile } = await import('fs/promises')
    const { existsSync } = await import('fs')
    const { resolve, normalize } = await import('path')

    const snap = normalize(resolve(snapshotPath))
    const target = normalize(resolve(targetPath))

    if (!existsSync(snap)) {
      return { success: false, error: `快照不存在：${snap}` }
    }
    try {
      await copyFile(snap, target)
      return { success: true, message: `已恢复：${target}` }
    } catch (e) {
      return { success: false, error: `恢复失败：${(e as Error).message}` }
    }
  })

  // 列出文件快照（用于版本回退 UI）
  ipcMain.handle('fs:listSnapshots', async (_event, targetFilePath?: string) => {
    const { readdir, stat } = await import('fs/promises')
    const { join, basename } = await import('path')
    const { tmpdir } = await import('os')

    const snapDir = join(tmpdir(), 'ximo-agent-snapshots')
    try {
      const files = await readdir(snapDir)
      const snapshots: Array<{ name: string; path: string; size: number; mtime: number }> = []

      for (const name of files) {
        if (!name.endsWith('.bak')) continue
        const fullPath = join(snapDir, name)
        try {
          const s = await stat(fullPath)
          // 如果指定了目标文件，则过滤匹配的快照
          if (targetFilePath) {
            const targetBase = basename(targetFilePath).replace(/[^\w.-]/g, '_')
            if (!name.startsWith(targetBase)) continue
          }
          snapshots.push({ name, path: fullPath, size: s.size, mtime: s.mtime.getTime() })
        } catch {
          // skip
        }
      }

      // 按修改时间倒序
      snapshots.sort((a, b) => b.mtime - a.mtime)
      return { success: true, snapshots }
    } catch {
      return { success: true, snapshots: [] }
    }
  })

  // 写入文件内容
  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    const { writeFile, mkdir } = await import('fs/promises')
    const { resolve, normalize, dirname } = await import('path')
    const { existsSync } = await import('fs')

    const normalized = normalize(resolve(filePath))
    try {
      // 确保父目录存在
      const dir = dirname(normalized)
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }
      await writeFile(normalized, content, 'utf-8')
      return { success: true, filePath: normalized }
    } catch (e) {
      return { success: false, error: `写入失败：${(e as Error).message}` }
    }
  })

  // 删除文件
  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    const { unlink, rm } = await import('fs/promises')
    const { resolve, normalize } = await import('path')
    const { existsSync, statSync } = await import('fs')

    const normalized = normalize(resolve(filePath))
    if (!existsSync(normalized)) {
      return { success: false, error: `文件不存在：${normalized}` }
    }
    try {
      const stat = statSync(normalized)
      if (stat.isDirectory()) {
        await rm(normalized, { recursive: true, force: true })
      } else {
        await unlink(normalized)
      }
      return { success: true, filePath: normalized }
    } catch (e) {
      return { success: false, error: `删除失败：${(e as Error).message}` }
    }
  })

  // 重命名/移动文件
  ipcMain.handle('fs:renameFile', async (_event, oldPath: string, newPath: string) => {
    const { rename } = await import('fs/promises')
    const { resolve, normalize, dirname } = await import('path')
    const { existsSync } = await import('fs')

    const oldNormalized = normalize(resolve(oldPath))
    const newNormalized = normalize(resolve(newPath))
    if (!existsSync(oldNormalized)) {
      return { success: false, error: `源文件不存在：${oldNormalized}` }
    }
    if (existsSync(newNormalized)) {
      return { success: false, error: `目标已存在：${newNormalized}` }
    }
    try {
      // 确保目标父目录存在
      const dir = dirname(newNormalized)
      if (!existsSync(dir)) {
        const { mkdir } = await import('fs/promises')
        await mkdir(dir, { recursive: true })
      }
      await rename(oldNormalized, newNormalized)
      return { success: true, oldPath: oldNormalized, newPath: newNormalized }
    } catch (e) {
      return { success: false, error: `重命名失败：${(e as Error).message}` }
    }
  })

  // 复制文件
  ipcMain.handle('fs:copyFile', async (_event, srcPath: string, destPath: string) => {
    const { copyFile } = await import('fs/promises')
    const { resolve, normalize, dirname } = await import('path')
    const { existsSync } = await import('fs')

    const srcNormalized = normalize(resolve(srcPath))
    const destNormalized = normalize(resolve(destPath))
    if (!existsSync(srcNormalized)) {
      return { success: false, error: `源文件不存在：${srcNormalized}` }
    }
    if (existsSync(destNormalized)) {
      return { success: false, error: `目标已存在：${destNormalized}` }
    }
    try {
      const dir = dirname(destNormalized)
      if (!existsSync(dir)) {
        const { mkdir } = await import('fs/promises')
        await mkdir(dir, { recursive: true })
      }
      await copyFile(srcNormalized, destNormalized)
      return { success: true, srcPath: srcNormalized, destPath: destNormalized }
    } catch (e) {
      return { success: false, error: `复制失败：${(e as Error).message}` }
    }
  })

  // 设计组件库 — 读取 react-bits 组件源码
  ipcMain.handle('design:readComponent', async (_event, category: string, componentId: string) => {
    const { readFileSync, readdirSync, existsSync } = await import('fs')
    const { join, dirname } = await import('path')

    // 解析 ui-components 目录（与 DesignComponentTool 相同的策略）
    const mainDir = dirname(new URL(import.meta.url).pathname.replace(/^\//, ''))
    const candidates = [
      join(mainDir, 'tools/Design/ui-components'),
      join(mainDir, 'ui-components'),
      join(process.cwd(), 'src/main/tools/Design/ui-components'),
    ]

    let baseDir = ''
    for (const p of candidates) {
      if (existsSync(p)) { baseDir = p; break }
    }
    if (!baseDir) return { success: false, error: 'ui-components 目录未找到', jsx: '', css: '' }

    const compDir = join(baseDir, category, componentId)
    if (!existsSync(compDir)) return { success: false, error: `组件不存在: ${category}/${componentId}`, jsx: '', css: '' }

    try {
      const files = readdirSync(compDir)
      const jsxFile = files.find(f => f.endsWith('.jsx'))
      const cssFile = files.find(f => f.endsWith('.css'))

      const jsx = jsxFile ? readFileSync(join(compDir, jsxFile), 'utf8') : ''
      const css = cssFile ? readFileSync(join(compDir, cssFile), 'utf8') : ''

      return { success: true, jsx, css }
    } catch (err) {
      return { success: false, error: String(err), jsx: '', css: '' }
    }
  })
}
