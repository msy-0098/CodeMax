import { MODE_CONFIGS } from './modes'
import { QuickActionCards } from './components/shared/QuickActionCards'
import { Icon } from './components/Icon'
import type { QuickAction } from '../../shared/types'
import { useStore } from './store/useStore'

export function OfficeWelcome(): React.ReactElement {
  const config = MODE_CONFIGS.office
  const sendMessage = useStore((s) => s.sendMessage)

  const handleAction = (action: QuickAction): void => {
    sendMessage(action.prompt)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 animate-fade-in">
      <div className="w-full max-w-3xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-muted shadow-xl shadow-accent/20">
            <Icon name={config.icon} size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">{config.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">{config.description}</p>
        </div>
        {config.actionGroups && <QuickActionCards actionGroups={config.actionGroups} onAction={handleAction} />}
      </div>
    </div>
  )
}
