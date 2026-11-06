import { LoaderCircle, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Input, Textarea, Tooltip } from '@cherrystudio/ui'
import { toast } from '@renderer/services/toast'

import { improveStudioPrompt } from './studioPrompt'
import { useStudioPromptModel } from './useStudioPromptModel'

const OPTION_FIELDS = [
  { key: 'style', labelKey: 'studio.prompt_helper.style', value: 'Photorealistic' },
  { key: 'camera', labelKey: 'studio.prompt_helper.camera', value: 'Medium shot, eye level' },
  { key: 'lighting', labelKey: 'studio.prompt_helper.lighting', value: 'Soft natural light' }
] as const

export default function PromptHelper({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const model = useStudioPromptModel()
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState<Record<'style' | 'camera' | 'lighting', string>>({
    style: 'Photorealistic',
    camera: 'Medium shot, eye level',
    lighting: 'Soft natural light'
  })
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [improving, setImproving] = useState(false)

  const copyPrompt = async () => {
    if (!prompt.trim()) return
    await navigator.clipboard.writeText(prompt.trim())
    toast.success(t('studio.prompt_helper.copied'))
  }

  const improvePrompt = async () => {
    if (!prompt.trim() || !model) return
    setImproving(true)
    try {
      const improved = await improveStudioPrompt(model.id, prompt, { ...options, aspectRatio })
      if (improved) setPrompt(improved)
    } catch (error) {
      toast.errorFromException(error ?? new Error(t('studio.prompt_helper.improve_failed')))
    } finally {
      setImproving(false)
    }
  }

  return (
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col border-border border-l bg-background">
      <div className="flex h-11 items-center justify-between border-border border-b px-3">
        <h2 className="font-medium text-sm">{t('studio.prompt_helper.title')}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('common.collapse')}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <Textarea.Input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t('studio.prompt_helper.placeholder')}
          className="min-h-36 resize-y"
        />
        {OPTION_FIELDS.map((field) => (
          <label key={field.key} className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">{t(field.labelKey)}</span>
            <Input
              value={options[field.key]}
              onChange={(event) => setOptions((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </label>
        ))}
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">{t('studio.prompt_helper.aspect_ratio')}</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
            value={aspectRatio}
            onChange={(event) => setAspectRatio(event.target.value)}>
            {['1:1', '4:3', '3:2', '16:9', '9:16'].map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>
        </label>
        <Tooltip content={t('studio.prompt_helper.add_model')} isDisabled={Boolean(model)}>
          <span className="block">
            <Button
              variant="outline"
              disabled={!prompt.trim() || !model || improving}
              onClick={() => void improvePrompt()}>
              {improving ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles size={16} />}
              {improving ? t('studio.prompt_helper.improving') : t('studio.prompt_helper.improve')}
            </Button>
          </span>
        </Tooltip>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={!prompt.trim()} onClick={() => void copyPrompt()}>
            {t('common.copy')}
          </Button>
          <Button variant="default" disabled={!prompt.trim()} onClick={() => void copyPrompt()}>
            {t('studio.prompt_helper.insert_into_page')}
          </Button>
        </div>
      </div>
    </aside>
  )
}
