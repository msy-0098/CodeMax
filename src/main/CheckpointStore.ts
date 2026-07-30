import { readFile, writeFile, mkdir, rm } from 'fs/promises'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Checkpoint 系统 — 参考 Reasonix 的 checkpoint 包
 *
 * 按用户轮次（turn）记录文件编辑前的状态。每次用户发消息时 Begin 一个新 turn，
 * writer 工具（file_edit/file_write/multi_edit/move_file）在修改前调用 Snapshot 记录原始内容。
 * 回退时 RestoreCode 将所有文件恢复到指定 turn 开始时的状态。
 *
 * 快照存储在系统临时目录下，按会话 ID 分目录，不污染用户项目。
 */

/** 单个文件的快照 */
export interface FileSnap {
  path: string
  /** 编辑前的原始内容，null 表示文件原本不存在（创建操作），回退时删除该文件 */
  content: string | null
}

/** 一个用户轮次的检查点 */
export interface Checkpoint {
  turn: number
  time: number
  prompt: string
  /** 对话消息索引（回退对话的边界） */
  msgIndex: number
  /** 该轮次中所有被修改文件的编辑前快照 */
  files: FileSnap[]
}

/** 检查点元信息（不含文件内容，用于 UI 列表） */
export interface CheckpointMeta {
  turn: number
  time: number
  prompt: string
  paths: string[]
}

/**
 * CheckpointStore — 管理一个会话的检查点
 * 线程安全（Electron 主进程单线程事件循环，但工具可能并行执行）
 */
export class CheckpointStore {
  private dir: string
  private sessionId: string
  /** 已完成的轮次 */
  private done: Checkpoint[] = []
  /** 当前活跃轮次 */
  private cur: Checkpoint | null = null
  /** 当前轮次已快照的路径（去重） */
  private seen: Set<string> = new Set()

  constructor(sessionId: string) {
    this.sessionId = sessionId
    this.dir = join(tmpdir(), 'ximo-agent-checkpoints', sessionId)
    this.load()
  }

  /** 加载磁盘上已有的检查点 */
  private load(): void {
    if (!existsSync(this.dir)) return
    try {
      const entries = readdirSync(this.dir) as string[]
      for (const name of entries) {
        if (!name.endsWith('.json')) continue
        try {
          const raw = readFileSync(join(this.dir, name), 'utf-8')
          const cp = JSON.parse(raw) as Checkpoint
          this.done.push(cp)
        } catch { /* skip corrupt */ }
      }
      this.done.sort((a, b) => a.turn - b.turn)
    } catch { /* dir not accessible */ }
  }

  /** 持久化一个检查点到磁盘 */
  private async persist(cp: Checkpoint): Promise<void> {
    if (!this.dir) return
    try {
      await mkdir(this.dir, { recursive: true })
      // 序列化时使用快照，避免后续 mutation 影响写入内容
      const data = JSON.stringify(cp)
      await writeFile(join(this.dir, `turn-${cp.turn}.json`), data, 'utf-8')
    } catch { /* best effort */ }
  }

  /**
   * Begin — 开启一个新轮次的检查点
   * @param turn 轮次号
   * @param prompt 用户消息文本
   * @param msgIndex 对话消息索引（回退边界）
   */
  begin(turn: number, prompt: string, msgIndex: number): void {
    if (this.cur) {
      this.done.push(this.cur)
    }
    this.cur = { turn, time: Date.now(), prompt, msgIndex, files: [] }
    this.seen = new Set()
    void this.persist(this.cur)
  }

  /**
   * Snapshot — 记录文件编辑前的状态
   * 同一轮次中只记录第一次修改（即轮次开始时的内容）
   */
  async snapshot(filePath: string): Promise<void> {
    if (!this.cur) return
    if (this.seen.has(filePath)) return
    this.seen.add(filePath)

    let content: string | null = null
    if (existsSync(filePath)) {
      try {
        content = await readFile(filePath, 'utf-8')
      } catch {
        content = null
      }
    }

    this.cur.files.push({ path: filePath, content })
    await this.persist(this.cur)
  }

