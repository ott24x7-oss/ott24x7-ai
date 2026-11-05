import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { buildZipArchiveContext, indexZipArchive, totalSkippedZipEntries, ZIP_ARCHIVE_LIMITS } from '../zipAttachment'

async function archiveBytes(zip: JSZip): Promise<Uint8Array> {
  return zip.generateAsync({ type: 'uint8array' })
}

describe('ZIP attachment reader', () => {
  it('includes small text/code files and skips excluded paths, lock files, and binary files', async () => {
    const zip = new JSZip()
    zip.file('src/main.ts', 'export const answer = 42')
    zip.file('node_modules/pkg/index.js', 'excluded')
    zip.file('pnpm-lock.yaml', 'lock')
    zip.file('assets/blob.bin', new Uint8Array([0, 1, 2]))

    const result = await buildZipArchiveContext(await archiveBytes(zip))

    expect(result.contextText).toContain('--- src/main.ts ---')
    expect(result.contextText).toContain('export const answer = 42')
    expect(result.contextText).not.toContain('excluded')
    expect(result.contextText).not.toContain('lock')
    expect(result.skipped).toMatchObject({ 'excluded-path': 1, 'lock-file': 1, binary: 1 })
  })

  it('limits files and total text context, and only includes up to five supported images', async () => {
    const zip = new JSZip()
    zip.file('large.txt', 'x'.repeat(ZIP_ARCHIVE_LIMITS.maxTextFileBytes + 1))
    zip.file('part-a.md', 'a'.repeat(180 * 1024))
    zip.file('part-b.md', 'b'.repeat(180 * 1024))
    zip.file('part-c.md', 'c'.repeat(120 * 1024))
    for (let index = 0; index < 7; index += 1) zip.file(`images/${index}.png`, new Uint8Array([index, 1, 2]))

    const result = await buildZipArchiveContext(await archiveBytes(zip), { includeImages: true })

    expect(result.contextText.length).toBeLessThanOrEqual(ZIP_ARCHIVE_LIMITS.maxContextBytes)
    expect(result.skipped.oversize).toBe(1)
    expect(result.skipped['context-limit']).toBeGreaterThan(0)
    expect(result.images).toHaveLength(ZIP_ARCHIVE_LIMITS.maxImages)
    expect(result.skipped['image-limit']).toBe(2)
    expect(totalSkippedZipEntries(result.skipped)).toBeGreaterThanOrEqual(4)
  })

  it('rejects path traversal and absolute paths before entries can be consumed', async () => {
    const zip = new JSZip()
    zip.file('../outside.txt', 'unsafe')

    await expect(indexZipArchive(await archiveBytes(zip))).rejects.toThrow(/path traversal|absolute entry path/i)
  })

  it('rejects entry-count and declared uncompressed-size zip bombs', async () => {
    const tooManyEntries = new JSZip()
    for (let index = 0; index <= ZIP_ARCHIVE_LIMITS.maxEntries; index += 1) {
      tooManyEntries.file(`files/${index}.txt`, '')
    }
    await expect(indexZipArchive(await archiveBytes(tooManyEntries))).rejects.toThrow(/entry limit/i)

    const smallZip = new JSZip()
    smallZip.file('large.txt', 'x')
    const forgedSize = await archiveBytes(smallZip)
    const view = new DataView(forgedSize.buffer, forgedSize.byteOffset, forgedSize.byteLength)
    const centralDirectoryOffset = forgedSize.findIndex(
      (byte, index) =>
        byte === 0x50 &&
        forgedSize[index + 1] === 0x4b &&
        forgedSize[index + 2] === 0x01 &&
        forgedSize[index + 3] === 0x02
    )
    view.setUint32(centralDirectoryOffset + 24, ZIP_ARCHIVE_LIMITS.maxUncompressedBytes + 1, true)
    await expect(indexZipArchive(forgedSize)).rejects.toThrow(/uncompressed size limit/i)
  })
})
