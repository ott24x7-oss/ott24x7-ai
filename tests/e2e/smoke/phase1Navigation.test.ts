import { LATEST_PRIVACY_POLICY_VERSION } from '../../../src/shared/utils/constants'
import { expect, test } from './fixtures/electron.fixture'
import { uiLocator } from './utils/uiLocator'

test.describe('Fiesta navigation', () => {
  test('starts on Compare in dark mode and opens the Studio placeholder', async ({ mainWindow }) => {
    await mainWindow.evaluate(async (policyVersion) => {
      await window.api.preference.setMultiple({
        'app.onboarding.provider_setup.status': 'skipped',
        'app.privacy.policy_version': policyVersion,
        'app.language': 'en-US'
      })
    }, LATEST_PRIVACY_POLICY_VERSION)
    await mainWindow.reload()
    await expect(mainWindow.locator('[data-ui~="app.shell"]').first()).toBeVisible({ timeout: 60_000 })

    await expect(mainWindow.locator('html')).toHaveClass(/\bdark\b/)
    await expect(mainWindow.getByText('Compare models side by side')).toBeVisible()

    await uiLocator(mainWindow, 'app.sidebar').getByRole('button', { name: 'Studio' }).last().click()
    await expect(mainWindow.getByText('Image and video tools will appear here.')).toBeVisible()
  })
})
