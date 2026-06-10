// A2 validation punch-list: a fact with no producing command → "Check model"
// lists `fact-without-producer`; clicking the finding selects the entity
// (inspector shows it after the panel closes). Advisory only.
import { test, expect } from '@playwright/test'
import { signup, createModelAndOpen, createEntity } from './_workspaceHelpers.js'

test('check model: unproduced fact surfaces as a finding → click focuses entity', async ({ page }) => {
  await signup(page, 'validation', test.info().workerIndex)
  await createModelAndOpen(page, 'Validation Flow')

  // A lone fact — no producer relation → a completeness finding.
  await createEntity(page, 'businessFact', 'Orphan Fact')

  await page.getByTestId('check-model').click()
  await expect(page.getByTestId('validation-panel')).toBeVisible()

  // Validation reads the async projections — if the first check raced the
  // catalog write, recheck until the finding lands (the panel is on-demand by
  // design, so rechecking IS the product behavior).
  const finding = page.locator('[data-testid^="validation-finding-"]', {
    hasText: 'Orphan Fact',
  })
  await expect(async () => {
    await page.getByTestId('validation-recheck').click()
    await expect(finding).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  await expect(finding).toContainText('no producing command')

  // Click → entity selected; close the panel → the inspector shows the fact.
  await finding.click()
  await page.getByTestId('validation-close').click()
  await expect(page.getByTestId('inspector-name')).toHaveValue('Orphan Fact', {
    timeout: 15_000,
  })
})
