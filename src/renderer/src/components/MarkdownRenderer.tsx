import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { MermaidBlock } from './MermaidBlock'

interface MarkdownRendererProps {
  content: string
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps): React.ReactElement {
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
              return <MermaidBlock chart={text} />
            }

            // 带语言标注的多行代码块
            if (lang) {
              return <CodeBlock language={lang} value={text} />
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
