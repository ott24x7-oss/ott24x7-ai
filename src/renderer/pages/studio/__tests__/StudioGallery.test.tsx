import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PaintingData } from '@renderer/pages/paintings/model/types/paintingData'
import type { FileMetadata } from '@renderer/types/file'

import StudioGallery from '../StudioGallery'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const file = { id: 'file-1', path: 'C:\\studio\\image.png', ext: 'png' } as FileMetadata
const painting = {
  id: 'painting-1',
  providerId: 'provider',
  model: 'image-model',
  mode: 'generate',
  prompt: 'A glass greenhouse at dawn',
  files: [file]
} as PaintingData

describe('Studio gallery actions', () => {
  it('routes each image action to its matching painting and output file', async () => {
    const user = userEvent.setup()
    const handlers = {
      onDownload: vi.fn(),
      onCopyPrompt: vi.fn(),
      onReusePrompt: vi.fn(),
      onRegenerate: vi.fn(),
      onDelete: vi.fn()
    }
    render(<StudioGallery items={[painting]} isLoading={false} {...handlers} />)

    await user.click(screen.getByRole('button', { name: 'studio.gallery.download' }))
    await user.click(screen.getByRole('button', { name: 'studio.gallery.copy_prompt' }))
    await user.click(screen.getByRole('button', { name: 'studio.gallery.reuse_prompt' }))
    await user.click(screen.getByRole('button', { name: 'studio.gallery.regenerate' }))
    await user.click(screen.getByRole('button', { name: 'studio.gallery.delete' }))
    await user.click(screen.getByRole('button', { name: 'common.delete' }))

    expect(handlers.onDownload).toHaveBeenCalledWith(painting, file)
    expect(handlers.onCopyPrompt).toHaveBeenCalledWith(painting)
    expect(handlers.onReusePrompt).toHaveBeenCalledWith(painting)
    expect(handlers.onRegenerate).toHaveBeenCalledWith(painting)
    expect(handlers.onDelete).toHaveBeenCalledWith(painting)
  })
})
