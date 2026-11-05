import { fireEvent, render, screen } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { Model, UniqueModelId } from '@shared/data/types/model'

import { CompareToolbar, type CompareLayout } from '../CompareToolbar'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: { model?: string; count?: number }) => {
      if (key === 'compare.focus_model') return `Focus ${options?.model ?? ''}`
      if (key === 'compare.layout.columns') return `${options?.count} columns`
      return key
    }
  })
}))
vi.mock('@renderer/components/ModelSelector', () => ({
  ModelSelector: ({ trigger }: { trigger: ReactNode }) => trigger
}))
vi.mock('@renderer/hooks/tab', () => ({ useIsActiveTab: () => true }))
vi.mock('@renderer/hooks/useMiniApps', () => ({ useMiniApps: () => ({ allApps: [] }) }))
vi.mock('@renderer/utils/model', () => ({ getModelLogoRef: () => undefined }))
vi.mock('@cherrystudio/ui/icons', () => ({ useIcon: () => undefined }))

const model = {
  id: 'openai-codex::gpt-5',
  name: 'GPT-5',
  providerId: 'openai-codex',
  capabilities: [],
  supportsStreaming: true,
  isEnabled: true,
  isHidden: false
} as Model

function FocusToolbarHarness() {
  const [focusedModelId, setFocusedModelId] = useState<UniqueModelId | null>(null)
  const [onlyFocusedModel, setOnlyFocusedModel] = useState(false)
  const [layout, setLayout] = useState<CompareLayout>({ kind: 'columns', columns: 2 })

  return (
    <CompareToolbar
      selection={[{ id: model.id, enabled: true }]}
      models={[model]}
      savedSets={[]}
      activeSetId="custom"
      onSelectionChange={vi.fn()}
      onSelectSet={vi.fn()}
      onSaveSet={vi.fn()}
      focusedModelId={focusedModelId}
      onFocusModel={setFocusedModelId}
      layout={layout}
      onLayoutChange={setLayout}
      onlyFocusedModel={onlyFocusedModel}
      onOnlyFocusedModelChange={setOnlyFocusedModel}
      statusByModelId={new Map()}
      judgeId="auto"
      judgeOptions={[{ id: 'auto', label: 'Automatic judge' }]}
      onJudgeChange={vi.fn()}
      onJudgePickerOpen={vi.fn()}
      canCombine={false}
      onCombine={vi.fn()}
    />
  )
}

describe('CompareToolbar focus mode', () => {
  it('enters focus from a model chip and exits with Escape', () => {
    render(<FocusToolbarHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Focus GPT-5' }))
    expect(screen.getByRole('listitem', { name: 'GPT-5' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('compare.focus_mode')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'GPT-5: compare.status.waiting' })).toBeInTheDocument()
    expect(screen.queryByText('compare.focus_mode')).not.toBeInTheDocument()
  })
})
