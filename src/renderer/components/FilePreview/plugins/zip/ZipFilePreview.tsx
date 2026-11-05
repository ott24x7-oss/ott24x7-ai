import { Archive, FileText, Folder, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FilePreviewLayout } from '@cherrystudio/file-preview/react'
import { EmptyState, ScrollArea } from '@cherrystudio/ui'
import { ipcApi } from '@renderer/ipc'
import { formatFileSize } from '@renderer/utils/file'
import { indexZipArchive, ZIP_ARCHIVE_LIMITS } from '@renderer/utils/file/zipAttachment'
import { createFilePathHandle } from '@shared/utils/file'

import type { FilePreviewPluginProps } from '../../types'

interface TreeNode {
  name: string
  path: string
  directory: boolean
  size: number
  children: Map<string, TreeNode>
}

type FlatTreeNode = { node: TreeNode; depth: number }
type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; entries: Awaited<ReturnType<typeof indexZipArchive>>['entries']; fileCount: number }
  | { status: 'error' }

function buildTree(entries: Awaited<ReturnType<typeof indexZipArchive>>['entries']): FlatTreeNode[] {
  const roots = new Map<string, TreeNode>()
  for (const entry of entries) {
    const segments = entry.path.split('/')
    let currentMap = roots
    let currentPath = ''
    for (let index = 0; index < segments.length; index += 1) {
      const name = segments[index]
      currentPath = currentPath ? `${currentPath}/${name}` : name
      const isLeaf = index === segments.length - 1
      let node = currentMap.get(name)
      if (!node) {
        node = {
          name,
          path: currentPath,
          directory: !isLeaf || entry.directory,
          size: isLeaf && !entry.directory ? entry.uncompressedSize : 0,
          children: new Map()
        }
        currentMap.set(name, node)
      }
      if (isLeaf) {
        node.directory = entry.directory
        node.size = entry.uncompressedSize
      }
      currentMap = node.children
    }
  }
  const sortNodes = (nodes: Map<string, TreeNode>) =>
    [...nodes.values()].sort(
      (left, right) => Number(right.directory) - Number(left.directory) || left.name.localeCompare(right.name)
    )
  const flatten = (nodes: Map<string, TreeNode>, depth: number): FlatTreeNode[] =>
    sortNodes(nodes).flatMap((node) => [{ node, depth }, ...(node.directory ? flatten(node.children, depth + 1) : [])])
  return flatten(roots, 0)
}

export default function ZipFilePreview({ filePath, metadata, refreshKey }: FilePreviewPluginProps) {
  const { t } = useTranslation()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useLayoutEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    void (async () => {
      try {
        if (metadata.size > ZIP_ARCHIVE_LIMITS.maxArchiveBytes) {
          throw new Error('ZIP archive exceeds the compressed size limit')
        }
        const { content } = await ipcApi.request('file.read', {
          handle: createFilePathHandle(filePath),
          options: { mode: 'full', encoding: 'binary' }
        })
        const archive = await indexZipArchive(content)
        if (!cancelled) setState({ status: 'ready', entries: archive.entries, fileCount: archive.fileCount })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filePath, metadata.size, refreshKey])

  if (state.status === 'loading') {
    return (
      <FilePreviewLayout.Frame>
        <FilePreviewLayout.Content>
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {t('file_preview.loading')}
          </div>
        </FilePreviewLayout.Content>
      </FilePreviewLayout.Frame>
    )
  }

  if (state.status === 'error') {
    return (
      <FilePreviewLayout.Frame>
        <FilePreviewLayout.Content>
          <EmptyState
            icon={TriangleAlert}
            title={t('zip.preview.error_title')}
            description={t('zip.preview.error_description')}
            className="h-full"
          />
        </FilePreviewLayout.Content>
      </FilePreviewLayout.Frame>
    )
  }

  const tree = buildTree(state.entries)
  return (
    <FilePreviewLayout.Frame>
      <FilePreviewLayout.Content>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 border-border border-b px-4 text-sm">
            <Archive className="size-4 text-muted-foreground" aria-hidden />
            <span className="font-medium">{t('zip.preview.title')}</span>
            <span className="ml-auto text-muted-foreground">{t('zip.file_count', { count: state.fileCount })}</span>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div role="tree" aria-label={t('zip.preview.title')} className="p-3">
              {tree.map(({ node, depth }) => (
                <div
                  key={node.path}
                  role="treeitem"
                  aria-level={depth + 1}
                  className="flex h-7 items-center gap-2 rounded px-2 text-sm hover:bg-muted"
                  style={{ paddingLeft: `${8 + depth * 18}px` }}>
                  {node.directory ? (
                    <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate" title={node.path}>
                    {node.name}
                  </span>
                  {!node.directory && (
                    <span className="text-xs text-muted-foreground">{formatFileSize(node.size)}</span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </FilePreviewLayout.Content>
    </FilePreviewLayout.Frame>
  )
}
