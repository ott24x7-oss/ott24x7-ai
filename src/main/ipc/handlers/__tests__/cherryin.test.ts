import { describe, expect, it } from 'vitest'

import { cherryinHandlers } from '../cherryin'

describe('disabled CherryIN IPC routes', () => {
  it.each([
    [
      'cherryin.sign_in',
      { requestId: 'request-1', oauthServer: 'https://example.com', apiHost: 'https://example.com' }
    ],
    ['cherryin.get_balance', { apiHost: 'https://example.com' }],
    ['cherryin.logout', { apiHost: 'https://example.com' }]
  ] as const)('%s rejects without contacting a remote service', async (route, input) => {
    await expect(cherryinHandlers[route](input as never, { senderId: 'window-1' })).rejects.toThrow(
      'CherryIN integration is disabled in this build.'
    )
  })
})
