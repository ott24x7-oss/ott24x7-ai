import en from '../../../src/renderer/i18n/locales/en-us.json'
import { LATEST_PRIVACY_POLICY_VERSION } from '../../../src/shared/utils/constants'
import { expect, test } from './fixtures/electron.fixture'

test('Compare opens with model controls and the column layout selector', async ({ mainWindow }) => {
  await mainWindow.evaluate(async (policyVersion) => {
    await window.api.preference.setMultiple({
      'app.onboarding.provider_setup.status': 'skipped',
      'app.privacy.policy_version': policyVersion,
      'app.language': 'en-US'
    })
  }, LATEST_PRIVACY_POLICY_VERSION)
  await mainWindow.reload()
  await expect(mainWindow.locator('[data-ui~="app.shell"]').first()).toBeVisible({ timeout: 60_000 })
  await mainWindow.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('cherry:open-main-route', {
        cancelable: true,
        detail: { path: '/app/compare' }
      })
    )
  })

  await expect(mainWindow.locator('[data-ui="fiesta.compare-toolbar"]')).toBeVisible()
  await expect(mainWindow.getByRole('button', { name: en['compare.add_model'], exact: true })).toBeVisible()
  await expect(
    mainWindow.getByRole('button', { name: en['compare.layout.columns'].replace('{{count}}', '2'), exact: true })
  ).toBeVisible()
})
