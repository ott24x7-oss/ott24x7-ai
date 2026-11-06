import { Check, ChevronDown, Clock3, Plus, Save, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip
} from '@cherrystudio/ui'
import { useMiniApps } from '@renderer/hooks/useMiniApps'
import type { CompareColumnId, CompareJudgeId, CompareLayout } from '@renderer/types/compare'
import type { CacheCompareModelSelection, CacheCompareSavedSet } from '@shared/data/cache/cacheValueTypes'
import type { Model } from '@shared/data/types/model'
import type { CompareCliAvailability, CompareCliId } from '@shared/types/compareCli'

import { MAX_COMPARE_COLUMNS, syncCompareModelSelection } from './compareState'

export type { CompareLayout } from '@renderer/types/compare'

interface CompareToolbarProps {
  selection: CacheCompareModelSelection[]
  models: Model[]
  savedSets: CacheCompareSavedSet[]
  activeSetId: string
  onSelectionChange: (selection: CacheCompareModelSelection[]) => void
  onSelectSet: (setId: string) => void
  onSaveSet: (name: string) => void
  layout: CompareLayout
  onLayoutChange: (layout: CompareLayout) => void
  judgeId: CompareJudgeId
  judgeOptions: readonly { id: CompareJudgeId; label: string }[]
  onJudgeChange: (judgeId: CompareJudgeId) => void
  onJudgePickerOpen: () => void
  canCombine: boolean
  onCombine: () => void
  onOpenHistory: () => void
  apiPickerOpen: boolean
  onApiPickerOpenChange: (open: boolean) => void
  cliAvailability: readonly CompareCliAvailability[]
  isCheckingClis: boolean
}

const COLUMN_COUNTS = [1, 2, 3, 4] as const

