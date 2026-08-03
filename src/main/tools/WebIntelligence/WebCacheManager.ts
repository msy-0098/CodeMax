import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises'
import { join, normalize, resolve } from 'path'
import { existsSync } from 'fs'
import { createHash } from 'crypto'

interface CacheEntry {
  url: string
  title: string
  content: string
  contentType: string
  fetchedAt: number
  contentHash: string
  sizeBytes: number
}

/**
 * WebCacheManager — 网页内容缓存管理器
 * 将所有抓取过的网页缓存在本地 JSON 文件中
 * 参考 wigolo 的 cache 工具设计
 */
export class WebCacheManager {
  private cacheDir: string
  private index: Map<string, CacheEntry> = new Map()
  private indexLoaded = false
  private cacheEnabled = true
  private maxCacheSizeMB = 100

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || resolve(process.cwd(), '.codemax-cache', 'web')
  }

  async init(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      await mkdir(this.cacheDir, { recursive: true })
    }
    await this.loadIndex()
  }

  /** 获取缓存条目 */
  get(url: string): CacheEntry | undefined {
    return this.index.get(url)
  }

  /** 存入缓存 */
  async put(entry: Omit<CacheEntry, 'contentHash' | 'sizeBytes'>): Promise<void> {
    if (!this.cacheEnabled) return
    const contentHash = createHash('sha256').update(entry.content).digest('hex').slice(0, 16)
    const sizeBytes = Buffer.byteLength(entry.content, 'utf-8')
    const cacheEntry: CacheEntry = { ...entry, contentHash, sizeBytes }
    this.index.set(entry.url, cacheEntry)

    // 异步保存
    await this.saveEntry(cacheEntry)
    await this.saveIndex()
    // 检查缓存大小，超限时清理最旧条目
    await this.evictIfOverLimit()
  }

  /** 设置缓存开关 */
  setEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled
    if (!enabled) {
      // 禁用时不写入新缓存，但保留已有缓存
    }
  }

  /** 设置缓存大小上限（MB） */
  setMaxSizeMB(maxMB: number): void {
    this.maxCacheSizeMB = maxMB
  }

  /** 检查缓存大小，超限时清理最旧条目 */
  private async evictIfOverLimit(): Promise<void> {
    const maxBytes = this.maxCacheSizeMB * 1024 * 1024
    let totalSize = 0
    const entries: { url: string; entry: CacheEntry }[] = []
    for (const [url, entry] of this.index) {
      totalSize += entry.sizeBytes
      entries.push({ url, entry })
    }
    if (totalSize > maxBytes) {
      // 按 fetchedAt 从旧到新排序，清理最旧的
      entries.sort((a, b) => a.entry.fetchedAt - b.entry.fetchedAt)
      while (totalSize > maxBytes && entries.length > 0) {
        const oldest = entries.shift()!
        this.index.delete(oldest.url)
        totalSize -= oldest.entry.sizeBytes
        try { await unlink(join(this.cacheDir, `${oldest.entry.contentHash}.json`)) } catch { /* ignore */ }
      }
    }
  }

  /** 检查内容是否有变化 */
  hasChanged(url: string, newContent: string): boolean {
    const entry = this.index.get(url)
    if (!entry) return true
    const newHash = createHash('sha256').update(newContent).digest('hex').slice(0, 16)
    return entry.contentHash !== newHash
  }

  /** 关键字搜索缓存（本地） */
  search(keyword: string, maxResults = 10): CacheEntry[] {
    const lower = keyword.toLowerCase()
    const results: CacheEntry[] = []
    for (const entry of this.index.values()) {
      if (
        entry.title.toLowerCase().includes(lower) ||
        entry.content.toLowerCase().includes(lower) ||
        entry.url.toLowerCase().includes(lower)
      ) {
        results.push(entry)
      }
    }
    return results.slice(0, maxResults)
  }

  /** 获取缓存统计 */
  stats(): { total: number; totalSizeKB: number; newest: string | null; oldest: string | null } {
    let totalSize = 0
    let newest: string | null = null
    let oldest: string | null = null
    let newestTime = 0
    let oldestTime = Infinity

    for (const entry of this.index.values()) {
      totalSize += entry.sizeBytes
      if (entry.fetchedAt > newestTime) {
        newestTime = entry.fetchedAt
        newest = entry.url
      }
      if (entry.fetchedAt < oldestTime) {
        oldestTime = entry.fetchedAt
        oldest = entry.url
      }
    }

    return {
      total: this.index.size,
      totalSizeKB: Math.round(totalSize / 1024),
      newest,
      oldest
    }
  }

  /** 清空缓存 */
  async clear(): Promise<number> {
    const count = this.index.size
    this.index.clear()
    try {
      const files = await readdir(this.cacheDir)
      for (const file of files) {
        try { await unlink(join(this.cacheDir, file)) } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    return count
  }

  private async loadIndex(): Promise<void> {
    const indexPath = join(this.cacheDir, '_index.json')
    try {
      const data = await readFile(indexPath, 'utf-8')
      const entries: [string, CacheEntry][] = JSON.parse(data)
      this.index = new Map(entries)
    } catch {
      // 缓存索引不存在或损坏
    }
    this.indexLoaded = true
  }

  private async saveIndex(): Promise<void> {
    const indexPath = join(this.cacheDir, '_index.json')
    const data = JSON.stringify([...this.index])
    try {
      await writeFile(indexPath, data, 'utf-8')
    } catch { /* ignore */ }
  }

  private async saveEntry(entry: CacheEntry): Promise<void> {
    const hash = entry.contentHash
    const filePath = join(this.cacheDir, `${hash}.json`)
    try {
      await writeFile(filePath, JSON.stringify(entry), 'utf-8')
    } catch { /* ignore */ }
  }
}

// 全局单例
let instance: WebCacheManager | null = null
export function getCacheManager(): WebCacheManager {
  if (!instance) {
    instance = new WebCacheManager()
    instance.init()
  }
  return instance
}

/** 从 ToolContext 配置缓存管理器 */
export function configureCacheManager(opts: { enabled?: boolean; maxSizeMB?: number }): void {
  const mgr = getCacheManager()
  if (opts.enabled !== undefined) mgr.setEnabled(opts.enabled)
  if (opts.maxSizeMB !== undefined) mgr.setMaxSizeMB(opts.maxSizeMB)
}
