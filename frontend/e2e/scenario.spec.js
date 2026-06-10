// W8 scenarios: "+ GWT" from the slice strip → editor with the slice's command
// prefilled as anchor → given/when/then → save → the scenario auto-surfaces in
// the strip (F6). Archiving a referenced fact flags the scenario out-of-sync.
import { test, expect } from '@playwright/test'
import { signup, createModelAndOpen, addSlice } from './_workspaceHelpers.js'

test('GWT: strip add → anchored on the slice command → save → surfaces; archived ref → out of sync', async ({ page }) => {
  await signup(page, 'scenario', test.info().workerIndex)
  await createModelAndOpen(page, 'Scenario Flow')

  const sliceId = await addSlice(page)

  // Command + fact on the board.
  await page.getByTestId('ghost-command').click()
  await page.getByTestId('place-create-command').click()
  await page.getByTestId('inspector-name').fill('Record Budget Line')
  await page.getByTestId('inspector-save').click()
  await expect(
    page.locator('[data-entity-id]', { hasText: 'Record Budget Line' }),
  ).toBeVisible({ timeout: 15_000 })

  await page.getByTestId('ghost-fact').click()
  await page.getByTestId('place-create-businessFact').click()
  await page.getByTestId('inspector-name').fill('Budget Line Recorded')
  await page.getByTestId('inspector-save').click()
  await expect(
    page.locator('[data-entity-id]', { hasText: 'Budget Line Recorded' }),
  ).toBeVisible({ timeout: 15_000 })

  // + GWT from the bottom strip → the anchor command is prefilled.
  await page.getByTestId(`add-gwt-${sliceId}`).click()
  await expect(page.getByTestId('scenario-editor')).toBeVisible()
  const anchor = page.getByTestId('scenario-anchor')
  await expect(anchor.locator('option:checked')).toHaveText('Record Budget Line', {
    timeout: 15_000,
  })

  // WHEN values + THEN emit the fact.
  await page.getByTestId('when-values').fill('{"amount": 5}')
  await page.getByTestId('emit-add').click()
  await page.getByTestId('emit-fact-0').selectOption({ label: 'Budget Line Recorded' })
  await page.getByTestId('emit-values-0').fill('{"amount": 5}')
  await page.getByTestId('scenario-save').click()

  // F6 — the scenario auto-surfaces in the slice strip.
  const strip = page.getByTestId(`scenario-strip-${sliceId}`)
  await expect(strip.locator('[data-testid^="scenario-"]').first()).toContainText('GWT', {
    timeout: 15_000,
  })

  // Archive the referenced fact → the scenario goes out-of-sync (second-class
  // commentary vs the structural truth — gwt.md).
  await page
    .locator('[data-testid^="palette-entity-"]', { hasText: 'Budget Line Recorded' })
    .click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('inspector-archive').click()

  // Open the scenario from the strip → out-of-sync badge. The archive kicks
  // off spaced board refetches that re-render the strip — a click can land on
  // a just-replaced button and be lost, so retry click+assert as a unit.
  await expect(async () => {
    await strip.locator('button[data-testid^="scenario-"]').first().click()
    await expect(page.getByTestId('scenario-out-of-sync')).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
})
