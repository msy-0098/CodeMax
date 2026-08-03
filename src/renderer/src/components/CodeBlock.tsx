import { memo, useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeBlockProps {
  language: string
  value: string
}

// react-syntax-highlighter 延迟加载 — 首次渲染代码块时才动态导入
type SyntaxHighlighterStyle = Record<string, CSSProperties>
let highlighterPromise: Promise<{ Component: React.FC<Record<string, unknown>>; style: SyntaxHighlighterStyle }> | null = null

function loadHighlighter(): Promise<{ Component: React.FC<Record<string, unknown>>; style: SyntaxHighlighterStyle }> {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import('react-syntax-highlighter'),
      import('react-syntax-highlighter/dist/esm/styles/prism')
    ]).then(([mod, styles]) => ({
      Component: mod.Prism as unknown as React.FC<Record<string, unknown>>,
      style: styles.vscDarkPlus as SyntaxHighlighterStyle
    }))
  }
  return highlighterPromise
}

export const CodeBlock = memo(function CodeBlock({ language, value }: CodeBlockProps): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [highlighter, setHighlighter] = useState<{ Component: React.FC<Record<string, unknown>>; style: SyntaxHighlighterStyle } | null>(null)

  useEffect(() => {
    if (!highlighter) {
      let cancelled = false
      loadHighlighter().then((result) => {
        if (!cancelled) setHighlighter(result)
      })
      return () => { cancelled = true }
    }
  }, [highlighter])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const handleCopy = (): void => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-border-subtle bg-[#0d1117] shadow-glass transition-all hover:border-border-hover">
      {/* 语言标签 + 复制按钮 */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-elevated px-3 py-1.5">
        <span className="text-xs font-mono text-text-secondary">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="icon-btn flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      {highlighter ? (
        <highlighter.Component
          language={language || 'text'}
          style={highlighter.style}
          customStyle={{
            margin: 0,
            padding: '14px 16px',
            background: 'transparent',
            fontSize: '13.5px',
            lineHeight: '1.6'
          }}
          codeTagProps={{ style: { fontFamily: 'JetBrains Mono, Consolas, monospace' } }}
          wrapLongLines={false}
        >
          {value}
        </highlighter.Component>
      ) : (
        <pre className="overflow-x-auto" style={{ margin: 0, padding: '14px 16px', background: 'transparent', fontSize: '13.5px', lineHeight: '1.6', fontFamily: 'JetBrains Mono, Consolas, monospace' }}>
          <code>{value}</code>
        </pre>
      )}
    </div>
  )
})
