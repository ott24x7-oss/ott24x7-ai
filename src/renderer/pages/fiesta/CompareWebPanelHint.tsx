import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'

interface CompareWebPanelHintProps {
  onDismiss: () => void
}

export function CompareWebPanelHint({ onDismiss }: CompareWebPanelHintProps) {
  const { t } = useTranslation()

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
      <span className="min-w-0 flex-1">{t('compare.web_panels_hint')}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={t('compare.web_panels_hint.dismiss')}
        onClick={onDismiss}>
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  )
}
