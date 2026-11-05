import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@cherrystudio/ui'

interface FiestaPlaceholderPageProps {
  titleKey: string
  descriptionKey: string
  footer?: ReactNode
}

export default function FiestaPlaceholderPage({ titleKey, descriptionKey, footer }: FiestaPlaceholderPageProps) {
  const { t } = useTranslation()

  return (
    <main className="flex h-full min-h-0 w-full flex-col bg-background">
      <EmptyState title={t(titleKey)} description={t(descriptionKey)} className="flex-1" />
      {footer}
    </main>
  )
}
