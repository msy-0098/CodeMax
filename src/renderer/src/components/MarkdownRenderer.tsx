import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { MermaidBlock } from './MermaidBlock'

interface MarkdownRendererProps {
  content: string
  /**
   * 流式期间为 true：代码块跳过语法高亮、mermaid 跳过渲染，
   * 避免不完整的代码/图表在每次流式 flush 时被重复重算（主要卡顿来源）。
   * 流式结束后（false）再完整高亮 / 渲染一次。
   */
  streaming?: boolean
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, streaming = false }: MarkdownRendererProps): React.ReactElement {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块：区分 mermaid 与普通代码
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const lang = match ? match[1] : ''
            const text = String(children).replace(/\n$/, '')

            // mermaid 代码块
            if (lang === 'mermaid') {
              return <MermaidBlock chart={text} streaming={streaming} />
            }

            // 带语言标注的多行代码块
            if (lang) {
              return <CodeBlock language={lang} value={text} streaming={streaming} />
            }

            // 行内代码
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          // 链接新窗口打开
          a({ children, href }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
