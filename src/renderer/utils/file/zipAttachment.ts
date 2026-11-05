import JSZip from 'jszip'

import type { ZipContextSkipReason } from '@shared/data/types/uiParts'

export const ZIP_ARCHIVE_LIMITS = {
  maxArchiveBytes: 64 * 1024 * 1024,
  maxEntries: 5_000,
  maxUncompressedBytes: 128 * 1024 * 1024,
  maxTextFileBytes: 200 * 1024,
  maxContextBytes: 400 * 1024,
  maxImages: 5,
  maxImageBytes: 10 * 1024 * 1024
} as const

export type { ZipContextSkipReason } from '@shared/data/types/uiParts'

export interface ZipArchiveEntry {
  path: string
  directory: boolean
  uncompressedSize: number
}

export interface ZipArchiveIndex {
  entries: ZipArchiveEntry[]
  fileCount: number
  totalUncompressedBytes: number
}

export interface ZipArchiveContext extends ZipArchiveIndex {
  contextText: string
  images: Array<{ path: string; data: Uint8Array; mediaType: string }>
  skipped: Partial<Record<ZipContextSkipReason, number>>
}

interface CompressedData {
  uncompressedSize: number
}

interface ZipDataStream {
  on(event: 'data', callback: (chunk: Uint8Array) => void): ZipDataStream
  on(event: 'error', callback: (error: Error) => void): ZipDataStream
  on(event: 'end', callback: () => void): ZipDataStream
  pause(): void
  resume(): void
}

interface InternalZipEntry extends JSZip.JSZipObject {
  _data?: CompressedData
  internalStream(type: 'uint8array'): ZipDataStream
}

function normalizeArchivePath(entry: JSZip.JSZipObject): string {
  const rawPath = entry.unsafeOriginalName ?? entry.name
  if (!rawPath || rawPath.includes('\0')) throw new Error('ZIP archive contains an invalid entry path')
  const normalized = rawPath.replace(/\\/g, '/')
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`ZIP archive contains an absolute entry path: ${rawPath}`)
  }
  const segments = normalized.split('/')
  if (segments.some((segment) => segment === '..')) {
    throw new Error(`ZIP archive contains a path traversal entry: ${rawPath}`)
  }
  const safeSegments = segments.filter((segment) => segment && segment !== '.')
  if (safeSegments.length === 0) throw new Error('ZIP archive contains an empty entry path')
  return safeSegments.join('/')
}

function getUncompressedSize(entry: JSZip.JSZipObject): number {
  const size = (entry as InternalZipEntry)._data?.uncompressedSize ?? 0
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('ZIP archive contains an invalid entry size')
  return size
}

function buildZipIndex(zip: JSZip): ZipArchiveIndex {
  const rawEntries = Object.values(zip.files)
  if (rawEntries.length > ZIP_ARCHIVE_LIMITS.maxEntries) {
    throw new Error(`ZIP archive exceeds the ${ZIP_ARCHIVE_LIMITS.maxEntries} entry limit`)
  }

  const seen = new Set<string>()
  const entries = rawEntries.map((entry) => {
    const entryPath = normalizeArchivePath(entry)
    const key = entryPath.toLowerCase()
    if (seen.has(key)) throw new Error(`ZIP archive contains duplicate entry paths: ${entryPath}`)
    seen.add(key)
    return { path: entryPath, directory: entry.dir, uncompressedSize: getUncompressedSize(entry) }
  })
  const totalUncompressedBytes = entries.reduce((total, entry) => total + entry.uncompressedSize, 0)
  if (totalUncompressedBytes > ZIP_ARCHIVE_LIMITS.maxUncompressedBytes) {
    throw new Error(`ZIP archive exceeds the ${ZIP_ARCHIVE_LIMITS.maxUncompressedBytes} byte uncompressed size limit`)
  }

  // Add parent folders so previews can render a consistent tree even when the ZIP omitted
  // explicit directory records. All entries have already passed path traversal checks.
  const directories = new Set<string>()
  for (const entry of entries) {
    const segments = entry.path.split('/')
    for (let index = 1; index < segments.length; index += 1) directories.add(segments.slice(0, index).join('/'))
    if (entry.directory) directories.add(entry.path)
  }
  for (const directory of directories) {
    if (!seen.has(directory.toLowerCase())) entries.push({ path: directory, directory: true, uncompressedSize: 0 })
  }
  entries.sort((left, right) => left.path.localeCompare(right.path) || Number(right.directory) - Number(left.directory))
  return {
    entries,
    fileCount: rawEntries.filter((entry) => !entry.dir).length,
    totalUncompressedBytes
  }
}

