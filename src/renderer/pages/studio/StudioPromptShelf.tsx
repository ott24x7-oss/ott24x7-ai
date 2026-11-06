import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'

import { getStudioTemplatePrompt } from './studioGeneration'

const TEMPLATES = [
  { id: 'poster', label: 'studio.templates.poster' },
  { id: 'logo', label: 'studio.templates.logo' },
  { id: 'product', label: 'studio.templates.product' },
  { id: 'thumbnail', label: 'studio.templates.thumbnail' },
  { id: 'anime', label: 'studio.templates.anime' },
  { id: 'render', label: 'studio.templates.render' },
  { id: 'wallpaper', label: 'studio.templates.wallpaper' },
  { id: 'sticker', label: 'studio.templates.sticker' }
] as const
const STYLES = [
  { id: 'cinematic', label: 'studio.inspiration.styles.cinematic' },
  { id: 'studio', label: 'studio.inspiration.styles.studio' },
  { id: 'dreamy', label: 'studio.inspiration.styles.dreamy' },
  { id: 'graphic', label: 'studio.inspiration.styles.graphic' }
] as const

export default function StudioPromptShelf({ onSelectPrompt }: { onSelectPrompt: (prompt: string) => void }) {
  const { t } = useTranslation()

  return (
    <section className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col justify-center gap-6 overflow-auto px-5 py-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
          <span className="text-xl">✦</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('studio.inspiration.title')}</h1>
        <p className="max-w-lg text-sm text-muted-foreground">{t('studio.inspiration.description')}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2" aria-label={t('studio.inspiration.templates')}>
        {TEMPLATES.map((template) => (
          <Button
            key={template.id}
            variant="outline"
            size="sm"
            className="rounded-full transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none"
            onClick={() => onSelectPrompt(getStudioTemplatePrompt(template.id, (key) => t(key)))}>
            {t(template.label)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STYLES.map((style) => (
          <div
            key={style.id}
            className="group overflow-hidden rounded-xl border border-border bg-card transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
            <div
              role="img"
              aria-label={t(style.label)}
              className={`h-24 bg-linear-to-br ${
                style.id === 'cinematic'
                  ? 'from-chart-1/35 via-primary/30 to-chart-4/35'
                  : style.id === 'studio'
                    ? 'from-chart-2/30 via-background-subtle to-chart-5/35'
                    : style.id === 'dreamy'
                      ? 'from-chart-4/30 via-chart-3/30 to-primary/25'
                      : 'from-chart-5/30 via-chart-1/20 to-chart-2/35'
              }`}
            />
            <p className="px-3 py-2 text-xs font-medium">{t(style.label)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
