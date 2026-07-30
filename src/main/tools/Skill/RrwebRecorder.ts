import { join } from 'path'
import { fileURLToPath } from 'url'
import type { Page } from 'playwright'
import { appendRrwebEvent } from '../../SkillStore'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/** rrweb UMD bundle 的文件路径 */
const RRWEB_BUNDLE_PATH = join(__dirname, '../../../node_modules/rrweb/dist/rrweb.umd.cjs')

/**
 * RrwebRecorder — 在 Playwright 页面中注入 rrweb 录制代码
 * 
 * 工作原理：
 * 1. 通过 page.addScriptTag() 注入 rrweb UMD bundle（比 evaluate 更高效）
 * 2. 通过 page.exposeFunction() 暴露回调，让 rrweb 事件回传到主进程 SkillStore
 * 3. 在页面上启动 rrweb.record()，事件通过回调传回主进程
 */
export class RrwebRecorder {
  private static instance: RrwebRecorder
  private recordingPage: Page | null = null

  static getInstance(): RrwebRecorder {
    if (!RrwebRecorder.instance) {
      RrwebRecorder.instance = new RrwebRecorder()
    }
    return RrwebRecorder.instance
  }

  /**
   * 在指定页面上启动 rrweb 录制
   */
  async startRecording(page: Page): Promise<void> {
    this.recordingPage = page

    // 1. 暴露回调函数，让页面中的 rrweb 可以将事件回传到主进程
    await page.exposeFunction('__rrwebEmit', (event: Record<string, unknown>) => {
      appendRrwebEvent(event)
    })

    // 2. 注入 rrweb UMD bundle（使用 addScriptTag 比 evaluate 更高效）
    await page.addScriptTag({ path: RRWEB_BUNDLE_PATH })

    // 3. 启动 rrweb 录制
    await page.evaluate(() => {
      // @ts-ignore rrweb 通过 UMD bundle 注入后挂在 window.rrweb 上
      const stopFn = rrweb.record({
        emit(event) {
          // @ts-ignore 暴露的全局函数
          window.__rrwebEmit(event)
        }
      })
      // 将 stopFn 保存到 window 上，便于后续调用
      // @ts-ignore
      window.__rrwebStopFn = stopFn
    })
  }

  /**
   * 停止 rrweb 录制，调用页面上的 stopFn
   */
  async stopRecording(): Promise<void> {
    if (!this.recordingPage) {
      return
    }

    try {
      await this.recordingPage.evaluate(() => {
        // @ts-ignore
        if (window.__rrwebStopFn) {
          // @ts-ignore
          window.__rrwebStopFn()
          // @ts-ignore
          window.__rrwebStopFn = null
        }
      })
    } catch {
      // 页面可能已关闭，忽略错误
    }

    this.recordingPage = null
  }

  /**
   * 重新注入 rrweb 录制到当前页面（页面导航后需要重新初始化）
   */
  async reInjectAfterNavigation(page: Page): Promise<void> {
    try {
      await this.stopRecording()
    } catch { /* 忽略 */ }

    this.recordingPage = page

    try {
      await page.exposeFunction('__rrwebEmit', (event: Record<string, unknown>) => {
        appendRrwebEvent(event)
      })
    } catch {
      // exposeFunction 可能已存在（页面没有真正重载），忽略
    }

    try {
      await page.addScriptTag({ path: RRWEB_BUNDLE_PATH })
      await page.evaluate(() => {
        // @ts-ignore
        const stopFn = rrweb.record({
          emit(event) {
            // @ts-ignore
            window.__rrwebEmit(event)
          }
        })
        // @ts-ignore
        window.__rrwebStopFn = stopFn
      })
    } catch {
      // 注入失败可能是页面还没加载完成，忽略
    }
  }
}
