import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CompareEmptyState } from '../CompareEmptyState'

const mocks = vi.hoisted(() => ({
  apps: [] as Array<{ appId: string; name: string; logo?: string; status: string; kind: 'site' }>,
  updateAppStatus: vi.fn()
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@renderer/hooks/useMiniApps', () => ({
  useMiniApps: () => ({ allApps: mocks.apps, updateAppStatus: mocks.updateAppStatus })
}))
vi.mock('@renderer/components/icons/MiniAppIcon', () => ({ default: () => <span aria-hidden="true">logo</span> }))

describe('CompareEmptyState', () => {
  const onAddColumn = vi.fn()
  const onUseSubscriptions = vi.fn()
  const onOpenModelPicker = vi.fn()

  beforeEach(() => {
    mocks.apps = [
      { appId: 'anthropic', name: 'Claude', logo: 'claude', status: 'disabled', kind: 'site' },
      { appId: 'openai', name: 'ChatGPT', logo: 'openai', status: 'enabled', kind: 'site' },
      { appId: 'gemini', name: 'Gemini', logo: 'gemini', status: 'enabled', kind: 'site' },
      { appId: 'deepseek', name: 'DeepSeek', logo: 'deepseek', status: 'disabled', kind: 'site' }
    ]
    mocks.updateAppStatus.mockReset().mockResolvedValue(undefined)
    onAddColumn.mockReset()
    onUseSubscriptions.mockReset()
    onOpenModelPicker.mockReset()
  })

  it('passes the four subscription web apps to the page action', async () => {
    render(
      <CompareEmptyState
        onAddColumn={onAddColumn}
        onUseSubscriptions={onUseSubscriptions}
        onOpenModelPicker={onOpenModelPicker}
        cliAvailability={[]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'compare.empty.use_subscriptions' }))

    await waitFor(() => expect(onUseSubscriptions).toHaveBeenCalledOnce())
    expect(mocks.updateAppStatus).not.toHaveBeenCalled()
    expect(onUseSubscriptions).toHaveBeenCalledWith([
      'webapp::anthropic',
      'webapp::openai',
      'webapp::gemini',
      'webapp::deepseek'
    ])
  })

  it('adds a clicked tile, shows an available CLI, and opens the API picker', async () => {
    render(
      <CompareEmptyState
        onAddColumn={onAddColumn}
        onUseSubscriptions={onUseSubscriptions}
        onOpenModelPicker={onOpenModelPicker}
        cliAvailability={[{ id: 'claude', available: true }]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'ChatGPT' }))
    await waitFor(() => expect(onAddColumn).toHaveBeenCalledWith('webapp::openai'))
    expect(await screen.findByRole('button', { name: 'Claude Code' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ compare.empty.add_api_model' }))
    expect(onOpenModelPicker).toHaveBeenCalledOnce()
  })
})
