import { expect, test } from './fixtures/electron.fixture'
import { waitForAppReady } from './utils/waitHelpers'

test('opens the in-app Guide from the sidebar', async ({ mainWindow }) => {
  await waitForAppReady(mainWindow)

  const guideEntry = mainWindow
    .locator('#app-sidebar button')
    .filter({ has: mainWindow.locator('svg.lucide-book-open') })
  await expect(guideEntry).toHaveCount(1)
  await guideEntry.click()

  await expect(mainWindow.getByRole('heading', { name: 'User Guide' })).toBeVisible()
  await expect(mainWindow.getByText('0 of 8 done')).toBeVisible()
})
