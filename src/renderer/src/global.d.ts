// 渲染进程全局类型声明：暴露 preload 注入的 window.api
import type { Api } from '../../preload'

declare global {
  interface Window {
    api: Api
  }
}
