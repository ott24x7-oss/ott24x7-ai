import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

// eslint-disable-next-line import-x/no-restricted-paths -- Studio renders records produced by the existing painting pipeline.
import type { PaintingData } from '@renderer/pages/paintings/model/types/paintingData'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio displays existing painting output files.
import { getPaintingFileUrl } from '@renderer/pages/paintings/utils/paintingFileUrl'
import type { FileMetadata } from '@renderer/types/file'

import { getStudioRevealMotion } from './studioGeneration'

export default function StudioResultBoard({
  painting,
  onOpenImage
}: {
  painting: PaintingData
  onOpenImage: (fileIndex: number) => void
}) {
  const { t } = useTranslation()
  const reduceMotion = Boolean(useReducedMotion())
  const files = painting.files.filter((file) => getPaintingFileUrl(file))

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col items-center gap-4 overflow-auto p-5">
      {painting.prompt && (
        <p className="max-w-3xl text-center text-sm text-muted-foreground" title={painting.prompt}>
          {painting.prompt}
        </p>
      )}
      <div className="grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2">
        {files.map((file: FileMetadata, index) => {
          const motionProps = getStudioRevealMotion(index, reduceMotion)
          const imageUrl = getPaintingFileUrl(file)
          if (!imageUrl) return null
          return (
            <button
              type="button"
              key={file.id}
              aria-label={t('studio.gallery.open_image', { number: index + 1 })}
              className="group flex min-h-48 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => onOpenImage(index)}>
              <motion.img
                src={imageUrl}
                alt={painting.prompt || t('studio.gallery.generated_image', { number: index + 1 })}
                className="max-h-[min(64vh,760px)] max-w-full object-contain"
                initial={motionProps.initial}
                animate={{ filter: 'blur(0px)', opacity: 1, scale: 1 }}
                transition={motionProps.transition}
              />
            </button>
          )
        })}
      </div>
    </section>
  )
}
