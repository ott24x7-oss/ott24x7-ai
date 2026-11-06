import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input
} from '@cherrystudio/ui'
import { usePersistCache } from '@renderer/data/hooks/useCache'
import { useGuideChecklist } from '@renderer/hooks/useGuideChecklist'
import { useModelMutations, useModels } from '@renderer/hooks/useModel'
import { useProvider } from '@renderer/hooks/useProvider'
import { ipcApi } from '@renderer/ipc'
import { openExternalWebsite } from '@renderer/services/website'
import { GUIDE_AUTO_CHECKLIST_ITEMS } from '@renderer/utils/guide'
import type { OpenRouterFreeModel } from '@shared/types/openRouter'

import { useDesktopUpdate } from '@renderer/components/app/DesktopUpdateProvider'
import {
  addOpenRouterModelsToCompare,
  getOpenRouterCompareModelId,
  toOpenRouterCreateModelDto
} from './openRouterFreeModelSelection'

type DialogError =
  | 'invalid_key'
  | 'key_required'
  | 'unavailable'
  | 'save_failed'
  | 'models_unavailable'
  | 'no_models'
  | 'selection_limit'

const ERROR_TRANSLATION_KEYS: Record<DialogError, string> = {
  invalid_key: 'openrouter.free_models.error.invalid_key',
  key_required: 'openrouter.free_models.error.key_required',
  unavailable: 'openrouter.free_models.error.unavailable',
  save_failed: 'openrouter.free_models.error.save_failed',
  models_unavailable: 'openrouter.free_models.error.models_unavailable',
  no_models: 'openrouter.free_models.error.no_models',
  selection_limit: 'openrouter.free_models.error.selection_limit'
}

