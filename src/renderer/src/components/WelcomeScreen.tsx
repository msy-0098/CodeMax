import { MODE_CONFIGS } from '../modes'
import { Icon } from './Icon'
import type { Mode } from '../../../shared/types'
import { useStore } from '../store/useStore'

interface WelcomeScreenProps {
  mode: Mode
}

export function WelcomeScreen({ mode }: WelcomeScreenProps): React.ReactElement {
  const config = MODE_CONFIGS[mode]
  const sendMessage = useStore((s) => s.sendMessage)

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 animate-fade-in">
      <div className="w-full max-w-2xl">
        {/* 模式标题 */}
        <div className="mb-2 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-muted shadow-xl shadow-accent/20">
            <Icon name={config.icon} size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">{config.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">{config.description}</p>
        </div>

        {/* 快捷操作 */}
        <div className="mt-8">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-text-muted">
            快捷操作
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {config.quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => sendMessage(action.prompt)}
                className="ios-card group flex items-start gap-3 p-3 text-left animate-fade-scale"
                style={{ animationDelay: `${action.id.length * 40}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-all duration-300 group-hover:bg-accent/20 group-hover:shadow-glow group-hover:scale-105">
                  <Icon name={action.icon} size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{action.label}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">
                    {action.prompt.replace(/\[.*?\]/g, '...').slice(0, 40)}…
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
