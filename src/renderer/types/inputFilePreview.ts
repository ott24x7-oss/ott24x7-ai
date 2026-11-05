import type { ZipContextSkipReason } from '@shared/data/types/uiParts'
import type { AbsoluteFilePath } from '@shared/types/file'

import type { ComposerFileKind } from './file'

export interface InputFilePreview {
  displayName: string
  previewPath: AbsoluteFilePath
  fileEntryId?: string
  originalPath?: AbsoluteFilePath
  mediaType?: string
  composerFileKind?: ComposerFileKind
  zipEntryCount?: number
  zipSkippedReasons?: ZipContextSkipReason[]
  zipSkippedCount?: number
}

export type InputFilePreviewAction = (input: InputFilePreview) => void | Promise<void>
