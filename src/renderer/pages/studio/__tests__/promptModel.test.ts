import { describe, expect, it } from 'vitest'

import type { Model } from '@shared/data/types/model'
import type { Provider } from '@shared/data/types/provider'

import { pickStudioPromptModel } from '../promptModel'

const makeModel = (id: string, capabilities: Model['capabilities'] = []): Model => ({
  id: `${id}::chat`,
  providerId: id,
  apiModelId: 'chat',
  name: id,
  capabilities,
  supportsStreaming: true,
  isEnabled: true,
  isHidden: false
})

const makeProvider = (id: string, auth: 'key' | 'login' | 'none' | 'local'): Provider =>
  ({
    id,
    isEnabled: true,
    authType: auth === 'login' ? 'oauth' : 'api-key',
    authOptional: auth === 'local',
    apiKeys: auth === 'key' ? [{ id: 'key', isEnabled: true }] : []
  }) as Provider

describe('pickStudioPromptModel', () => {
  it('prefers the compare judge, then the default chat model, among usable providers', () => {
    const fallback = makeModel('default')
    const judge = makeModel('judge')
    const models = [fallback, judge]
    const providers = [makeProvider('default', 'key'), makeProvider('judge', 'login')]

    expect(pickStudioPromptModel(models, providers, judge.id, fallback.id)?.id).toBe(judge.id)
    expect(pickStudioPromptModel(models, providers, 'missing', fallback.id)?.id).toBe(fallback.id)
  })

  it('skips embedding, keyless, and disabled provider models', () => {
    const embedding = makeModel('embedding', ['embedding'])
    const keyless = makeModel('keyless')
    const disabled = makeModel('disabled')
    disabled.isEnabled = false
    const available = makeModel('available')

    expect(
      pickStudioPromptModel(
        [embedding, keyless, disabled, available],
        [
          makeProvider('embedding', 'key'),
          makeProvider('keyless', 'none'),
          makeProvider('disabled', 'key'),
          makeProvider('available', 'key')
        ]
      )?.id
    ).toBe(available.id)
  })

  it('uses an enabled local provider without requiring an API key', () => {
    const local = makeModel('local')
    expect(pickStudioPromptModel([local], [makeProvider('local', 'local')])?.id).toBe(local.id)
  })
})
