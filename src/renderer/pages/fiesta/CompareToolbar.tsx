import { Focus, Globe2, Grid2X2, GripVertical, Plus, Sparkles, TerminalSquare, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tooltip
} from '@cherrystudio/ui'
import { useIcon } from '@cherrystudio/ui/icons'
import { useIsActiveTab } from '@renderer/hooks/tab'
import { useMiniApps } from '@renderer/hooks/useMiniApps'
import { ipcApi } from '@renderer/ipc'
import type { CompareColumnId, CompareJudgeId, CompareLayout, CompareModelStatus } from '@renderer/types/compare'
import { getModelLogoRef } from '@renderer/utils/model'
import { cn } from '@renderer/utils/style'
import type { CacheCompareModelSelection, CacheCompareSavedSet } from '@shared/data/cache/cacheValueTypes'
import type { Model, UniqueModelId } from '@shared/data/types/model'
import type { CompareCliAvailability, CompareCliId } from '@shared/types/compareCli'

import {
  getCompareKeyboardAction,
  reorderCompareModels,
  setCompareModelEnabled,
  syncCompareModelSelection
} from './compareState'

export type { CompareLayout, CompareModelStatus } from '@renderer/types/compare'

interface CompareToolbarProps {
  selection: CacheCompareModelSelection[]
  models: Model[]
  savedSets: CacheCompareSavedSet[]
  activeSetId: string
  onSelectionChange: (selection: CacheCompareModelSelection[]) => void
  onSelectSet: (setId: string) => void
  onSaveSet: (name: string) => void
  focusedModelId: CompareColumnId | null
  onFocusModel: (modelId: CompareColumnId | null) => void
  layout: CompareLayout
  onLayoutChange: (layout: CompareLayout) => void
  onlyFocusedModel: boolean
  onOnlyFocusedModelChange: (onlyFocusedModel: boolean) => void
  statusByModelId: ReadonlyMap<UniqueModelId, CompareModelStatus>
  judgeId: CompareJudgeId
  judgeOptions: readonly { id: CompareJudgeId; label: string }[]
  onJudgeChange: (judgeId: CompareJudgeId) => void
  onJudgePickerOpen: () => void
  canCombine: boolean
  onCombine: () => void
}

const COLUMN_COUNTS = [1, 2, 3, 4] as const
const CLI_LABELS: Record<CompareCliId, string> = { claude: 'Claude', agy: 'Gemini', codex: 'ChatGPT' }

