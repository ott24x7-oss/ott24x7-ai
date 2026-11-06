import { ArrowRight, BookOpen, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'

interface GuideBannerProps {
  onDismiss: () => void
  onOpenGuide: () => void
}

export function GuideBanner({ onDismiss, onOpenGuide }: GuideBannerProps) {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t('guide.compare_banner.title')}
      className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
      <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 text-xs font-medium">{t('guide.compare_banner.message')}</p>
      <Button type="button" variant="link" size="sm" className="h-7 gap-1 px-1 text-xs" onClick={onOpenGuide}>
        {t('guide.compare_banner.start')}
        <ArrowRight className="size-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7 shrink-0"
        aria-label={t('guide.compare_banner.dismiss')}
        onClick={onDismiss}>
        <X className="size-4" aria-hidden />
      </Button>
    </section>
  )
}