async function loadZip(bytes: Uint8Array): Promise<JSZip> {
  if (bytes.byteLength > ZIP_ARCHIVE_LIMITS.maxArchiveBytes) {
    throw new Error(`ZIP archive exceeds the ${ZIP_ARCHIVE_LIMITS.maxArchiveBytes} byte compressed size limit`)
  }
  preflightZipLimits(bytes)
  return JSZip.loadAsync(bytes, { checkCRC32: false, createFolders: false })
}

function preflightZipLimits(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minimumEndRecordLength = 22
  const maxCommentLength = 65_535
  let endRecordOffset = -1
  for (
    let offset = bytes.byteLength - minimumEndRecordLength;
    offset >= Math.max(0, bytes.byteLength - minimumEndRecordLength - maxCommentLength);
    offset -= 1
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endRecordOffset = offset
      break
    }
  }
  if (endRecordOffset < 0) throw new Error('ZIP archive is missing its central directory')

  const entryCount = view.getUint16(endRecordOffset + 10, true)
  const directorySize = view.getUint32(endRecordOffset + 12, true)
  let directoryOffset = view.getUint32(endRecordOffset + 16, true)
  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported within the safe ZIP limits')
  }
  if (entryCount > ZIP_ARCHIVE_LIMITS.maxEntries) {
    throw new Error(`ZIP archive exceeds the ${ZIP_ARCHIVE_LIMITS.maxEntries} entry limit`)
  }
  if (directoryOffset + directorySize > endRecordOffset) {
    throw new Error('ZIP archive central directory is out of bounds')
  }

  let totalUncompressedBytes = 0
  for (let index = 0; index < entryCount; index += 1) {
    if (directoryOffset + 46 > endRecordOffset || view.getUint32(directoryOffset, true) !== 0x02014b50) {
      throw new Error('ZIP archive contains an invalid central directory entry')
    }
    const uncompressedSize = view.getUint32(directoryOffset + 24, true)
    const nameLength = view.getUint16(directoryOffset + 28, true)
    const extraLength = view.getUint16(directoryOffset + 30, true)
    const commentLength = view.getUint16(directoryOffset + 32, true)
    if (uncompressedSize === 0xffffffff) {
      throw new Error('ZIP64 entries are not supported within the safe ZIP limits')
    }
    totalUncompressedBytes += uncompressedSize
    if (totalUncompressedBytes > ZIP_ARCHIVE_LIMITS.maxUncompressedBytes) {
      throw new Error(`ZIP archive exceeds the ${ZIP_ARCHIVE_LIMITS.maxUncompressedBytes} byte uncompressed size limit`)
    }
    directoryOffset += 46 + nameLength + extraLength + commentLength
  }
  if (directoryOffset > endRecordOffset) throw new Error('ZIP archive central directory is out of bounds')
}

function isExcludedPath(entryPath: string): boolean {
  return entryPath
    .split('/')
    .some((segment) => ['.git', 'build', 'dist', 'node_modules'].includes(segment.toLowerCase()))
}

function isLockFile(entryPath: string): boolean {
  const basename = entryPath.split('/').at(-1)?.toLowerCase() ?? ''
  return (
    basename.endsWith('.lock') ||
    ['bun.lockb', 'cargo.lock', 'composer.lock', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].includes(basename)
  )
}

const IMAGE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

function imageMime(entryPath: string): string | undefined {
  const extension = entryPath.split('.').at(-1)?.toLowerCase()
  return extension ? IMAGE_MIME_BY_EXTENSION[extension] : undefined
}

function incrementSkipped(skipped: Partial<Record<ZipContextSkipReason, number>>, reason: ZipContextSkipReason) {
  skipped[reason] = (skipped[reason] ?? 0) + 1
}

