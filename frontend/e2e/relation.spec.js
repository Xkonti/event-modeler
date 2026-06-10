// W7 relations: drag handle→handle to connect (wireframe → command = `issues`,
// preselected from the 11-pair table), save, edge renders with its stored kind;
// an invalid pair (command → wireframe direction reversed) is rejected
// client-side with a banner before any request.
import { test, expect } from '@playwright/test'
import { signup, createModelAndOpen, addSlice } from './_workspaceHelpers.js'

/** Drag from one handle to another with raw mouse events (vue-flow connect). */
async function connect(page, fromHandle, toHandle) {
  const from = await fromHandle.boundingBox()
  const to = await toHandle.boundingBox()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('draw relation: connect gesture → kind preselected → save → edge renders; invalid pair banners', async ({ page }) => {
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

  // Resolve the two entity ids from the card testids for handle targeting.
  const wfId = (await wireframeCard.getAttribute('data-testid')).replace('node-', '')
  const cmdId = (await commandCard.getAttribute('data-testid')).replace('node-', '')

  // Connect wireframe (bottom source) → command (top target): a valid `issues`
  // pair → the W7 inspector opens with the kind preselected.
  await connect(page, page.getByTestId(`handle-bs-${wfId}`), page.getByTestId(`handle-tt-${cmdId}`))
  await expect(page.getByTestId('relation-inspector')).toBeVisible()
  await expect(page.getByTestId('relation-kind')).toHaveValue('issues')
  await page.getByTestId('relation-save').click()

  // The edge renders from the refetched board, labeled with the stored kind.
  await expect(page.getByTestId(`edge-${sliceId}-issues`)).toBeVisible({ timeout: 15_000 })

  // Invalid pair: command → wireframe (reversed) is not in the allow-list →
  // client-side banner, no inspector.
  await connect(page, page.getByTestId(`handle-bs-${cmdId}`), page.getByTestId(`handle-tt-${wfId}`))
  await expect(
    page.getByText('That relation is not allowed between these entity types.'),
  ).toBeVisible()
})