export function CompareToolbar({
  selection,
  models,
  savedSets,
  activeSetId,
  onSelectionChange,
  onSelectSet,
  onSaveSet,
  layout,
  onLayoutChange,
  judgeId,
  judgeOptions,
  onJudgeChange,
  onJudgePickerOpen,
  canCombine,
  onCombine,
  onOpenHistory,
  apiPickerOpen,
  onApiPickerOpenChange,
  cliAvailability,
  isCheckingClis
}: CompareToolbarProps) {
  const { t } = useTranslation()
  const [setName, setSetName] = useState('')
  const [isNamingSet, setIsNamingSet] = useState(false)
  const isAtColumnLimit = selection.length >= MAX_COMPARE_COLUMNS
  const { allApps } = useMiniApps()
  const apps = useMemo(() => allApps.filter((app) => app.status === 'enabled' || app.status === 'pinned'), [allApps])
  const activeSetName = useMemo(() => {
    if (activeSetId === 'my-subscriptions') return t('compare.saved_sets.my_subscriptions')
    if (activeSetId === 'free') return t('compare.saved_sets.free_models')
    if (activeSetId === 'custom') return t('compare.saved_sets.custom')
    return savedSets.find((set) => set.id === activeSetId)?.name ?? t('compare.saved_sets.custom')
  }, [activeSetId, savedSets, t])

  const handlePickerOpenChange = useCallback(
    (open: boolean) => {
      onApiPickerOpenChange(open)
    },
    [onApiPickerOpenChange]
  )
  const handlePickerChange = useCallback(
    (id: CompareColumnId, checked: boolean) => {
      const ids = new Set(selection.map((item) => item.id))
      if (checked && !ids.has(id) && selection.length >= MAX_COMPARE_COLUMNS) return
      if (checked) ids.add(id)
      else ids.delete(id)
      onSelectionChange(syncCompareModelSelection(selection, [...ids]))
    },
    [onSelectionChange, selection]
  )
  const saveSet = useCallback(() => {
    const name = setName.trim()
    if (!name) return
    onSaveSet(name)
    setSetName('')
    setIsNamingSet(false)
  }, [onSaveSet, setName])

  return (
    <header
      data-ui="fiesta.compare-toolbar"
      className="flex h-12 shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto border-b border-border bg-background px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 max-w-56 shrink-0 gap-1.5 px-2.5"
            aria-label={`${t('compare.saved_sets.label')}: ${activeSetName}`}>
            <span className="text-muted-foreground">{t('compare.saved_sets.prefix')}</span>
            <span className="truncate">{activeSetName}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>{t('compare.saved_sets.label')}</DropdownMenuLabel>
          {[
            ['my-subscriptions', t('compare.saved_sets.my_subscriptions')],
            ['free', t('compare.saved_sets.free_models')],
            ['custom', t('compare.saved_sets.custom')]
          ].map(([id, name]) => (
            <DropdownMenuItem key={id} onSelect={() => onSelectSet(id)}>
              <span className="flex-1">{name}</span>
              {activeSetId === id && <Check className="size-3.5 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          ))}
          {savedSets
            .filter((set) => !['my-subscriptions', 'free', 'custom', 'all-enabled'].includes(set.id))
            .map((set) => (
              <DropdownMenuItem key={set.id} onSelect={() => onSelectSet(set.id)}>
                <span className="flex-1">{set.name}</span>
                {activeSetId === set.id && <Check className="size-3.5 text-primary" aria-hidden="true" />}
              </DropdownMenuItem>
            ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setIsNamingSet(true)}>
            <Save className="mr-2 size-3.5" />
            {t('compare.save_set')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Select
        value={judgeId}
        onValueChange={(value) => onJudgeChange(value as CompareJudgeId)}
        onOpenChange={(open) => open && onJudgePickerOpen()}>
        <SelectTrigger
          size="sm"
          className="h-8 w-56 shrink-0 gap-1.5"
          aria-label={t('compare.judge.label')}
          title={judgeOptions.find((option) => option.id === judgeId)?.label}>
          <span className="text-muted-foreground">{t('compare.judge.prefix')}</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {judgeOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DropdownMenu open={apiPickerOpen} onOpenChange={handlePickerOpenChange}>
        <Tooltip content={isAtColumnLimit ? t('compare.add_model_limit_tooltip') : undefined}>
          <span className="shrink-0">
            <DropdownMenuTrigger asChild>
              <Button
                data-compare-add-model
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1 px-2"
                disabled={isAtColumnLimit}>
                <Plus className="size-3.5" />
                {t('compare.add_model')}
              </Button>
            </DropdownMenuTrigger>
          </span>
        </Tooltip>
        <DropdownMenuContent align="start" className="max-h-[70vh] w-72 overflow-y-auto">
          <DropdownMenuLabel>{t('compare.model_group.api_models')}</DropdownMenuLabel>
          {models.map((model) => (
            <DropdownMenuCheckboxItem
              key={model.id}
              checked={selection.some((item) => item.id === model.id)}
              disabled={isAtColumnLimit && !selection.some((item) => item.id === model.id)}
              onCheckedChange={(checked) => handlePickerChange(model.id, checked)}>
              {model.name}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('compare.model_group.web_apps')}</DropdownMenuLabel>
          {apps.map((app) => {
            const id = `webapp::${encodeURIComponent(app.appId)}` as CompareColumnId
            return (
              <DropdownMenuCheckboxItem
                key={id}
                checked={selection.some((item) => item.id === id)}
                disabled={isAtColumnLimit && !selection.some((item) => item.id === id)}
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
                  disabled={isAtColumnLimit && !selection.some((item) => item.id === `cli::${id}`)}
                  onCheckedChange={(checked) => handlePickerChange(`cli::${id}`, checked)}>
                  {getCliLabel(id, t)}
                </DropdownMenuCheckboxItem>
              ))}
          {!isCheckingClis && cliAvailability.every((cli) => !cli.available) && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">{t('compare.cli.none_available')}</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {isNamingSet && (
        <form
          className="flex shrink-0 items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            saveSet()
          }}>
          <Input
            autoFocus
            className="h-8 w-32"
            value={setName}
            aria-label={t('compare.save_set_placeholder')}
            placeholder={t('compare.save_set_placeholder')}
            onChange={(event) => setSetName(event.target.value)}
          />
          <Button type="submit" size="icon-sm" variant="secondary" className="size-8" disabled={!setName.trim()}>
            <Save className="size-3.5" />
          </Button>
        </form>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div className="flex items-center rounded-md border border-border p-0.5" aria-label={t('compare.layout.label')}>
          {COLUMN_COUNTS.map((count) => (
            <Tooltip key={count} content={t('compare.layout.columns', { count })}>
              <Button
                type="button"
                size="icon-sm"
                variant={layout.kind === 'columns' && layout.columns === count ? 'secondary' : 'ghost'}
                aria-label={t('compare.layout.columns', { count })}
                aria-pressed={layout.kind === 'columns' && layout.columns === count}
                className="size-7"
                onClick={() => onLayoutChange({ kind: 'columns', columns: count })}>
                {count}
              </Button>
            </Tooltip>
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0 gap-1.5 px-2" onClick={onOpenHistory}>
          <Clock3 className="size-3.5" />
          {t('history.records.shortTitle')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-8 shrink-0 gap-1.5 bg-(--cs-theme-primary) px-2.5 text-(--cs-theme-primary-foreground) hover:bg-(--cs-theme-primary)/90"
          disabled={!canCombine}
          onClick={onCombine}>
          <Sparkles className="size-3.5" />
          {t('compare.combine')}
        </Button>
      </div>
    </header>
  )
}

function getCliLabel(id: CompareCliId, t: (key: string) => string): string {
  switch (id) {
    case 'claude':
      return t('compare.cli.account.claude')
    case 'agy':
      return t('compare.cli.account.agy')
    case 'codex':
      return t('compare.cli.account.codex')
  }
}
