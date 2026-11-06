import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ButtonHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MODEL_CAPABILITY } from '@shared/data/types/model'
import type { Model } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'
import type { VideoGenerationRecord } from '@shared/types/videoGeneration'

import StudioVideoTab from '../StudioVideoTab'

const mocks = vi.hoisted(() => ({
  models: [] as Model[],
  providers: [] as Provider[],
  request: vi.fn(),
  navigate: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))

vi.mock('@renderer/hooks/useModel', () => ({ useModels: () => ({ models: mocks.models }) }))
vi.mock('@renderer/hooks/useProvider', () => ({ useProviders: () => ({ providers: mocks.providers }) }))
vi.mock('@renderer/ipc', () => ({
  ipcApi: { request: mocks.request },
  useIpcOn: vi.fn()
}))
vi.mock('@renderer/services/toast', () => ({
  toast: { error: vi.fn(), errorFromException: vi.fn(), info: vi.fn(), success: vi.fn() }
}))

vi.mock('@cherrystudio/ui', () => ({
  Button: (props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    const buttonProps = { ...props }
    delete buttonProps.variant
    delete buttonProps.size
    const { children, ...attributes } = buttonProps
    return (
      <button type="button" {...attributes}>
        {children}
      </button>
    )
  },
  ConfirmDialog: () => null,
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    'aria-label'?: string
  }) => <button type="button" role="switch" aria-checked={checked} onClick={() => onCheckedChange(!checked)} {...props} />,
  Textarea: { Input: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} /> }
}))

const testModel = {
  id: 'heyroute::grok-imagine-video',
  providerId: 'heyroute',
  apiModelId: 'grok-imagine-video',
  name: 'Grok Imagine Video',
  capabilities: [MODEL_CAPABILITY.VIDEO_GENERATION],
  supportsStreaming: false,
  isEnabled: true,
  isHidden: false
} as Model

const testProvider = {
  id: 'heyroute',
  name: 'HeyRoute',
  apiKeys: [{ id: 'key-1', isEnabled: true }],
  authType: 'api-key',
  settings: {},
  reportsActualCost: false,
  isEnabled: true
} as Provider

function completedRecord(overrides: Partial<VideoGenerationRecord> = {}): VideoGenerationRecord {
  return {
    id: '7d4d8991-84ec-432d-8b1a-5544800d3c76',
    providerId: 'heyroute',
    modelId: testModel.id,
    modelName: testModel.name,
    prompt: 'A quiet beach at dusk',
    duration: 5,
    ratio: '16:9',
    generateAudio: true,
    status: 'queued',
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
    startedAt: 1,
    ...overrides
  }
}

describe('Studio video tab', () => {
  beforeEach(() => {
    mocks.models = []
    mocks.providers = []
    mocks.navigate.mockReset()
    mocks.request.mockReset().mockResolvedValue([])
  })

  it('shows the empty feed templates and provider setup link when no keyed video model exists', async () => {
    const user = userEvent.setup()
    render(<StudioVideoTab onEnhancePrompt={async (prompt) => prompt} />)

    expect(await screen.findByText('studio.video.no_model_title')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /studio.video.templates\./ })).toHaveLength(6)
    await user.click(screen.getByRole('button', { name: 'studio.video.configure_provider' }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/settings/provider' })
  })

  it('submits the selected video model and the visible generation controls', async () => {
    const user = userEvent.setup()
    mocks.models = [testModel]
    mocks.providers = [testProvider]
    const record = completedRecord()
    mocks.request.mockImplementation(async (route: string) => (route === 'video.generation.list' ? [] : record))
    render(<StudioVideoTab onEnhancePrompt={async (prompt) => prompt} />)

    const modelSelect = await screen.findByRole('combobox', { name: 'studio.video.model' })
    expect(modelSelect).toHaveTextContent('Grok Imagine Video · HeyRoute')
    await user.type(screen.getByRole('textbox', { name: 'studio.video.prompt' }), 'A quiet beach at dusk')
    await user.click(screen.getByRole('button', { name: 'studio.video.generate' }))

    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith('video.generation.create', {
        modelId: testModel.id,
        prompt: 'A quiet beach at dusk',
        duration: 5,
        ratio: '16:9',
        generateAudio: true
      })
    )
  })
})
