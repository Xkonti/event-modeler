// W3 palette + W5/6 inspector: create a fact with fields, assign a NEW lane
// inline, place it into a slice via the ghost dialog, survive a reload, and
// exercise the dup-name 409 → "use existing" flow.
import { test, expect } from '@playwright/test'
import { signup, createModelAndOpen, addSlice } from './_workspaceHelpers.js'

test('entity lifecycle: create with fields + lane → place → reload persists → dup-name reuses', async ({ page }) => {
  await signup(page, 'entity', test.info().workerIndex)
  await createModelAndOpen(page, 'Entity Flow')

  // Create a business fact with two fields from the palette.
  await page.getByTestId('palette-add-businessFact').click()
  await page.getByTestId('inspector-name').fill('Budget Line Recorded')
  await page.getByTestId('add-field').click()
  await page.getByTestId('field-name-0').fill('amount')
  await page.getByTestId('field-type-0').fill('money')
  await page.getByTestId('add-field').click()
  await page.getByTestId('field-name-1').fill('lineId')
  await page.getByTestId('field-type-1').fill('id')
  await page.getByTestId('inspector-save').click()

  // First save flips create → edit (selection); the lane control appears.
  await expect(page.getByTestId('lane-select')).toBeVisible({ timeout: 15_000 })

  // Inline "+ new lane" → DefineContext → assign.
  await page.getByTestId('lane-new').click()
  await page.getByTestId('lane-new-name').fill('Budget')
  await page.getByTestId('lane-new-save').click()
  await expect(page.getByTestId('lane-select')).toHaveValue(/.+/, { timeout: 15_000 })

  // The fact shows in the palette catalog.
  await expect(
    page.locator('[data-testid^="palette-entity-"]', { hasText: 'Budget Line Recorded' }),
  ).toBeVisible({ timeout: 15_000 })

  // Place into a fresh slice via the facts ghost.
  const sliceId = await addSlice(page)
  await page.getByTestId(`slice-box-${sliceId}`).waitFor()
  await page.getByTestId('ghost-fact').click()
  await page
    .locator('[data-testid^="place-pick-"]', { hasText: 'Budget Line Recorded' })
    .click()
  await expect(
    page.locator('[data-entity-id]', { hasText: 'Budget Line Recorded' }),
  ).toBeVisible({ timeout: 15_000 })

  // Reload — board + catalog persist (server is the source of truth).
  await page.reload()
  await expect(
    page.locator('[data-entity-id]', { hasText: 'Budget Line Recorded' }),
  ).toBeVisible({ timeout: 15_000 })

  // Dup-name: defining the same name again → inline 409 error + "use existing".
  await page.getByTestId('palette-add-businessFact').click()
  await page.getByTestId('inspector-name').fill('Budget Line Recorded')
  await page.getByTestId('inspector-save').click()
  await expect(page.getByTestId('use-existing')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('use-existing').click()
  // Reuse selects the EXISTING identity — the inspector shows it in edit mode.
  await expect(page.getByTestId('inspector-name')).toHaveValue('Budget Line Recorded')
  await expect(page.getByTestId('lane-select')).toBeVisible()
})