  /** 列出所有检查点的元信息 */
  list(): CheckpointMeta[] {
    const all = [...this.done]
    if (this.cur) all.push(this.cur)
    all.sort((a, b) => a.turn - b.turn)
    return all.map(cp => ({
      turn: cp.turn,
      time: cp.time,
      prompt: cp.prompt,
      paths: cp.files.map(f => f.path)
    }))
  }

  /**
   * RestoreCode — 将工作区恢复到指定 turn 开始时的状态
   * 对于从 fromTurn 起所有被修改的文件，恢复到最早记录的内容（或删除如果原本不存在）
   * @returns 修改和删除的文件路径
   */
  async restoreCode(fromTurn: number): Promise<{ written: string[]; deleted: string[]; errors: string[] }> {
    const all = [...this.done]
    if (this.cur) all.push(this.cur)
    all.sort((a, b) => a.turn - b.turn)

    // 收集从 fromTurn 起所有被修改文件的最早快照
    const earliest = new Map<string, FileSnap>()
    const order: string[] = []
    for (const cp of all) {
      if (cp.turn < fromTurn) continue
      for (const f of cp.files) {
        if (!earliest.has(f.path)) {
          earliest.set(f.path, f)
          order.push(f.path)
        }
      }
    }

    const written: string[] = []
    const deleted: string[] = []
    const errors: string[] = []

    for (const p of order) {
      const snap = earliest.get(p)!
      if (snap.content === null) {
        // 文件原本不存在，删除
        try {
          if (existsSync(p)) {
            await rm(p)
            deleted.push(p)
          }
        } catch (e) {
          errors.push(`删除 ${p}: ${(e as Error).message}`)
        }
      } else {
        // 恢复原始内容
        try {
          await writeFile(p, snap.content, 'utf-8')
          written.push(p)
        } catch (e) {
          errors.push(`恢复 ${p}: ${(e as Error).message}`)
        }
      }
    }

    // 截断检查点列表
    this.done = this.done.filter(cp => cp.turn < fromTurn)
    if (this.cur && this.cur.turn >= fromTurn) {
      this.cur = null
      this.seen = new Set()
    }

    // 清理磁盘上被截断的检查点文件
    for (const cp of all) {
      if (cp.turn >= fromTurn) {
        const fp = join(this.dir, `turn-${cp.turn}.json`)
        try { await rm(fp) } catch { /* best effort */ }
      }
    }

    return { written, deleted, errors }
  }

  /** 获取下一个轮次号 */
  nextTurn(): number {
    let next = 0
    for (const cp of this.done) {
      if (cp.turn >= next) next = cp.turn + 1
    }
    if (this.cur && this.cur.turn >= next) next = this.cur.turn + 1
    return next
  }

  /** 获取轮次→消息索引的映射（用于对话回退） */
  bounds(): Map<number, number> {
    const m = new Map<number, number>()
    for (const cp of this.done) {
      m.set(cp.turn, cp.msgIndex)
    }
    if (this.cur) {
      m.set(this.cur.turn, this.cur.msgIndex)
    }
    return m
  }

  /** 清理所有检查点 */
  async clear(): Promise<void> {
    this.done = []
    this.cur = null
    this.seen = new Set()
    try {
      if (existsSync(this.dir)) {
        await rm(this.dir, { recursive: true, force: true })
      }
    } catch { /* best effort */ }
  }
}

// ---------- 全局管理 ----------

/** 按会话 ID 管理的检查点存储 */
const stores = new Map<string, CheckpointStore>()

/** 获取或创建会话的检查点存储 */
export function getCheckpointStore(sessionId: string): CheckpointStore {
  let store = stores.get(sessionId)
  if (!store) {
    store = new CheckpointStore(sessionId)
    stores.set(sessionId, store)
  }
  return store
}

/** 删除会话的检查点存储 */
export async function removeCheckpointStore(sessionId: string): Promise<void> {
  const store = stores.get(sessionId)
  if (store) {
    await store.clear()
    stores.delete(sessionId)
  }
}
