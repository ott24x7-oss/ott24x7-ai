import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'

interface CompareWelcomeCardProps {
  onDismiss: () => void
  onGoToPanels: () => void
  onOpenProviders: () => void
  onFocusPrompt: () => void
}

export function CompareWelcomeCard({
  onDismiss,
  onGoToPanels,
  onOpenProviders,
  onFocusPrompt
}: CompareWelcomeCardProps) {
  const { t } = useTranslation()

  return (
    <section
      aria-labelledby="compare-welcome-title"
      className="shrink-0 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <h2 id="compare-welcome-title" className="text-sm font-semibold">
          {t('compare.welcome.title')}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 size-8 shrink-0"
          aria-label={t('compare.welcome.dismiss')}
          onClick={onDismiss}>
          <X className="size-4" />
        </Button>
      </div>

      <ol className="mt-2 grid gap-x-5 gap-y-2 md:grid-cols-3">
        <li className="flex min-w-0 gap-2">
          <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
            1.
          </span>
          <div className="min-w-0">
            <p className="text-sm text-foreground">{t('compare.welcome.step1')}</p>
            <Button type="button" variant="link" size="sm" className="h-auto px-0 py-0 text-xs" onClick={onGoToPanels}>
              {t('compare.welcome.panels_link')}
            </Button>
          </div>
        </li>
        <li className="flex min-w-0 gap-2">
          <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
            2.
          </span>
          <div className="min-w-0">
            <p className="text-sm text-foreground">{t('compare.welcome.step2')}</p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 py-0 text-xs"
              onClick={onOpenProviders}>
              {t('compare.welcome.providers_link')}
            </Button>
          </div>
        </li>
        <li className="flex min-w-0 gap-2">
          <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
            3.
          </span>
          <div className="min-w-0">
            <p className="text-sm text-foreground">{t('compare.welcome.step3')}</p>
            <Button type="button" variant="link" size="sm" className="h-auto px-0 py-0 text-xs" onClick={onFocusPrompt}>
              {t('compare.welcome.prompt_link')}
            </Button>
          </div>
        </li>
      </ol>
    </section>
  )
}
