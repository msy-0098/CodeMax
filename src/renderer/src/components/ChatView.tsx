import { useEffect, useRef } from 'react'
import { MODE_CONFIGS } from '../modes'
import { useStore } from '../store/useStore'
import { SessionTokenStats } from './shared/SessionTokenStats'
import { MessageItem } from './MessageItem'
import { ChatInput } from './ChatInput'
import { WelcomeScreen } from './WelcomeScreen'
import { Icon } from './Icon'
import { ToolPanel } from './ToolPanel'

export function ChatView(): React.ReactElement {
  const {
    conversations,
    currentConversationId,
    currentMode,
    isStreaming,
    streamingContent,
    streamingReasoning,
    streamingConversationId,
    streamingTokens,
    streamingToolCalls,
    streamingSegments,
    error,
    sendMessage,
    cancelStream,
    regenerate
  } = useStore()

  const conversation = conversations.find((c) => c.id === currentConversationId) ?? null
  const fontSize = useStore((s) => s.settings?.fontSize ?? 'md')
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [conversation?.messages.length, streamingContent, streamingReasoning, streamingSegments])

  // 欢迎屏（无会话或空会话）
  if (!conversation || conversation.messages.length === 0) {
    const mode = conversation?.mode ?? currentMode
    return (
      <div className="flex h-full flex-col">
        <ChatHeader mode={mode} title={conversation?.title} />
        <div className="flex-1 overflow-hidden">
          <WelcomeScreen mode={mode} />
        </div>
        {error && <ErrorBanner message={error} />}
        <ChatInput onSend={sendMessage} onStop={cancelStream} isStreaming={isStreaming} />
      </div>
    )
  }

  const modeConfig = MODE_CONFIGS[conversation.mode]
  const isStreamingThis = isStreaming && streamingConversationId === conversation.id
  const messages = conversation.messages
  const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === 'assistant')
  const lastAssistantRealIdx = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1

  return (
    <div className="flex h-full flex-col">
      <ChatHeader mode={conversation.mode} title={conversation.title} />

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className={`mx-auto max-w-3xl space-y-5 px-4 py-6 chat-fs-${fontSize}`}>
          {messages.map((msg, idx) => (
            <MessageItem
              key={msg.id}
              message={msg}
              canRegenerate={
                !isStreaming &&
                msg.role === 'assistant' &&
                idx === lastAssistantRealIdx
              }
              onRegenerate={regenerate}
            />
          ))}

          {/* 流式消息 */}
          {isStreamingThis && (
            <MessageItem
              message={{
                id: 'streaming',
                role: 'assistant',
                content: streamingContent,
                reasoningContent: streamingReasoning,
                timestamp: Date.now()
              }}
              isStreaming
              streamingContent={streamingContent}
              streamingReasoning={streamingReasoning}
              streamingToolCalls={streamingToolCalls}
              streamingSegments={streamingSegments}
            />
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      <SessionTokenStats conversation={conversation} />

      <ChatInput
        onSend={sendMessage}
        onStop={cancelStream}
        isStreaming={isStreaming}
        placeholder={`在${modeConfig.name}中提问...`}
      />
    </div>
  )
}

// 顶部栏
function ChatHeader({
  mode,
  title
}: {
  mode: 'office' | 'coding' | 'design'
  title?: string
}): React.ReactElement {
  const settings = useStore((s) => s.settings)
  const config = MODE_CONFIGS[mode]
  return (
    <div className="flex items-center justify-between border-b border-border-subtle glass px-5 py-2.5">
      <div className="flex items-center gap-2 no-drag">
        <Icon name={config.icon} size={16} className="text-accent" />
        <span className="text-sm font-medium text-text-secondary">{config.name}</span>
        {title && (
          <>
            <span className="text-text-muted">·</span>
            <span className="text-sm text-text-primary">{title}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 no-drag">
        {settings && (
          <span className="chip px-2 py-0.5 text-[11px] text-text-muted">
            {settings.thinkingMode ? '思考' : '快速'} · {settings.model.includes('pro') ? 'V4-Pro' : 'V4-Flash'}
          </span>
        )}
      </div>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }): React.ReactElement {
  return (
    <div className="mx-4 mb-1 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
      <span className="text-xs">⚠</span>
      <span className="flex-1">{message}</span>
    </div>
  )
}
