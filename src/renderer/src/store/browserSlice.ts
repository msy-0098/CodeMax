import type { CapturedRequest, Skill, RecordingSession } from '../../../shared/types'
import type { StoreState } from './useStore'

type Set = (partial: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)) => void
type Get = () => StoreState

export interface BrowserSlice {
  // ---- 内嵌浏览器 & 工具后台状态 ----
  browserOpen: boolean
  browserUrl: string
  isBrowserRecording: boolean
  computerUseRunning: boolean
  capturedRequests: CapturedRequest[]

  // ---- 技能 ----
  skills: Skill[]
  isRecordingSkill: boolean
  recordingSession: RecordingSession | null

  // ---- 浏览器 & 工具后台方法 ----
  toggleBrowser: () => void
  setBrowserUrl: (url: string) => void
  toggleBrowserRecording: () => void
  toggleComputerUse: () => Promise<void>
  refreshCapturedRequests: () => Promise<void>
  clearCapturedRequests: () => Promise<void>
  refreshComputerUseStatus: () => Promise<void>

  // ---- 技能方法 ----
  loadSkills: () => Promise<void>
  startRecordingSkill: (url?: string) => Promise<void>
  stopRecordingSkill: () => Promise<void>
  refreshRecordingStatus: () => Promise<void>
  deleteSkill: (id: string) => Promise<void>
}

export function createBrowserSlice(set: Set, get: Get): BrowserSlice {
  return {
    // ---- 状态 ----
    browserOpen: false,
    browserUrl: 'about:blank',
    isBrowserRecording: false,
    computerUseRunning: false,
    capturedRequests: [],
    skills: [],
    isRecordingSkill: false,
    recordingSession: null,

    // ---- 浏览器 & 工具后台 ----
    toggleBrowser: () => {
      set((s) => {
        if (s.browserOpen) {
          if (s.isBrowserRecording) {
            void window.api.networkCapture.stop()
          }
          return { browserOpen: false, isBrowserRecording: false, browserUrl: 'about:blank', capturedRequests: [] }
        }
        return { browserOpen: true }
      })
    },

    setBrowserUrl: (url: string) => set({ browserUrl: url }),

    toggleBrowserRecording: () => {
      set((s) => {
        if (s.isBrowserRecording) {
          void window.api.networkCapture.stop()
          return { isBrowserRecording: false }
        }
        void window.api.networkCapture.start()
        return { isBrowserRecording: true }
      })
    },

    toggleComputerUse: async () => {
      const running = get().computerUseRunning
      if (running) {
        await window.api.computerUse.stop()
        set({ computerUseRunning: false })
      } else {
        const result = await window.api.computerUse.start()
        set({ computerUseRunning: result.running })
        if (!result.running && result.error) {
          set({ error: `操控电脑启动失败：${result.error}` })
        }
      }
    },

    refreshCapturedRequests: async () => {
      const requests = await window.api.networkCapture.getRequests()
      set({ capturedRequests: requests })
    },

    clearCapturedRequests: async () => {
      await window.api.networkCapture.clear()
      set({ capturedRequests: [] })
    },

    refreshComputerUseStatus: async () => {
      const status = await window.api.computerUse.status()
      set({ computerUseRunning: status.running })
    },

    // ---- 技能 ----
    loadSkills: async () => {
      try {
        const loaded = await window.api.skills.load()
        set({ skills: loaded })
      } catch { /* ignore */ }
    },

    startRecordingSkill: async (url?: string) => {
      try {
        const session = await window.api.skills.startRecording(url)
        set({ isRecordingSkill: true, recordingSession: session })
      } catch { /* ignore */ }
    },

    stopRecordingSkill: async () => {
      try {
        await window.api.skills.stopRecording()
        set({ isRecordingSkill: false, recordingSession: null })
        await get().loadSkills()
      } catch { /* ignore */ }
    },

    refreshRecordingStatus: async () => {
      try {
        const status = await window.api.skills.recordingStatus()
        set({ isRecordingSkill: status.isRecording, recordingSession: status.session })
      } catch { /* ignore */ }
    },

    deleteSkill: async (id: string) => {
      const updated = get().skills.filter(s => s.id !== id)
      set({ skills: updated })
      await window.api.skills.save(updated)
    },
  }
}
