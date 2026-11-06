import { Copy, Download, Expand, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, ConfirmDialog } from '@cherrystudio/ui'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio displays the existing painting history records.
import type { PaintingData } from '@renderer/pages/paintings/model/types/paintingData'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio renders the existing painting records.
import { getPaintingFileUrl } from '@renderer/pages/paintings/utils/paintingFileUrl'
import type { FileMetadata } from '@renderer/types/file'

import StudioLightbox from './StudioLightbox'

export default function StudioGallery({
  items,
  isLoading,
  onDownload,
  onCopyPrompt,
  onReusePrompt,
  onRegenerate,
  onDelete
}: {
  items: PaintingData[]
  isLoading: boolean
  onDownload: (painting: PaintingData, file: FileMetadata) => void
  onCopyPrompt: (painting: PaintingData) => void
  onReusePrompt: (painting: PaintingData) => void
  onRegenerate: (painting: PaintingData) => void
  onDelete: (painting: PaintingData) => void
}) {
  const { t } = useTranslation()
  const [deleteTarget, setDeleteTarget] = useState<PaintingData | null>(null)
  const [lightbox, setLightbox] = useState<{ paintingId: string; fileIndex: number } | null>(null)
  const visibleItems = useMemo(() => items.filter((item) => item.files.length > 0), [items])
  const selectedPainting = lightbox ? visibleItems.find((item) => item.id === lightbox.paintingId) : undefined

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-auto p-5">
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" aria-label={t('common.loading')}>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <h2 className="text-lg font-medium">{t('studio.gallery.empty_title')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('studio.gallery.empty_description')}</p>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 items-start gap-4 md:grid-cols-3 xl:grid-cols-4">
          {visibleItems.flatMap((painting) =>
            painting.files.map((file: FileMetadata, fileIndex) => {
              const imageUrl = getPaintingFileUrl(file)
              if (!imageUrl) return null
              return (
                <article
                  key={`${painting.id}-${file.id}`}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
                  <button
                    type="button"
                    className="block w-full focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={t('studio.gallery.open_image', { number: fileIndex + 1 })}
                    onClick={() => setLightbox({ paintingId: painting.id, fileIndex })}>
                    <img
                      src={imageUrl}
                      alt={painting.prompt || t('studio.gallery.generated_image', { number: fileIndex + 1 })}
                      loading="lazy"
                      className="max-h-[420px] w-full object-cover"
                    />
                  </button>
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs text-foreground" title={painting.prompt}>
                      {painting.prompt}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {painting.providerId} · {painting.model || t('studio.gallery.unknown_model')}
                    </p>
                  </div>
                  <div className="absolute inset-x-2 top-2 flex justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={t('studio.gallery.download')}
                      onClick={() => onDownload(painting, file)}>
                      <Download className="size-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={t('studio.gallery.copy_prompt')}
                      onClick={() => onCopyPrompt(painting)}>
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={t('studio.gallery.reuse_prompt')}
                      onClick={() => onReusePrompt(painting)}>
                      <Expand className="size-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={t('studio.gallery.regenerate')}
                      onClick={() => onRegenerate(painting)}>
                      <RotateCcw className="size-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={t('studio.gallery.delete')}
                      onClick={() => setDeleteTarget(painting)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </article>
              )
            })
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('studio.gallery.delete_title')}
        description={t('common.delete_confirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        destructive
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget)
          setDeleteTarget(null)
        }}
      />
      {selectedPainting && lightbox && (
        <StudioLightbox
          painting={selectedPainting}
          fileIndex={lightbox.fileIndex}
          count={selectedPainting.files.length}
          modelName={`${selectedPainting.providerId} · ${selectedPainting.model || t('studio.gallery.unknown_model')}`}
          onClose={() => setLightbox(null)}
          onMove={(direction) =>
            setLightbox((current) =>
              current
                ? {
                    ...current,
                    fileIndex:
                      (current.fileIndex + direction + selectedPainting.files.length) % selectedPainting.files.length
                  }
                : null
            )
          }
        />
      )}
    </div>
  )
}
