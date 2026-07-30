import { useRef, useState, useEffect } from 'react'
import { Send, Square } from 'lucide-react'

interface ChatInputProps {
  onSend: (text: string) => void
  onStop: () => void
  isStreaming: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  placeholder = '输入消息，Enter 发送，Shift+Enter 换行'
}: ChatInputProps): React.ReactElement {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整高度
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'
  }, [text])

  const handleSend = (): void => {
    if (isStreaming) return
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border-subtle glass px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-[22px] border border-border bg-bg-elevated/80 backdrop-blur-xl px-3 py-2 transition-all duration-300 ease-out-quart focus-within:border-accent/60 focus-within:shadow-glow">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="no-drag max-h-[220px] flex-1 resize-none bg-transparent text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-3 py-2 text-white shadow-[0_0_14px_rgba(239,68,68,0.45)] transition-all duration-200 hover:bg-red-600 hover:scale-105 active:scale-90"
              title="停止生成"
            >
              <Square size={17} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="btn-liquid flex flex-shrink-0 items-center justify-center rounded-full px-3 py-2 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none hover:scale-105 active:scale-90"
              title="发送"
            >
              <Send size={17} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-text-muted">
          由 DeepSeek-V4 驱动 · 内容仅供参考
        </p>
      </div>
    </div>
  )
}
