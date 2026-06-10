// W4 snap-slot board: create + place a command and two facts via ghost slots,
// reorder the facts with the ▲▼ swap buttons (the e2e-stable swap path — never
// drag in e2e), and toggle the lanes layer.
import { test, expect } from '@playwright/test'
import { signup, createModelAndOpen, addSlice, createEntity } from './_workspaceHelpers.js'

test('snap slots: place via ghosts → ▲▼ slot swap reorders → lanes toggle', async ({ page }) => {
  await signup(page, 'snap', test.info().workerIndex)
  await createModelAndOpen(page, 'Snap Flow')

  const sliceId = await addSlice(page)

  // Create + place a command through the ghost's "create new" path.
  await page.getByTestId('ghost-command').click()
  await page.getByTestId('place-create-command').click()
  await page.getByTestId('inspector-name').fill('Record Budget Line')
  await page.getByTestId('inspector-save').click()
  await expect(
    page.locator('[data-entity-id]', { hasText: 'Record Budget Line' }),
  ).toBeVisible({ timeout: 15_000 })

  // Two facts via the facts ghost (create-new path each time).
  for (const name of ['Fact Alpha', 'Fact Beta']) {
    await page.getByTestId('ghost-fact').click()
    await page.getByTestId('place-create-businessFact').click()
    await page.getByTestId('inspector-name').fill(name)
    await page.getByTestId('inspector-save').click()
    await expect(
      page.locator('[data-entity-id]', { hasText: name }),
    ).toBeVisible({ timeout: 15_000 })
  }

  const alpha = page.locator('[data-entity-id]', { hasText: 'Fact Alpha' })
  const beta = page.locator('[data-entity-id]', { hasText: 'Fact Beta' })

  // Initial slot order: Alpha (slot 0) above Beta (slot 1).
  const yOf = async (locator) => (await locator.boundingBox()).y
  expect(await yOf(alpha)).toBeLessThan(await yOf(beta))

  // Swap via the ▲ button on Beta (hover reveals the controls).
  await beta.hover()
  await page.locator('[data-testid^="swap-up-"]').click()

  // After the refetch the authoritative order is flipped.
  await expect
    .poll(async () => (await yOf(beta)) < (await yOf(alpha)), { timeout: 15_000 })
    .toBe(true)

  // Lanes toggle: the facts band shows the "(none)" lane label when on.
  await page.getByTestId('lanes-toggle').check()
  await expect(page.getByTestId('lane-label-none').first()).toBeVisible()
  await page.getByTestId('lanes-toggle').uncheck()
  await expect(page.getByTestId('lane-label-none')).toHaveCount(0)
})
