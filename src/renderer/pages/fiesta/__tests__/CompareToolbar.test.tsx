import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { CacheCompareModelSelection } from '@shared/data/cache/cacheValueTypes'
import type { Model } from '@shared/data/types/model'

import { MAX_COMPARE_COLUMNS } from '../compareState'
import { CompareToolbar, type CompareLayout } from '../CompareToolbar'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: { model?: string; count?: number }) => {
      if (key === 'compare.layout.columns') return `${options?.count} columns`
      return key
    }
  })
}))
vi.mock('@renderer/hooks/useMiniApps', () => ({ useMiniApps: () => ({ allApps: [] }) }))
vi.mock('@renderer/components/chat/panes/Shell', () => ({
  RightPanelShortcut: ({ label }: { label: string }) => <button type="button">{label}</button>
}))

const model = {
  id: 'openai-codex::gpt-5',
  name: 'GPT-5',
  providerId: 'openai-codex',
  capabilities: [],
  supportsStreaming: true,
  isEnabled: true,
  isHidden: false
} as Model

function CompareToolbarHarness({
  selection = [{ id: model.id, enabled: true }],
  canCombine = true,
  onCombine = vi.fn(),
  onSelectSet = vi.fn()
}: {
  selection?: CacheCompareModelSelection[]
  canCombine?: boolean
  onCombine?: () => void
  onSelectSet?: (setId: string) => void
}) {
  const [layout, setLayout] = useState<CompareLayout>({ kind: 'columns', columns: 2 })

  return (
    <CompareToolbar
      selection={selection}
      models={[model]}
      savedSets={[]}
      activeSetId="custom"
      onSelectionChange={vi.fn()}
      onSelectSet={onSelectSet}
      onSaveSet={vi.fn()}
      layout={layout}
      onLayoutChange={setLayout}
      judgeId="auto"
      judgeOptions={[{ id: 'auto', label: 'Automatic judge' }]}
      onJudgeChange={vi.fn()}
      onJudgePickerOpen={vi.fn()}
      canCombine={canCombine}
      onCombine={onCombine}
      onOpenHistory={vi.fn()}
      apiPickerOpen={false}
      onApiPickerOpenChange={vi.fn()}
      cliAvailability={[]}
      isCheckingClis={false}
    />
  )
}

describe('CompareToolbar', () => {
  it('keeps the main Compare controls in one row and changes the column layout', () => {
    render(<CompareToolbarHarness />)

    expect(screen.getByRole('button', { name: 'compare.add_model' })).toBeInTheDocument()
    expect(screen.getByText('compare.saved_sets.prefix')).toBeInTheDocument()
    expect(screen.getByText('compare.judge.prefix')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'history.records.shortTitle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'compare.combine' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '3 columns' }))
    expect(screen.getByRole('button', { name: '3 columns' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('disables Add model at eight columns, shows the limit tooltip, and offers My subscriptions', () => {
    const selection: CacheCompareModelSelection[] = Array.from({ length: MAX_COMPARE_COLUMNS }, (_, index) => ({
      id: `provider::model-${index}` as const,
      enabled: true
    }))
    render(<CompareToolbarHarness selection={selection} />)

    const addModelButton = screen.getByRole('button', { name: 'compare.add_model' })
    expect(addModelButton).toBeDisabled()
    expect(screen.getByText('compare.add_model_limit_tooltip')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /compare\.saved_sets\.label/ }))
    expect(screen.getByText('compare.saved_sets.my_subscriptions')).toBeInTheDocument()
    expect(screen.queryByText('compare.saved_sets.all_enabled')).not.toBeInTheDocument()
  })

  it('keeps Combine visible and disabled until results are ready', () => {
    render(<CompareToolbarHarness canCombine={false} />)

    expect(screen.getByRole('button', { name: 'compare.combine' })).toBeDisabled()
  })
})
