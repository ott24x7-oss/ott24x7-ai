import {
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  ExternalLink,
  Keyboard,
  LifeBuoy,
  PartyPopper,
  Sparkles
} from 'lucide-react'
import { useCallback, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@cherrystudio/ui'
import { useDesktopUpdate } from '@renderer/components/app/DesktopUpdateProvider'
import screenshot01 from '@renderer/assets/images/guide/01-compare-4-ai-answers.webp'
import screenshot02 from '@renderer/assets/images/guide/02-final-answer-panel.webp'
import screenshot03 from '@renderer/assets/images/guide/03-web-search-with-citations.webp'
import screenshot05 from '@renderer/assets/images/guide/05-home-empty.webp'
import screenshot07 from '@renderer/assets/images/guide/07-final-answer-dark.webp'
import screenshot09 from '@renderer/assets/images/guide/09-studio-image-generation.webp'
import screenshot10 from '@renderer/assets/images/guide/10-settings-custom-api.webp'
import screenshot11 from '@renderer/assets/images/guide/11-web-panels-replies-dark.webp'
import screenshot12 from '@renderer/assets/images/guide/12-compare-dark.webp'
import { useTabs } from '@renderer/hooks/tab'
import { useGuideChecklist } from '@renderer/hooks/useGuideChecklist'
import { openExternalWebsite } from '@renderer/services/website'
import { GUIDE_CHECKLIST, GUIDE_STEPS } from '@renderer/utils/guide'

const SCREENSHOTS = {
  '01-compare-4-ai-answers.webp': screenshot01,
  '02-final-answer-panel.webp': screenshot02,
  '03-web-search-with-citations.webp': screenshot03,
  '05-home-empty.webp': screenshot05,
  '07-final-answer-dark.webp': screenshot07,
  '09-studio-image-generation.webp': screenshot09,
  '10-settings-custom-api.webp': screenshot10,
  '11-web-panels-replies-dark.webp': screenshot11,
  '12-compare-dark.webp': screenshot12
} as const

const EXTERNAL_LINKS = {
  issues: 'https://github.com/ott24x7-oss/ott24x7-ai/issues',
  website: 'https://ott24x7.com'
} as const

type ScreenshotName = keyof typeof SCREENSHOTS
type GuideAction = 'compare' | 'provider' | 'studio'
const GUIDE_ACTION_KEYS: Record<GuideAction, string> = {
  compare: 'guide.actions.compare',
  provider: 'guide.actions.provider',
  studio: 'guide.actions.studio'
}

interface OpenScreenshot {
  name: ScreenshotName
  caption: string
}

function scrollToStep(step: number) {
  const target = document.getElementById(`guide-step-${step}`)
  if (!target) return

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  target.focus({ preventScroll: true })
}

export function GuideContent() {
  const { t } = useTranslation()
  const { openTab } = useTabs()
  const { openFreeModels } = useDesktopUpdate()
  const { done, setDone, progress, complete, markAllDone, reset } = useGuideChecklist()
  const [openScreenshot, setOpenScreenshot] = useState<OpenScreenshot | null>(null)

  const openAction = useCallback(
    (action: GuideAction) => {
      if (action === 'compare') openTab('/app/compare')
      if (action === 'provider') openTab('/settings/provider')
      if (action === 'studio') openTab('/app/studio')
    },
    [openTab]
  )

  const openExternalLink = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    void openExternalWebsite(event.currentTarget.href)
  }, [])

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-10 sm:px-8 lg:py-12">
      <header className="mb-9 flex flex-wrap items-center justify-between gap-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary">
            <BookOpen className="size-4" aria-hidden />
            {t('guide.brand')}
          </div>
          <h1 className="text-3xl font-semibold">{t('guide.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('guide.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              openTab('/app/compare')
              openFreeModels()
            }}>
            {t('guide.actions.free_models')}
          </Button>
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs font-medium">
            <CircleCheck className={complete ? 'size-4 text-success' : 'size-4 text-primary'} aria-hidden />
            {t('guide.progress', { done: progress })}
          </div>
        </div>
      </header>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        <aside
          aria-label={t('guide.checklist.title')}
          className="order-first rounded-2xl border bg-card p-5 xl:sticky xl:top-7 xl:col-start-2 xl:row-start-1">
          <div className="flex items-center gap-2">
            <CircleCheck className="size-[18px] text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">{t('guide.checklist.title')}</h2>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {t('guide.checklist.count', { done: progress })}
            </span>
          </div>
          <div className="mt-4 grid h-1 grid-cols-8 gap-1" aria-hidden="true">
            {GUIDE_CHECKLIST.map((item, index) => (
              <span key={item.label} className={`rounded-full ${done[index] ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
          <div className="mt-5 space-y-5">
            {GUIDE_CHECKLIST.map((item, index) => (
              <div key={item.label} className="flex items-start gap-3">
                <Checkbox
                  id={`guide-check-${index}`}
                  checked={done[index] ?? false}
                  onCheckedChange={(checked) =>
                    setDone((current) =>
                      current.map((value, itemIndex) => (itemIndex === index ? checked === true : value))
                    )
                  }
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <label htmlFor={`guide-check-${index}`} className="cursor-pointer text-xs leading-5">
                    {t(item.label)}
                  </label>
                  <Button
                    type="button"
                    variant="link"
                    className="mt-0.5 flex h-auto justify-start gap-1 p-0 text-[11px]"
                    onClick={() => scrollToStep(item.step)}
                    aria-label={t('guide.checklist.show_me', { item: t(item.label) })}>
                    {t('guide.checklist.show_me_short')}
                    <ArrowRight className="size-3" aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {complete && (
            <div
              role="status"
              className="mt-5 rounded-lg bg-success-subtle p-3 text-xs leading-5 text-success-subtle-foreground">
              <PartyPopper className="mb-2 size-5" aria-hidden />
              <strong>{t('guide.complete.title')}</strong>
              <br />
              {t('guide.complete.description')}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <Button type="button" variant="link" size="sm" className="h-auto gap-1 p-0 text-xs" onClick={markAllDone}>
              <Check className="size-3" aria-hidden />
              {t('guide.checklist.mark_all_done')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground"
              onClick={reset}>
              {t('guide.checklist.reset')}
            </Button>
          </div>
        </aside>

        <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-start-1">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden />
            {t('guide.intro')}
          </div>
          {GUIDE_STEPS.map((step, index) => {
            const caption = t(step.caption)
            const action = 'action' in step ? step.action : undefined
            return (
              <article
                key={step.title}
                id={`guide-step-${index + 1}`}
                tabIndex={-1}
                className="scroll-mt-7 rounded-2xl border bg-card p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted font-mono text-lg text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold">{t(step.title)}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(step.description)}</p>
                    {action && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-1.5"
                        onClick={() => openAction(action)}>
                        {t(GUIDE_ACTION_KEYS[action])}
                        <ArrowRight className="size-3.5" aria-hidden />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  <span className="font-medium text-foreground">{t('guide.tip')}</span>
                  <span className="mx-2 text-border">/</span>
                  {t(step.tip)}
                </p>
                <figure className="mt-6">
                  <button
                    type="button"
                    className="block w-full overflow-hidden rounded-xl border bg-background focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t('guide.screenshot.open', { caption })}
                    onClick={() => setOpenScreenshot({ name: step.image, caption })}>
                    <img
                      src={SCREENSHOTS[step.image]}
                      alt={caption}
                      className="aspect-[16/10] w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                  <figcaption className="mt-3 text-center text-xs text-muted-foreground">{caption}</figcaption>
                </figure>
              </article>
            )
          })}

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Keyboard className="size-[17px] text-muted-foreground" aria-hidden />
                {t('guide.shortcuts.title')}
              </h2>
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-normal">{t('guide.shortcuts.action')}</th>
                    <th className="pb-2 text-right font-normal">{t('guide.shortcuts.shortcut')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['guide.shortcuts.send', 'Enter'],
                    ['guide.shortcuts.new_line', 'Shift + Enter'],
                    ['guide.shortcuts.focus', 'Ctrl + 1…9'],
                    ['guide.shortcuts.exit_focus', 'Esc']
                  ].map(([label, key]) => (
                    <tr key={label} className="border-t">
                      <td className="py-3 pr-2">{t(label)}</td>
                      <td className="py-3 text-right">
                        <kbd className="whitespace-nowrap rounded border bg-background px-1.5 py-1 font-mono text-[10px] text-muted-foreground">
                          {key}
                        </kbd>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <LifeBuoy className="size-[17px] text-muted-foreground" aria-hidden />
                {t('guide.help.title')}
              </h2>
              <p className="mb-5 text-xs leading-5 text-muted-foreground">{t('guide.help.description')}</p>
              <a
                href={EXTERNAL_LINKS.issues}
                onClick={openExternalLink}
                className="flex items-center justify-between border-t py-3 text-xs text-link hover:underline">
                {t('guide.help.issues')}
                <ExternalLink className="size-[13px]" aria-hidden />
              </a>
              <a
                href={EXTERNAL_LINKS.website}
                onClick={openExternalLink}
                className="flex items-center justify-between border-t py-3 text-xs hover:text-primary">
                {t('guide.help.website')}
                <ExternalLink className="size-[13px]" aria-hidden />
              </a>
            </section>
          </div>
          <footer className="pb-3 pt-2 text-center text-xs text-muted-foreground">{t('guide.footer')}</footer>
        </div>
      </div>

      <Dialog open={openScreenshot !== null} onOpenChange={(open) => !open && setOpenScreenshot(null)}>
        <DialogContent className="max-w-[min(96vw,1600px)]">
          {openScreenshot && (
            <>
              <DialogHeader>
                <DialogTitle>{openScreenshot.caption}</DialogTitle>
                <DialogDescription>{t('guide.screenshot.description')}</DialogDescription>
              </DialogHeader>
              <img
                src={SCREENSHOTS[openScreenshot.name]}
                alt={openScreenshot.caption}
                className="max-h-[78vh] w-full rounded-lg border object-contain"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
