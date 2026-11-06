import { RotateCcw, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio renders records produced by the existing painting pipeline.
import type { PaintingData } from '@renderer/pages/paintings/model/types/paintingData'

import { getStudioGenerationStatusIndex, STUDIO_GENERATION_STATUS_KEYS } from './studioGeneration'

function requestedImageCount(painting: PaintingData): number {
  const count = Number(painting.params?.numberOfImages ?? 1)
  return Number.isFinite(count) ? Math.min(4, Math.max(1, Math.floor(count))) : 1
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export default function StudioGeneratingBoard({
  painting,
  aspectRatio,
  onCancel,
  onRetry
}: {
  painting: PaintingData
  aspectRatio: number | null
  onCancel: () => void
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const reduceMotion = Boolean(useReducedMotion())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const failed = painting.generationStatus === 'failed'
  const statusIndex = getStudioGenerationStatusIndex(elapsedSeconds * 1000)

  useEffect(() => {
    if (failed) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [failed, painting.id])

  const count = requestedImageCount(painting)
  return (
    <section className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-5 overflow-auto p-5">
      {failed ? (
        <div className="flex w-full max-w-lg flex-col items-center gap-3 rounded-2xl border border-error-border bg-error-subtle p-8 text-center">
          <p className="font-medium text-error-subtle-foreground">{t('studio.generation.failed')}</p>
          {painting.generationError && <p className="text-sm text-muted-foreground">{painting.generationError}</p>}
          <Button onClick={onRetry}>
            <RotateCcw className="size-4" />
            {t('common.retry')}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: count }, (_, index) => (
              <div
                key={`${painting.id}-${index}`}
                aria-hidden="true"
                className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card"
                style={{ aspectRatio: aspectRatio ?? 1 }}>
                <motion.div
                  className="absolute inset-0 bg-linear-to-br from-primary/30 via-chart-2/30 to-chart-4/25"
                  style={{ backgroundSize: '220% 220%' }}
                  animate={
                    reduceMotion
                      ? undefined
                      : { backgroundPosition: ['0% 15%', '100% 85%', '0% 15%'], opacity: [0.76, 1, 0.76] }
                  }
                  transition={reduceMotion ? { duration: 0 } : { duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                />
                {!reduceMotion && (
                  <motion.div
                    className="absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent via-background/35 to-transparent"
                    animate={{ x: ['0%', '360%'] }}
                    transition={{ duration: 5, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="size-28 rounded-full bg-primary/15 blur-2xl" />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/75 to-transparent p-4 text-center">
                  <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-foreground">
                    {t('studio.generation.image_number', { number: index + 1 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <p role="status" aria-live="polite" className="font-medium text-foreground">
              {t(STUDIO_GENERATION_STATUS_KEYS[statusIndex])}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('studio.generation.elapsed', { time: formatElapsed(elapsedSeconds) })}
            </p>
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="size-4" />
              {t('common.cancel')}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
