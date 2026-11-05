import { Gift } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Popover, PopoverContent, PopoverTrigger } from '@cherrystudio/ui'
import { toast } from '@renderer/services/toast'
import { openExternalWebsite } from '@renderer/services/website'
import type { Promo } from '@renderer/utils/promos'
import { cn } from '@renderer/utils/style'

import type { SidebarVisibleLayout } from '../Sidebar'
import { usePromos } from './PromosProvider'

export function PromoExternalLink({
  href,
  children,
  className
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <a
      href={href}
      className={cn('text-link hover:underline focus-visible:underline', className)}
      onClick={(event) => {
        event.preventDefault()
        void openExternalWebsite(href).catch(() => toast.error(t('common.error')))
      }}>
      {children}
    </a>
  )
}

export function SidebarPromoCard({
  layout,
  onOverlayOpenChange
}: {
  layout: SidebarVisibleLayout
  onOverlayOpenChange?: (open: boolean) => void
}) {
  const promos = usePromos()
  const [promoIndex, setPromoIndex] = useState(0)
  const { t } = useTranslation()

  useEffect(() => {
    if (layout !== 'full' || promos.length < 2) return

    const timer = window.setInterval(() => {
      setPromoIndex((index) => (index + 1) % promos.length)
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [layout, promos.length])

  if (promos.length === 0) return null

  if (layout === 'icon') {
    return (
      <Popover onOpenChange={onOverlayOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('promos.our_stores')}
            title={t('promos.our_stores')}
            className="shell-navigation-item size-9 rounded-full">
            <Gift className="size-4.5" strokeWidth={1.6} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="right" className="w-64 space-y-3 p-3">
          <h2 className="text-sm font-medium text-foreground">{t('promos.our_stores')}</h2>
          {promos.map((promo) => (
            <PromoDetails key={promo.id} promo={promo} />
          ))}
        </PopoverContent>
      </Popover>
    )
  }

  const promo = promos[promoIndex % promos.length]

  return (
    <div className="mx-2 mb-1 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2.5">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t('promos.sponsored')}
      </div>
      <PromoDetails promo={promo} compact />
    </div>
  )
}

export function ComparePromoFooter() {
  const promos = usePromos()
  const { t } = useTranslation()
  const aiTools = promos.find((promo) => promo.id === 'ai-tools')
  const officeKeys = promos.find((promo) => promo.id === 'office-keys')

  if (!aiTools || !officeKeys) return null

  return (
    <footer className="flex min-h-9 shrink-0 flex-wrap items-center justify-center gap-x-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
      <span>🛒 {t('promos.ai_tools.short_label')}:</span>
      <PromoExternalLink href={aiTools.url}>{new URL(aiTools.url).hostname}</PromoExternalLink>
      <span aria-hidden="true">·</span>
      <span>🔑 {t('promos.office_keys.short_label')}:</span>
      <PromoExternalLink href={officeKeys.url}>{new URL(officeKeys.url).hostname}</PromoExternalLink>
    </footer>
  )
}

export function PromoDetails({ promo, compact = false }: { promo: Promo; compact?: boolean }) {
  const { t } = useTranslation()
  const title = promo.titleKey ? t(promo.titleKey, { defaultValue: promo.title }) : (promo.title ?? '')
  const text = promo.textKey ? t(promo.textKey, { defaultValue: promo.text }) : (promo.text ?? '')
  const button = promo.buttonKey ? t(promo.buttonKey, { defaultValue: promo.button }) : (promo.button ?? '')

  return (
    <div className={compact ? 'min-w-0' : 'space-y-1.5'}>
      <h3 className={cn('font-medium text-foreground', compact ? 'truncate text-xs' : 'text-sm')}>{title}</h3>
      <p className={cn('text-muted-foreground', compact ? 'line-clamp-2 text-[11px]' : 'text-xs leading-5')}>{text}</p>
      <PromoExternalLink href={promo.url} className={cn('inline-flex text-xs', compact && 'mt-1')}>
        {button}
      </PromoExternalLink>
    </div>
  )
}
