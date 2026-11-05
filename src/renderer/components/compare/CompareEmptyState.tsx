import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'
import MiniAppIcon from '@renderer/components/icons/MiniAppIcon'
import { useMiniApps } from '@renderer/hooks/useMiniApps'
import type { CompareColumnId } from '@renderer/types/compare'
import { getMySubscriptionColumnIds } from '@renderer/utils/compareSubscriptions'
import type { CompareCliAvailability, CompareCliId } from '@shared/types/compareCli'

const WEB_TILES = [
  { appId: 'openai', name: 'ChatGPT', logo: 'openai', aliases: ['chatgpt'] },
  { appId: 'anthropic', name: 'Claude', logo: 'claude', aliases: ['claude'] },
  { appId: 'gemini', name: 'Gemini', logo: 'gemini', aliases: ['gemini'] },
  { appId: 'deepseek', name: 'DeepSeek', logo: 'deepseek', aliases: ['deepseek'] },
  { appId: 'grok', name: 'Grok', logo: 'grok', aliases: ['grok'] },
  { appId: 'microsoft-copilot', name: 'Copilot', logo: 'application', aliases: ['microsoft-copilot', 'copilot'] },
  { appId: 'perplexity', name: 'Perplexity', logo: 'perplexity', aliases: ['perplexity'] },
  { appId: 'meta-ai', name: 'Meta AI', logo: 'application', aliases: ['meta-ai', 'meta ai'] },
  { appId: 'moonshot', name: 'Kimi', logo: 'Moonshot', aliases: ['kimi', 'moonshot'] },
  { appId: 'qwenlm', name: 'Qwen', logo: 'qwen', aliases: ['qwen', 'dashscope'] }
] as const

const CLI_LABELS: Record<CompareCliId, string> = { claude: 'Claude Code', agy: 'Gemini CLI', codex: 'Codex CLI' }

interface CompareEmptyStateProps {
  onAddColumn: (id: CompareColumnId) => void
  onUseSubscriptions: (ids: CompareColumnId[]) => void | Promise<void>
  onOpenModelPicker: () => void
  cliAvailability: readonly CompareCliAvailability[]
}

export function CompareEmptyState({
  onAddColumn,
  onUseSubscriptions,
  onOpenModelPicker,
  cliAvailability
}: CompareEmptyStateProps) {
  const { t } = useTranslation()
  const { allApps, updateAppStatus } = useMiniApps()
  const [busyAppId, setBusyAppId] = useState<string | null>(null)
  const appsByAlias = useMemo(() => {
    const map = new Map<string, (typeof allApps)[number]>()
    for (const app of allApps) {
      map.set(app.appId.toLowerCase(), app)
      map.set(app.name.toLowerCase(), app)
    }
    return map
  }, [allApps])

  const addApp = async (appId: string) => {
    const app = allApps.find((candidate) => candidate.appId === appId)
    if (!app) return
    setBusyAppId(appId)
    try {
      if (app.status === 'disabled') await updateAppStatus(app.appId, 'enabled')
      onAddColumn(`webapp::${encodeURIComponent(app.appId)}`)
    } finally {
      setBusyAppId(null)
    }
  }

  const handleUseSubscriptions = async () => {
    const ids = getMySubscriptionColumnIds(allApps.filter((app) => app.kind === 'site').map((app) => app.appId))
    setBusyAppId('subscriptions')
    try {
      await onUseSubscriptions(ids)
    } finally {
      setBusyAppId(null)
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="m-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-7 shadow-sm">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="text-2xl font-semibold tracking-tight">{t('compare.empty.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('compare.empty.description')}</p>
          <Button
            type="button"
            size="lg"
            className="mt-5"
            disabled={busyAppId === 'subscriptions'}
            onClick={() => void handleUseSubscriptions()}>
            {t('compare.empty.use_subscriptions')}
          </Button>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {WEB_TILES.map((tile) => {
            const app = tile.aliases.map((alias) => appsByAlias.get(alias)).find(Boolean)
            const isDisabled = !app || busyAppId === app.appId
            return (
              <button
                key={tile.appId}
                type="button"
                disabled={isDisabled}
                aria-label={tile.name}
                title={tile.name}
                onClick={() => app && void addApp(app.appId)}
                className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background p-3 text-xs transition-[border-color,background-color,transform] duration-150 ease-out hover:-translate-y-0.5 hover:border-primary/60 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none">
                <MiniAppIcon
                  app={{
                    name: app?.name ?? tile.name,
                    logo: app?.logo ?? tile.logo,
                    logoSrc: app?.logoSrc,
                    background: app?.background
                  }}
                  appearance="plain"
                  size={34}
                />
                <span className="max-w-full truncate">{app?.name ?? tile.name}</span>
              </button>
            )
          })}
          {cliAvailability
            .filter((cli) => cli.available)
            .map(({ id }) => (
              <button
                key={id}
                type="button"
                aria-label={CLI_LABELS[id]}
                onClick={() => onAddColumn(`cli::${id}`)}
                className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background p-3 text-xs transition-[border-color,background-color,transform] duration-150 ease-out hover:-translate-y-0.5 hover:border-primary/60 hover:bg-muted motion-reduce:transform-none motion-reduce:transition-none">
                <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-primary">
                  {CLI_LABELS[id].slice(0, 1)}
                </span>
                <span className="max-w-full truncate">{CLI_LABELS[id]}</span>
              </button>
            ))}
        </div>
        <div className="mt-5 flex justify-center">
          <Button type="button" variant="outline" onClick={onOpenModelPicker}>
            + {t('compare.empty.add_api_model')}
          </Button>
        </div>
      </div>
    </section>
  )
}
