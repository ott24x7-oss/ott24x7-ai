import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio opens existing painting history records in a viewer.
import type { PaintingData } from '@renderer/pages/paintings/model/types/paintingData'
// eslint-disable-next-line import-x/no-restricted-paths -- Studio uses the painting file URL resolver for persisted images.
import { getPaintingFileUrl } from '@renderer/pages/paintings/utils/paintingFileUrl'

export default function StudioLightbox({
  painting,
  fileIndex,
  count,
  modelName,
  onClose,
  onMove
}: {
  painting: PaintingData
  fileIndex: number
  count: number
  modelName: string
  onClose: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const { t } = useTranslation()
  const image = painting.files[fileIndex]
  const imageUrl = image ? getPaintingFileUrl(image) : undefined
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const changeZoom = useCallback((delta: number) => setZoom((value) => Math.min(4, Math.max(0.5, value + delta))), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onMove(-1)
      if (event.key === 'ArrowRight') onMove(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, onMove])

  if (!imageUrl) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('studio.gallery.lightbox')}
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
      onWheel={(event) => {
        event.preventDefault()
        changeZoom(event.deltaY < 0 ? 0.1 : -0.1)
      }}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{painting.prompt}</p>
          <p className="text-xs text-muted-foreground">{modelName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('studio.gallery.zoom_out')}
            onClick={() => changeZoom(-0.2)}>
            <Minus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('studio.gallery.reset_zoom')}
            onClick={() => {
              setZoom(1)
              setOffset({ x: 0, y: 0 })
            }}>
            <RotateCcw className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={t('studio.gallery.zoom_in')} onClick={() => changeZoom(0.2)}>
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={t('common.close')} onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-16 py-4">
        {count > 1 && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-4 z-10"
            aria-label={t('studio.gallery.previous')}
            onClick={() => onMove(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
        )}
        <img
          src={imageUrl}
          alt={painting.prompt || t('studio.gallery.generated_image', { number: fileIndex + 1 })}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? 'grab' : 'default'
          }}
          draggable={false}
          onPointerDown={(event) => {
            if (zoom <= 1) return
            event.currentTarget.setPointerCapture(event.pointerId)
            dragRef.current = { x: event.clientX, y: event.clientY }
          }}
          onPointerMove={(event) => {
            if (!dragRef.current) return
            const deltaX = event.clientX - dragRef.current.x
            const deltaY = event.clientY - dragRef.current.y
            dragRef.current = { x: event.clientX, y: event.clientY }
            setOffset((current) => ({ x: current.x + deltaX, y: current.y + deltaY }))
          }}
          onPointerUp={() => {
            dragRef.current = null
          }}
        />
        {count > 1 && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-4 z-10"
            aria-label={t('studio.gallery.next')}
            onClick={() => onMove(1)}>
            <ChevronRight className="size-5" />
          </Button>
        )}
      </div>
      <footer className="shrink-0 border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
        {fileIndex + 1} / {count}
      </footer>
    </div>
  )
}
