/**
 * Renderer-side send-time bridge: turn the composer's `ComposerAttachment`s
 * into v2 `FileUIPart`s that survive userData moves.
 *
 * The composer holds lean `ComposerAttachment` descriptors; the v2 `FileEntry`
 * is created here, when the message is actually sent. Each attachment is
 * promoted to an internal `FileEntry` via `createInternalEntry` (Cherry copies
 * the bytes into its own storage); the resulting `fileEntryId` and the
 * composer's stable `fileTokenSourceId` live in `providerMetadata.cherry` so
 * downstream consumers can identify both the stored file and its composer
 * token association — see `packages/shared/data/types/uiParts.ts` for the
 * accessor + Zod.
 */

import { ipcApi } from '@renderer/ipc'
import type { ComposerAttachment } from '@renderer/utils/message/composerAttachment'
import type { CherryMessagePart, FileUIPart, TextUIPart } from '@shared/data/types/message'
import { type ZipContextSkipReason, withCherryMeta } from '@shared/data/types/uiParts'
import { createFilePathHandle, toFileUrl } from '@shared/utils/file'

import { buildZipArchiveContext, totalSkippedZipEntries, ZIP_ARCHIVE_LIMITS } from './zipAttachment'

export function withComposerFilePartMeta(
  part: FileUIPart,
  attachment: Pick<ComposerAttachment, 'fileTokenSourceId' | 'composerFileKind' | 'path'>,
  fileEntryId?: string
): FileUIPart {
  return withCherryMeta(part, {
    ...(fileEntryId ? { fileEntryId } : {}),
    fileTokenSourceId: attachment.fileTokenSourceId,
    ...(attachment.composerFileKind ? { composerFileKind: attachment.composerFileKind } : {}),
    ...(attachment.path ? { originalPath: attachment.path } : {})
  })
}

/**
 * For each `ComposerAttachment`, create a v2 internal FileEntry (Cherry copies
 * the bytes into its own storage) and return a `FileUIPart` that carries the new
 * `fileEntryId` plus a `file://` URL pointing at the freshly-copied physical file.
 *
 * `ComposerAttachment.path` is already an `AbsoluteFilePath` — producers validate
 * it. A captured image instead carries an owned Blob. An
 * attachment reconstructed for message editing carries neither, and such an
 * attachment must never be re-sent through `createInternalEntry` (the edit flow
 * reuses the original part instead).
 *
 * That check runs over the WHOLE batch before the first IPC. `createInternalEntry`
 * copies bytes and inserts a row, and neither orphan sweep reclaims the result
 * (the DB sweep only reports zero-ref entries; the FS sweep only unlinks files
 * with no DB row), so a mid-flight rejection would leave permanent residue that
 * every retry duplicates.
 *
 * A rejected `createInternalEntry` still leaves that residue — this batch is not
 * atomic — but that failure mode is independent of the caller's input.
 */
export function buildFilePartsForAttachments(attachments: ComposerAttachment[]): Promise<FileUIPart[]>
export function buildFilePartsForAttachments(
  attachments: ComposerAttachment[],
  options: { includeZipContext: true; includeZipImages?: boolean }
): Promise<CherryMessagePart[]>
export async function buildFilePartsForAttachments(
  attachments: ComposerAttachment[],
  options?: { includeZipContext?: boolean; includeZipImages?: boolean }
): Promise<CherryMessagePart[]> {
  const paths = attachments.map((attachment) => {
    if (!attachment.path && !attachment.blob) {
      throw new Error(
        `Cannot send attachment "${attachment.origin_name || attachment.name}": it has no file path or image data`
      )
    }
    return attachment.path
  })
  const partsByAttachment = await Promise.all(
    attachments.map(async (attachment, index) => {
      const isZip = options?.includeZipContext && attachment.ext.toLowerCase() === '.zip'
      const zipContext = isZip ? await getZipContext(attachment, options.includeZipImages === true) : undefined
      const entry = attachment.blob
        ? await window.api.file.createInternalEntry({
            source: 'bytes',
            data: new Uint8Array(await attachment.blob.arrayBuffer()),
            name: attachment.origin_name || attachment.name,
            ext: attachment.ext.replace(/^\./, '') || null,
            cleanupPolicy: 'delete_when_unreferenced'
          })
        : await window.api.file.createInternalEntry({
            source: 'path',
            path: paths[index]!,
            cleanupPolicy: 'delete_when_unreferenced'
          })
      const physicalPath = await window.api.file.getPhysicalPath({ id: entry.id })
      const metadata = await ipcApi.request('file.get_metadata', createFilePathHandle(physicalPath))
      if (metadata === null) {
        // The physical file was just created by createInternalEntry above, so an
        // unreadable (null) metadata means a broken internal invariant — surface
        // it here rather than silently shipping an octet-stream part.
        throw new Error(`Failed to read metadata for freshly created file entry ${entry.id}`)
      }
      const basePart: FileUIPart = {
        type: 'file',
        mediaType: metadata.kind === 'file' ? metadata.mime : 'application/octet-stream',
        url: toFileUrl(physicalPath),
        filename: attachment.origin_name || attachment.name
      }
      const baseWithMeta = withComposerFilePartMeta(basePart, attachment, entry.id)
      const archivePart = zipContext
        ? withCherryMeta(baseWithMeta, {
            zipEntryCount: zipContext.fileCount,
            zipSkippedReasons: Object.keys(zipContext.skipped) as ZipContextSkipReason[],
            zipSkippedCount: totalSkippedZipEntries(zipContext.skipped)
          })
        : baseWithMeta
      const zipParts: CherryMessagePart[] = [archivePart]

      if (zipContext?.contextText) {
        const contextPart: TextUIPart = { type: 'text', text: zipContext.contextText }
        zipParts.push(withCherryMeta(contextPart, { zipContext: true }))
      }
      for (const image of zipContext?.images ?? []) {
        const imageEntry = await window.api.file.createInternalEntry({
          source: 'bytes',
          data: image.data,
          name: image.path.split('/').at(-1) ?? image.path,
          ext: image.path.split('.').at(-1)?.toLowerCase() ?? null,
          cleanupPolicy: 'delete_when_unreferenced'
        })
        const imagePath = await window.api.file.getPhysicalPath({ id: imageEntry.id })
        const imagePart: FileUIPart = {
          type: 'file',
          mediaType: image.mediaType,
          url: toFileUrl(imagePath),
          filename: image.path
        }
        zipParts.push(withCherryMeta(imagePart, { fileEntryId: imageEntry.id, zipContext: true }))
      }
      return zipParts
    })
  )
  return partsByAttachment.flat()
}

async function getZipContext(attachment: ComposerAttachment, includeImages: boolean) {
  if (attachment.size > ZIP_ARCHIVE_LIMITS.maxArchiveBytes) {
    throw new Error(`ZIP archive exceeds the ${ZIP_ARCHIVE_LIMITS.maxArchiveBytes} byte compressed size limit`)
  }
  const bytes = attachment.blob
    ? new Uint8Array(await attachment.blob.arrayBuffer())
    : attachment.path
      ? (
          await ipcApi.request('file.read', {
            handle: createFilePathHandle(attachment.path),
            options: { mode: 'full', encoding: 'binary' }
          })
        ).content
      : null
  if (!bytes) throw new Error(`Cannot read ZIP attachment "${attachment.origin_name || attachment.name}"`)
  return buildZipArchiveContext(bytes, { includeImages })
}
