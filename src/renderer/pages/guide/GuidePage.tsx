import { useTranslation } from 'react-i18next'

import { GuideContent } from './GuideContent'

export default function GuidePage() {
  const { t } = useTranslation()

  return (
    <main aria-label={t('guide.title')} className="h-full min-h-0 overflow-y-auto bg-background text-foreground">
      <GuideContent />
    </main>
  )
}
