import { useRef, useState, useEffect } from 'react'
import { Send, Square } from 'lucide-react'

interface ReasonixInputProps {
  onSend: (text: string) => void
  onStop: () => void
  isStreaming: boolean
  projectPath: string
}

const SLASH_COMMANDS: { cmd: string; prompt: string }[] = [
  { cmd: '/plan', prompt: '【Plan 模式】请帮我规划以下任务的执行方向。\n\n要求：\n1. 分析任务，识别关键决策点和不确定项\n2. 对每个不确定项，用 plan_ask 工具实时向用户提问\n3. 收集所有回答后，整理执行方案\n4. 用 plan_ask 工具向用户展示方案并请求确认\n5. 用户确认后开始执行\n\n任务描述：' },
  { cmd: '/spec', prompt: '【Spec 模式】请根据以下需求细化完整的规范文档。\n\n要求：\n1. 分析需求，拆解为具体任务项\n2. 为每项任务定义验收标准\n3. 用 spec_review 工具将完整规范弹窗展示给用户审核\n4. 用户确认后严格按照规范执行，不做范围外修改\n\n需求描述：' }
]

export function ReasonixInput({
  onSend,
  onStop,
  isStreaming,
  projectPath
}: ReasonixInputProps): React.ReactElement {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const handleSlashCommand = (prompt: string): void => {
    setText((prev) => {
      if (prev.trim()) return prev
      return prompt + ' '
    })
    textareaRef.current?.focus()
  }

  return (
    <div className="border-t border-border-subtle glass px-4 py-3">
      {/* 输入框 */}
      <div className="flex items-end gap-2 rounded-[22px] border border-border bg-bg-elevated/80 backdrop-blur-xl px-4 py-3 transition-all duration-300 ease-out-quart focus-within:border-accent/60 focus-within:shadow-glow">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={projectPath ? `在 ${projectPath} 中编写代码...` : '描述你的编码需求，Enter 发送'}
          rows={1}
          className="no-drag max-h-[220px] flex-1 resize-none bg-transparent text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex shrink-0 items-center justify-center rounded-full bg-red-500 px-3 py-2 text-white shadow-[0_0_14px_rgba(239,68,68,0.45)] transition-all duration-200 hover:bg-red-600 hover:scale-105 active:scale-90"
            title="停止生成"
          >
            <Square size={16} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="btn-liquid flex shrink-0 items-center justify-center rounded-full px-3 py-2 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none hover:scale-105 active:scale-90"
            title="发送"
          >
            <Send size={16} />
          </button>
        )}
      </div>

      {/* 斜杠命令快捷行 */}
      <div className="mt-2 flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-text-muted mr-1">快捷指令：</span>
        {SLASH_COMMANDS.map(({ cmd, prompt }) => (
          <button
            key={cmd}
            onClick={() => handleSlashCommand(prompt)}
            className="chip px-2 py-0.5 text-[11px] text-text-muted hover:text-accent hover:border-accent/30 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  )
}
