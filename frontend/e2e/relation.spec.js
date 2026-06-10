// W7 relations: card relate buttons (no drag gestures) — the wireframe's "→"
// button connects to the only legal target (the command), the W7 inspector
// opens with the kind preselected from the 11-pair table, save, the straight
// SVG edge renders with its stored kind. Invalid directions are never offered:
// a command with no placed fact has NO outgoing button at all.
import { test, expect } from '@playwright/test'
import { signup, createModelAndOpen, addSlice } from './_workspaceHelpers.js'

test('relate buttons: single candidate connects → kind preselected → save → edge renders; invalid directions not offered', async ({ page }) => {
  await signup(page, 'relation', test.info().workerIndex)
  await createModelAndOpen(page, 'Relation Flow')

  const sliceId = await addSlice(page)

  // Wireframe (trigger ghost) + command (command ghost), both create-new.
  await page.getByTestId('ghost-trigger').click()
  await page.getByTestId('place-create-wireframe').click()
  await page.getByTestId('inspector-name').fill('Budget Entry Form')
  await page.getByTestId('inspector-save').click()
  const wireframeCard = page.locator('[data-entity-id]', { hasText: 'Budget Entry Form' })
  await expect(wireframeCard).toBeVisible({ timeout: 15_000 })

  await page.getByTestId('ghost-command').click()
  await page.getByTestId('place-create-command').click()
  await page.getByTestId('inspector-name').fill('Record Budget Line')
  await page.getByTestId('inspector-save').click()
  const commandCard = page.locator('[data-entity-id]', { hasText: 'Record Budget Line' })
  await expect(commandCard).toBeVisible({ timeout: 15_000 })

  // Resolve the two entity ids from the card testids.
  const wfId = (await wireframeCard.getAttribute('data-testid')).replace('node-', '')
  const cmdId = (await commandCard.getAttribute('data-testid')).replace('node-', '')

  // The wireframe's "→" button has exactly one legal target (the command) →
  // connects immediately; the W7 inspector opens with `issues` preselected.
  await wireframeCard.hover()
  await page.getByTestId(`relate-out-${wfId}`).click()
  await expect(page.getByTestId('relation-inspector')).toBeVisible()
  await expect(page.getByTestId('relation-kind')).toHaveValue('issues')
  await page.getByTestId('relation-save').click()

  // The edge renders from the refetched board, labeled with the stored kind.
  await expect(page.getByTestId(`edge-${sliceId}-issues`)).toBeVisible({ timeout: 15_000 })

  // Invalid direction (command → wireframe) is never offered: the command has
  // no legal outgoing target (no fact placed) → no "→" button at all. Its "←"
  // button is gone too — the wireframe→command pair already has its relation.
  await commandCard.hover()
  await expect(page.getByTestId(`relate-out-${cmdId}`)).toHaveCount(0)
  await expect(page.getByTestId(`relate-in-${cmdId}`)).toHaveCount(0)
})
