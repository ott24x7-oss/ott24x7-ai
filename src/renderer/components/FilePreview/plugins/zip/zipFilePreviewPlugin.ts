import type { FilePreviewPlugin } from '../../types'

export const zipFilePreviewPlugin = {
  id: 'zip',
  extensions: ['zip'],
  load: () => import('./ZipFilePreview')
} satisfies FilePreviewPlugin