function isTextBytes(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    for (const character of text) {
      const codePoint = character.codePointAt(0) ?? 0
      if (
        (codePoint >= 1 && codePoint <= 8) ||
        codePoint === 11 ||
        codePoint === 12 ||
        (codePoint >= 14 && codePoint <= 31)
      ) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

async function readEntryBounded(
  entry: JSZip.JSZipObject,
  maxBytes: number,
  onChunk?: (chunkSize: number) => boolean
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let byteLength = 0
  const stream = (entry as InternalZipEntry).internalStream('uint8array')
  return new Promise((resolve, reject) => {
    let settled = false
    stream.on('data', (chunk) => {
      if (settled) return
      byteLength += chunk.byteLength
      if (onChunk && !onChunk(chunk.byteLength)) {
        settled = true
        stream.pause()
        reject(new Error('ZIP archive exceeds the actual uncompressed size limit'))
        return
      }
      if (byteLength > maxBytes) {
        settled = true
        stream.pause()
        reject(new Error(`ZIP entry exceeds the ${maxBytes} byte read limit`))
        return
      }
      chunks.push(chunk)
    })
    stream.on('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
    stream.on('end', () => {
      if (settled) return
      settled = true
      const bytes = new Uint8Array(byteLength)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      resolve(bytes)
    })
    stream.resume()
  })
}

export async function indexZipArchive(bytes: Uint8Array): Promise<ZipArchiveIndex> {
  return buildZipIndex(await loadZip(bytes))
}

export async function buildZipArchiveContext(
  bytes: Uint8Array,
  { includeImages = false }: { includeImages?: boolean } = {}
): Promise<ZipArchiveContext> {
  const zip = await loadZip(bytes)
  const index = buildZipIndex(zip)
  const skipped: Partial<Record<ZipContextSkipReason, number>> = {}
  const images: ZipArchiveContext['images'] = []
  const textParts: string[] = []
  let contextByteLength = 0
  let actualUncompressedBytes = 0
  const countUncompressedBytes = (chunkSize: number) => {
    if (actualUncompressedBytes + chunkSize > ZIP_ARCHIVE_LIMITS.maxUncompressedBytes) return false
    actualUncompressedBytes += chunkSize
    return true
  }

  const safeFiles = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .sort((left, right) => (left.unsafeOriginalName ?? left.name).localeCompare(right.unsafeOriginalName ?? right.name))
  for (const entry of safeFiles) {
    const entryPath = normalizeArchivePath(entry)
    const declaredSize = getUncompressedSize(entry)
    if (isExcludedPath(entryPath)) {
      incrementSkipped(skipped, 'excluded-path')
      continue
    }
    if (isLockFile(entryPath)) {
      incrementSkipped(skipped, 'lock-file')
      continue
    }

    const mime = imageMime(entryPath)
    if (mime) {
      if (!includeImages) {
        incrementSkipped(skipped, 'image-not-supported')
        continue
      }
      if (images.length >= ZIP_ARCHIVE_LIMITS.maxImages) {
        incrementSkipped(skipped, 'image-limit')
        continue
      }
      if (declaredSize > ZIP_ARCHIVE_LIMITS.maxImageBytes) {
        incrementSkipped(skipped, 'oversize')
        continue
      }
      try {
        const data = await readEntryBounded(entry, ZIP_ARCHIVE_LIMITS.maxImageBytes, countUncompressedBytes)
        images.push({ path: entryPath, data, mediaType: mime })
      } catch (error) {
        if (String(error).includes('read limit')) incrementSkipped(skipped, 'oversize')
        else throw error
      }
      continue
    }

    if (declaredSize > ZIP_ARCHIVE_LIMITS.maxTextFileBytes) {
      incrementSkipped(skipped, 'oversize')
      continue
    }
    if (contextByteLength >= ZIP_ARCHIVE_LIMITS.maxContextBytes) {
      incrementSkipped(skipped, 'context-limit')
      continue
    }
    let data: Uint8Array
    try {
      data = await readEntryBounded(entry, ZIP_ARCHIVE_LIMITS.maxTextFileBytes, countUncompressedBytes)
    } catch (error) {
      if (String(error).includes('read limit')) incrementSkipped(skipped, 'oversize')
      else throw error
      continue
    }
    if (!isTextBytes(data)) {
      incrementSkipped(skipped, 'binary')
      continue
    }
    const text = new TextDecoder().decode(data)
    const section = `\n--- ${entryPath} ---\n${text}\n`
    const sectionBytes = new TextEncoder().encode(section).byteLength
    if (contextByteLength + sectionBytes > ZIP_ARCHIVE_LIMITS.maxContextBytes) {
      incrementSkipped(skipped, 'context-limit')
      continue
    }
    contextByteLength += sectionBytes
    textParts.push(section)
  }

  return { ...index, contextText: textParts.join(''), images, skipped }
}

export function totalSkippedZipEntries(skipped: Partial<Record<ZipContextSkipReason, number>>): number {
  return Object.values(skipped).reduce((total, count) => total + (count ?? 0), 0)
}
