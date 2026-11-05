import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, Popover, PopoverContent, PopoverTrigger } from '@cherrystudio/ui'

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
    <section aria-label={t('compare.welcome.title')} className="flex min-h-10 shrink-0 items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs">
            {t('compare.welcome.how_it_works')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" className="w-80 space-y-3 p-4">
          <h2 className="text-sm font-semibold">{t('compare.welcome.title')}</h2>
          <ol className="space-y-3 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span>1.</span>
              <span className="flex-1">{t('compare.welcome.step1')}</span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onGoToPanels}>
                {t('compare.welcome.panels_link')}
              </Button>
            </li>
            <li className="flex items-start gap-2">
              <span>2.</span>
              <span className="flex-1">{t('compare.welcome.step2')}</span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onOpenProviders}>
                {t('compare.welcome.providers_link')}
              </Button>
            </li>
            <li className="flex items-start gap-2">
              <span>3.</span>
              <span className="flex-1">{t('compare.welcome.step3')}</span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onFocusPrompt}>
                {t('compare.welcome.prompt_link')}
              </Button>
            </li>
          </ol>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7"
        aria-label={t('compare.welcome.dismiss')}
        onClick={onDismiss}>
        <X className="size-4" />
      </Button>
    </section>
  )
}
