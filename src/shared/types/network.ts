// ====== 网络抓包 & 录制事件类型（无依赖） ======

/** 抓包捕获的网络请求 */
export interface CapturedRequest {
  id: string
  url: string
  method: string
  resourceType: string
  statusCode?: number
  timestamp: number
  duration?: number
  completedAt?: number
}

/** 录制时从内嵌浏览器捕获的用户操作事件 */
export interface RecordedEvent {
  type: 'navigate' | 'click' | 'input'
  url?: string
  selector?: string
  text?: string
  value?: string
  timestamp: number
}