export function CompareToolbar({
  selection,
  models,
  savedSets,
  activeSetId,
  onSelectionChange,
  onSelectSet,
  onSaveSet,
  focusedModelId,
  onFocusModel,
  layout,
  onLayoutChange,
  onlyFocusedModel,
  onOnlyFocusedModelChange,
  statusByModelId,
  judgeId,
  judgeOptions,
  onJudgeChange,
  onJudgePickerOpen,
  canCombine,
  onCombine
}: CompareToolbarProps) {
  const { t } = useTranslation()
  const isActiveTab = useIsActiveTab()
  const [setName, setSetName] = useState('')
  const [isNamingSet, setIsNamingSet] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isJudgePickerOpen, setIsJudgePickerOpen] = useState(false)
  const [cliAvailability, setCliAvailability] = useState<CompareCliAvailability[]>([])
  const [isCheckingClis, setIsCheckingClis] = useState(false)
  const { allApps } = useMiniApps()
  const selectedModelsById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models])
  const appsById = useMemo(
    () =>
      new Map(
        allApps.filter((app) => app.status === 'enabled' || app.status === 'pinned').map((app) => [app.appId, app])
      ),
    [allApps]
  )
  const selectedColumnIds = useMemo(() => selection.map((item) => item.id), [selection])
  const focusSelectedModel = useCallback((modelId: CompareColumnId | null) => onFocusModel(modelId), [onFocusModel])

  useEffect(() => {
    if (!isActiveTab) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = getCompareKeyboardAction(event.key, event.ctrlKey, focusedModelId, selectedColumnIds)
      if (!action) return
      event.preventDefault()
      focusSelectedModel(action.type === 'exit-focus' ? null : action.modelId)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusSelectedModel, focusedModelId, isActiveTab, selectedColumnIds])

  const handlePickerChange = useCallback(
    (id: CompareColumnId, checked: boolean) => {
      const ids = new Set(selection.map((item) => item.id))
      if (checked) ids.add(id)
      else ids.delete(id)
      onSelectionChange(syncCompareModelSelection(selection, [...ids]))
    },
    [onSelectionChange, selection]
  )
  const handleDrop = useCallback(
    (sourceId: CompareColumnId, targetId: CompareColumnId) => {
      onSelectionChange(reorderCompareModels(selection, sourceId, targetId))
    },
    [onSelectionChange, selection]
  )
  const handlePickerOpenChange = useCallback((open: boolean) => {
    setIsPickerOpen(open)
    if (!open) return
    setIsCheckingClis(true)
    void ipcApi
      .request('compare_cli.available', {})
      .then(setCliAvailability)
      .catch(() => setCliAvailability([]))
      .finally(() => setIsCheckingClis(false))
  }, [])
  const handleSaveSet = useCallback(() => {
    const name = setName.trim()
    if (!name) return
    onSaveSet(name)
    setSetName('')
    setIsNamingSet(false)
  }, [onSaveSet, setName])

  return (
    <section
      data-ui="fiesta.compare-toolbar"
      className="flex min-h-0 shrink-0 flex-col gap-2 border-b border-border bg-background px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={activeSetId} onValueChange={onSelectSet}>
          <SelectTrigger size="sm" className="w-44" aria-label={t('compare.saved_sets.label')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">{t('compare.saved_sets.free_models')}</SelectItem>
            <SelectItem value="all-enabled">{t('compare.saved_sets.all_enabled')}</SelectItem>
            <SelectItem value="custom">{t('compare.saved_sets.custom')}</SelectItem>
            {savedSets.map((set) => (
              <SelectItem key={set.id} value={set.id}>
                {set.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={judgeId}
          onValueChange={(value) => onJudgeChange(value as CompareJudgeId)}
          open={isJudgePickerOpen}
          onOpenChange={(open) => {
            setIsJudgePickerOpen(open)
            if (open) onJudgePickerOpen()
          }}>
          <SelectTrigger size="sm" className="w-52" aria-label={t('compare.judge.label')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {judgeOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
            {!judgeOptions.some((option) => option.id === judgeId) && (
              <SelectItem value={judgeId}>{t('compare.judge.unavailable')}</SelectItem>
            )}
          </SelectContent>
        </Select>
        {canCombine && (
          <Button type="button" size="sm" variant="default" className="h-7 gap-1.5 px-2.5" onClick={onCombine}>
            <Sparkles className="size-3.5" />
            {t('compare.combine')}
          </Button>
        )}
        <div
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
          role="list"
          aria-label={t('sidebar.icon.compare')}>
          {focusedModelId
            ? selectedColumnIds.map((id) => {
                const model = isApiColumnId(id) ? selectedModelsById.get(id) : undefined
                const app = id.startsWith('webapp::') ? appsById.get(decodeWebAppColumnId(id)) : null
                const cliId = id.startsWith('cli::') ? (id.slice('cli::'.length) as CompareCliId) : null
                const label = model?.name ?? app?.name ?? (cliId ? CLI_LABELS[cliId] : null)
                if (!label) return null
                return (
                  <CompareFocusTab
                    key={id}
                    label={label}
                    model={model}
                    web={Boolean(app)}
                    cli={Boolean(cliId)}
                    active={focusedModelId === id}
                    onClick={() => focusSelectedModel(id)}
                  />
                )
              })
            : selection.map((item) => {
                const model = isApiColumnId(item.id) ? selectedModelsById.get(item.id) : undefined
                if (model) {
                  return (
                    <CompareModelChip
                      key={item.id}
                      model={model}
                      enabled={item.enabled}
                      focused={false}
                      status={statusByModelId.get(item.id) ?? 'waiting'}
                      onToggle={() => onSelectionChange(setCompareModelEnabled(selection, item.id, !item.enabled))}
                      onFocus={() => focusSelectedModel(item.id)}
                      onRemove={() =>
                        onSelectionChange(selection.filter((selectionItem) => selectionItem.id !== item.id))
                      }
                      onDrop={handleDrop}
                    />
                  )
                }
                if (item.id.startsWith('webapp::')) {
                  const app = appsById.get(decodeWebAppColumnId(item.id))
                  if (!app) return null
                  return (
                    <CompareOtherChip
                      key={item.id}
                      id={item.id}
                      name={app.name}
                      kind="web"
                      enabled={item.enabled}
                      focused={false}
                      onToggle={() => onSelectionChange(setCompareModelEnabled(selection, item.id, !item.enabled))}
                      onFocus={() => focusSelectedModel(item.id)}
                      onRemove={() =>
                        onSelectionChange(selection.filter((selectionItem) => selectionItem.id !== item.id))
                      }
                      onDrop={handleDrop}
                    />
                  )
                }
                if (item.id.startsWith('cli::')) {
                  const cliId = item.id.slice('cli::'.length) as CompareCliId
                  if (!(cliId in CLI_LABELS)) return null
                  return (
                    <CompareOtherChip
                      key={item.id}
                      id={item.id}
                      name={CLI_LABELS[cliId]}
                      kind="cli"
                      enabled={item.enabled}
                      focused={false}
                      onToggle={() => onSelectionChange(setCompareModelEnabled(selection, item.id, !item.enabled))}
                      onFocus={() => focusSelectedModel(item.id)}
                      onRemove={() =>
                        onSelectionChange(selection.filter((selectionItem) => selectionItem.id !== item.id))
                      }
                      onDrop={handleDrop}
                    />
                  )
                }
                return null
              })}
          <DropdownMenu open={isPickerOpen} onOpenChange={handlePickerOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2">
                <Plus className="size-3.5" />
                {t('compare.add_model')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[70vh] w-72 overflow-y-auto">
              <DropdownMenuLabel>{t('compare.model_group.api_models')}</DropdownMenuLabel>
              {models.map((model) => (
                <DropdownMenuCheckboxItem
                  key={model.id}
                  checked={selection.some((item) => item.id === model.id)}
                  onCheckedChange={(checked) => handlePickerChange(model.id, checked)}>
                  {model.name}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('compare.model_group.web_apps')}</DropdownMenuLabel>
              {[...appsById.values()].map((app) => {
                const id = webAppColumnId(app.appId)
                return (
                  <DropdownMenuCheckboxItem
                    key={id}
                    checked={selection.some((item) => item.id === id)}
                    onCheckedChange={(checked) => handlePickerChange(id, checked)}>
                    {app.name}
                  </DropdownMenuCheckboxItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t('compare.model_group.app_accounts')}</DropdownMenuLabel>
              {isCheckingClis && <div className="px-2 py-1.5 text-xs text-muted-foreground">{t('common.loading')}</div>}
              {!isCheckingClis &&
                cliAvailability
                  .filter((cli) => cli.available)
                  .map(({ id }) => (
                    <DropdownMenuCheckboxItem
                      key={id}
                      checked={selection.some((item) => item.id === `cli::${id}`)}
                      onCheckedChange={(checked) => handlePickerChange(`cli::${id}`, checked)}>
                      {getCliAccountLabel(id, t)}
                    </DropdownMenuCheckboxItem>
                  ))}
              {!isCheckingClis && cliAvailability.every((cli) => !cli.available) && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">{t('compare.cli.none_available')}</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {focusedModelId && (
          <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            <Switch checked={onlyFocusedModel} onCheckedChange={onOnlyFocusedModelChange} />
            {t('compare.only_this_model')}
          </label>
        )}
        <div className="flex items-center gap-1" aria-label={t('compare.layout.label')}>
          {COLUMN_COUNTS.map((columns) => (
            <Tooltip key={columns} content={t('compare.layout.columns', { count: columns })}>
              <Button
                type="button"
                size="icon-sm"
                variant={layout.kind === 'columns' && layout.columns === columns ? 'secondary' : 'ghost'}
                aria-label={t('compare.layout.columns', { count: columns })}
                aria-pressed={layout.kind === 'columns' && layout.columns === columns}
                onClick={() => onLayoutChange({ kind: 'columns', columns })}>
                {columns}
              </Button>
            </Tooltip>
          ))}
          <Tooltip content={t('compare.layout.grid_2x2')}>
            <Button
              type="button"
              size="icon-sm"
              variant={layout.kind === 'grid' ? 'secondary' : 'ghost'}
              aria-label={t('compare.layout.grid_2x2')}
              aria-pressed={layout.kind === 'grid'}
              onClick={() => onLayoutChange({ kind: 'grid' })}>
              <Grid2X2 className="size-3.5" aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
        {isNamingSet ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              className="h-7 w-36"
              value={setName}
              aria-label={t('compare.save_set_placeholder')}
              placeholder={t('compare.save_set_placeholder')}
              onChange={(event) => setSetName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSaveSet()
                if (event.key === 'Escape') {
                  setSetName('')
                  setIsNamingSet(false)
                }
              }}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              aria-label={t('common.save')}
              disabled={!setName.trim()}
              onClick={handleSaveSet}>
              <span className="text-xs">✓</span>
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => {
              setSetName('')
              setIsNamingSet(true)
            }}>
            {t('compare.save_set')}
          </Button>
        )}
      </div>
      {focusedModelId && (
        <div className="flex items-center justify-between border-t border-border-subtle pt-2">
          <span className="truncate text-xs text-muted-foreground">
            {t('compare.focus_mode')}
            {selectedColumnIds.includes(focusedModelId) && (
              <span className="ml-2">
                {t('compare.focus_shortcut', { number: selectedColumnIds.indexOf(focusedModelId) + 1 })}
              </span>
            )}
          </span>
          <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => focusSelectedModel(null)}>
            {t('compare.exit_focus')}
          </Button>
        </div>
      )}
    </section>
  )
}

function CompareFocusTab({
  label,
  model,
  web,
  cli,
  active,
  onClick
}: {
  label: string
  model?: Model
  web: boolean
  cli: boolean
  active: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const icon = useIcon(model ? getModelLogoRef(model, model.providerId) : undefined)

  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      role="listitem"
      aria-current={active ? 'true' : undefined}
      aria-label={label}
      className="h-7 max-w-48 gap-1.5 px-2"
      title={t('compare.focus_model', { model: label })}
      onClick={onClick}>
      {icon ? (
        <icon.Avatar size={16} />
      ) : web ? (
        <Globe2 className="size-3.5" />
      ) : cli ? (
        <TerminalSquare className="size-3.5" />
      ) : (
        <Focus className="size-3.5" />
      )}
      <span className="truncate">{label}</span>
    </Button>
  )
}

function CompareModelChip({
  model,
  enabled,
  focused,
  status,
  onToggle,
  onFocus,
  onRemove,
  onDrop
}: {
  model: Model
  enabled: boolean
  focused: boolean
  status: CompareModelStatus
  onToggle: () => void
  onFocus: () => void
  onRemove: () => void
  onDrop: (sourceId: CompareColumnId, targetId: CompareColumnId) => void
}) {
  const { t } = useTranslation()
  const icon = useIcon(getModelLogoRef(model, model.providerId))
  const dragId = model.id
  const statusLabel = t(
    {
      waiting: 'compare.status.waiting',
      streaming: 'compare.status.streaming',
      done: 'compare.status.done',
      error: 'compare.status.error'
    }[status]
  )

  return (
    <div
      className={cn('flex h-7 items-center rounded-md border border-border', enabled && 'bg-card')}
      role="listitem"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', dragId)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const sourceId = event.dataTransfer.getData('text/plain') as CompareColumnId
        if (sourceId) onDrop(sourceId, model.id)
      }}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={enabled}
        aria-label={`${model.name}: ${statusLabel}`}
        title={statusLabel}
        className={cn('h-full min-w-0 gap-1.5 rounded-r-none px-2', !enabled && 'text-muted-foreground')}
        onClick={onToggle}>
        <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
        {icon ? <icon.Avatar size={16} /> : null}
        <span className="max-w-32 truncate">{model.name}</span>
        <span
          aria-label={statusLabel}
          className={cn(
            'size-1.5 shrink-0 rounded-full bg-muted-foreground',
            status === 'streaming' && 'animate-pulse bg-primary',
            status === 'done' && 'bg-success',
            status === 'error' && 'bg-error'
          )}
        />
      </Button>
      <Tooltip content={t('compare.focus_model', { model: model.name })}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('compare.focus_model', { model: model.name })}
          aria-pressed={focused}
          className="size-7 rounded-none"
          onClick={onFocus}>
          <Focus className="size-3.5" />
        </Button>
      </Tooltip>
      <Tooltip content={t('chat.input.followup_queue.remove')}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('chat.input.followup_queue.remove')}
          className="size-7 rounded-l-none"
          onClick={onRemove}>
          <X className="size-3.5" />
        </Button>
      </Tooltip>
    </div>
  )
}

function webAppColumnId(appId: string): `webapp::${string}` {
  return `webapp::${encodeURIComponent(appId)}`
}

function decodeWebAppColumnId(id: string): string {
  try {
    return decodeURIComponent(id.slice('webapp::'.length))
  } catch {
    return ''
  }
}

function isApiColumnId(id: CompareColumnId): id is UniqueModelId {
  return !id.startsWith('webapp::') && !id.startsWith('cli::')
}

function getCliAccountLabel(id: CompareCliId, t: ReturnType<typeof useTranslation>['t']): string {
  switch (id) {
    case 'claude':
      return t('compare.cli.account.claude')
    case 'agy':
      return t('compare.cli.account.agy')
    case 'codex':
      return t('compare.cli.account.codex')
  }
}

function CompareOtherChip({
  id,
  name,
  kind,
  enabled,
  focused,
  onToggle,
  onFocus,
  onRemove,
  onDrop
}: {
  id: CompareColumnId
  name: string
  kind: 'web' | 'cli'
  enabled: boolean
  focused: boolean
  onToggle: () => void
  onFocus: () => void
  onRemove: () => void
  onDrop: (sourceId: CompareColumnId, targetId: CompareColumnId) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className={cn('flex h-7 items-center rounded-md border border-border', enabled && 'bg-card')}
      role="listitem"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', id)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const sourceId = event.dataTransfer.getData('text/plain') as CompareColumnId
        if (sourceId) onDrop(sourceId, id)
      }}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={enabled}
        className={cn('h-full min-w-0 gap-1.5 rounded-r-none px-2', !enabled && 'text-muted-foreground')}
        onClick={onToggle}>
        <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
        {kind === 'web' ? (
          <Globe2 className="size-3.5 shrink-0" aria-label={t('compare.web_badge')} />
        ) : (
          <TerminalSquare className="size-3.5 shrink-0" />
        )}
        <span className="max-w-32 truncate">{name}</span>
      </Button>
      <Tooltip content={t('compare.focus_model', { model: name })}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('compare.focus_model', { model: name })}
          aria-pressed={focused}
          className="size-7 rounded-none"
          onClick={onFocus}>
          <Focus className="size-3.5" />
        </Button>
      </Tooltip>
      <Tooltip content={t('chat.input.followup_queue.remove')}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('chat.input.followup_queue.remove')}
          className="size-7 rounded-l-none"
          onClick={onRemove}>
          <X className="size-3.5" />
        </Button>
      </Tooltip>
    </div>
  )
}
