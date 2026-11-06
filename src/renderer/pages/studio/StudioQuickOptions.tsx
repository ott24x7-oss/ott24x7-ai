import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'
// eslint-disable-next-line import-x/no-restricted-paths -- The quick controls mirror the selected painting model's supported options.
import { imageGenerationToFields } from '@renderer/pages/paintings/form/imageGenerationToFields'
// eslint-disable-next-line import-x/no-restricted-paths -- This helper resolves provider-declared option labels and values.
import { resolveOptions } from '@renderer/pages/paintings/form/resolveOptions'
// eslint-disable-next-line import-x/no-restricted-paths -- Aspect-ratio icons use the same ratio parser as painting size chips.
import { parseRatio } from '@renderer/pages/paintings/form/sizeLabel'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio adapts the existing painting support registry.
import { useImageGenerationSupport } from '@renderer/pages/paintings/hooks/useImageGenerationSupport'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio reads and updates the existing painting model options.
import type { PaintingData } from '@renderer/pages/paintings/model/types/paintingData'
// eslint-disable-next-line import-x/no-restricted-paths -- Painting mode determines which provider options are available.
import { tabToImageGenerationMode } from '@renderer/pages/paintings/utils/paintingProviderMode'

const RATIOS = [
  { label: '1:1', value: 1 },
  { label: '3:4', value: 0.75 },
  { label: '4:3', value: 4 / 3 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 }
] as const

function optionRatio(value: unknown): number | undefined {
  const dimensions = parseRatio(String(value ?? ''))
  return dimensions ? dimensions.w / dimensions.h : undefined
}

export default function StudioQuickOptions({
  painting,
  onChange
}: {
  painting: PaintingData
  onChange: (updates: Partial<PaintingData>) => void
}) {
  const { t } = useTranslation()
  const support = useImageGenerationSupport(painting.providerId, painting.model)
  const fields = useMemo(
    () => imageGenerationToFields(support, { mode: tabToImageGenerationMode(painting.mode) }),
    [painting.mode, support]
  )
  const formValues = useMemo(() => painting.params ?? {}, [painting.params])
  const ratioField = fields.find(
    (field) =>
      ['aspectRatio', 'aspect_ratio', 'size'].includes(field.key) && field.type !== 'input' && field.type !== 'slider'
  )
  const styleField = fields.find(
    (field) =>
      ['styleType', 'style_type', 'style'].includes(field.key) && field.type !== 'input' && field.type !== 'slider'
  )
  const ratioOptions = useMemo(
    () =>
      ratioField ? resolveOptions(ratioField as Parameters<typeof resolveOptions>[0], formValues, (key) => t(key)) : [],
    [formValues, ratioField, t]
  )
  const styleOptions = useMemo(
    () =>
      styleField ? resolveOptions(styleField as Parameters<typeof resolveOptions>[0], formValues, (key) => t(key)) : [],
    [formValues, styleField, t]
  )
  const supportedRatios = ratioField
    ? RATIOS.flatMap((ratio) => {
        const option = ratioOptions.find((candidate) => {
          const availableRatio = optionRatio(candidate.value)
          return availableRatio != null && Math.abs(availableRatio - ratio.value) < 0.035
        })
        return option ? [{ ...ratio, option }] : []
      })
    : []

  if (!supportedRatios.length && !styleOptions.length) return null

  const setParam = (key: string, value: string | number) =>
    onChange({ params: { ...painting.params, [key]: String(value) } })

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/70 p-3">
      {supportedRatios.length > 0 && ratioField && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('studio.options.aspect_ratio')}>
          <span className="mr-1 text-xs text-muted-foreground">{t('studio.options.aspect_ratio')}</span>
          {supportedRatios.map(({ label, value, option }) => {
            const selected =
              String(formValues[ratioField.key] ?? ratioField.initialValue ?? '') === String(option.value)
            return (
              <Button
                key={label}
                variant={selected ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={selected}
                onClick={() => setParam(ratioField.key, option.value ?? '')}>
                <span
                  className="size-3 rounded-[2px] border border-current"
                  style={{ aspectRatio: value }}
                  aria-hidden
                />
                {label}
              </Button>
            )
          })}
        </div>
      )}
      {styleOptions.length > 0 && styleField && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('studio.options.style')}>
          <span className="mr-1 text-xs text-muted-foreground">{t('studio.options.style')}</span>
          {styleOptions.map((option) => {
            const optionValue = String(option.value ?? '')
            const selected = String(formValues[styleField.key] ?? styleField.initialValue ?? '') === optionValue
            return (
              <Button
                key={optionValue}
                variant={selected ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={selected}
                onClick={() => setParam(styleField.key, optionValue)}>
                {option.label || optionValue}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