export function OpenRouterFreeModelsDialog() {
  const { t } = useTranslation()
  const {
    canShowOpenRouterPrompt,
    freeModelsOpen,
    setFreeModelsOpen
  } = useDesktopUpdate()
  const { addApiKey, enableProvider } = useProvider('openrouter')
  const { models: configuredModels, isLoading: configuredModelsLoading } = useModels({ providerId: 'openrouter' })
  const { createModels, updateModels } = useModelMutations()
  const { markDone } = useGuideChecklist()
  const [compareSelection, setCompareSelection] = usePersistCache('ui.compare.model_selection')
  const [neverShow, setNeverShow] = usePersistCache('ui.openrouter.free_models.never_show')
  const [neverShowChoice, setNeverShowChoice] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<OpenRouterFreeModel[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<DialogError | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const autoPromptChecked = useRef(false)

  useEffect(() => {
    if (!canShowOpenRouterPrompt || autoPromptChecked.current) return
    autoPromptChecked.current = true
    let active = true
    void ipcApi
      .request('openrouter.free_models.has_key')
      .then((hasKey) => {
        if (active && !hasKey && !neverShow) setFreeModelsOpen(true)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [canShowOpenRouterPrompt, neverShow, setFreeModelsOpen])

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return models
    return models.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(query))
  }, [models, search])

  const fetchModels = useCallback(async () => {
    const result = await ipcApi.request('openrouter.free_models.list')
    if (!result.ok) {
      setError('models_unavailable')
      return false
    }
    if (result.models.length === 0) {
      setModels([])
      setSelectedIds([])
      setError('no_models')
      return false
    }
    setModels(result.models)
    const preferred = [...result.models]
      .sort((left, right) => right.contextLength - left.contextLength || left.name.localeCompare(right.name))
      .slice(0, 4)
      .map((model) => model.id)
    setSelectedIds(preferred)
    setError(null)
    return true
  }, [])

  const handleCheckAndFetch = useCallback(async () => {
    setError(null)
    setIsChecking(true)
    try {
      const trimmedKey = apiKey.trim()
      if (trimmedKey) {
        const verification = await ipcApi.request('openrouter.free_models.verify_key', { apiKey: trimmedKey })
        if (!verification.ok) {
          setError(verification.reason === 'invalid-key' ? 'invalid_key' : 'unavailable')
          return
        }
        try {
          await addApiKey(trimmedKey, t('openrouter.free_models.button'))
          await enableProvider()
        } catch {
          setError('save_failed')
          return
        }
        setApiKey('')
      } else {
        const hasSavedKey = await ipcApi.request('openrouter.free_models.has_key')
        if (!hasSavedKey) {
          setError('key_required')
          return
        }
        await enableProvider()
      }
      await fetchModels()
    } catch {
      setError('unavailable')
    } finally {
      setIsChecking(false)
    }
  }, [addApiKey, apiKey, enableProvider, fetchModels, t])

  const handleAddToCompare = useCallback(async () => {
    if (selectedIds.length === 0 || configuredModelsLoading) return
    setError(null)
    setIsAdding(true)
    try {
      const selectedModels = models.filter((model) => selectedIds.includes(model.id))
      const existingByModelId = new Map(
        configuredModels
          .filter((model) => model.providerId === 'openrouter')
          .map((model) => [model.apiModelId ?? '', model])
      )
      const missing = selectedModels.filter((model) => !existingByModelId.has(model.id))
      const disabled = selectedModels.flatMap((model) => {
        const existing = existingByModelId.get(model.id)
        return existing && !existing.isEnabled ? [{ uniqueModelId: existing.id, patch: { isEnabled: true } }] : []
      })
      if (missing.length > 0) await createModels(missing.map(toOpenRouterCreateModelDto))
      if (disabled.length > 0) await updateModels(disabled)

      const nextSelection = addOpenRouterModelsToCompare(compareSelection, selectedIds)
      const blocked = selectedIds.some(
        (id) => !nextSelection.some((item) => item.id === getOpenRouterCompareModelId(id))
      )
      setCompareSelection(nextSelection)
      if (blocked) {
        setError('selection_limit')
        return
      }
      markDone(GUIDE_AUTO_CHECKLIST_ITEMS.customProviderAdded)
      if (neverShowChoice) setNeverShow(true)
      setFreeModelsOpen(false)
    } catch {
      setError('save_failed')
    } finally {
      setIsAdding(false)
    }
  }, [
    compareSelection,
    configuredModels,
    configuredModelsLoading,
    createModels,
    markDone,
    models,
    neverShowChoice,
    selectedIds,
    setCompareSelection,
    setFreeModelsOpen,
    setNeverShow,
    updateModels
  ])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setFreeModelsOpen(open)
      if (!open) {
        if (neverShowChoice) setNeverShow(true)
        setApiKey('')
      } else {
        setNeverShowChoice(false)
        setError(null)
      }
    },
    [neverShowChoice, setFreeModelsOpen, setNeverShow]
  )

  const toggleModel = useCallback((id: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? (current.includes(id) ? current : [...current, id]) : current.filter((modelId) => modelId !== id)
    )
  }, [])

  const errorText = error ? t(ERROR_TRANSLATION_KEYS[error]) : null

  return (
    <Dialog open={freeModelsOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('openrouter.free_models.title')}</DialogTitle>
          <DialogDescription>{t('openrouter.free_models.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="openrouter-free-models-api-key" className="text-sm font-medium">
              {t('openrouter.free_models.api_key')}
            </label>
            <Input
              id="openrouter-free-models-api-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <a
              href="https://openrouter.ai/keys"
              onClick={(event) => {
                event.preventDefault()
                void openExternalWebsite(event.currentTarget.href)
              }}
              className="text-sm text-link hover:underline">
              {t('openrouter.free_models.get_key')}
            </a>
          </div>

          <Button type="button" className="w-full" disabled={isChecking || isAdding} onClick={() => void handleCheckAndFetch()}>
            {isChecking ? t('openrouter.free_models.checking') : t('openrouter.free_models.check_fetch')}
          </Button>

          {errorText && <p role="alert" className="text-sm text-destructive">{errorText}</p>}

          {models.length > 0 && (
            <section aria-label={t('openrouter.free_models.model_list')} className="space-y-3 border-t pt-4">
              <Input
                aria-label={t('openrouter.free_models.search')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('openrouter.free_models.search')}
              />
              <p className="text-xs text-muted-foreground">
                {t('openrouter.free_models.selected_count', { count: selectedIds.length })}
              </p>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                {filteredModels.map((model) => (
                  <label key={model.id} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted">
                    <Checkbox
                      checked={selectedIds.includes(model.id)}
                      onCheckedChange={(checked) => toggleModel(model.id, checked === true)}
                      aria-label={t('openrouter.free_models.select_model', { model: model.name })}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{model.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{model.id}</span>
                    </span>
                    {model.contextLength > 0 && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {model.contextLength.toLocaleString()} {t('openrouter.free_models.context')}
                      </span>
                    )}
                  </label>
                ))}
                {filteredModels.length === 0 && <p className="px-2 py-4 text-center text-sm text-muted-foreground">{t('openrouter.free_models.no_matches')}</p>}
              </div>
            </section>
          )}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={neverShowChoice}
              onCheckedChange={(checked) => setNeverShowChoice(checked === true)}
              aria-label={t('openrouter.free_models.never_show')}
              size="sm"
            />
            {t('openrouter.free_models.never_show')}
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              {t('openrouter.free_models.not_now')}
            </Button>
            {models.length > 0 && (
              <Button type="button" disabled={selectedIds.length === 0 || configuredModelsLoading || isAdding} onClick={() => void handleAddToCompare()}>
                {isAdding
                  ? t('openrouter.free_models.adding')
                  : t('openrouter.free_models.add_to_compare', { count: selectedIds.length })}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
