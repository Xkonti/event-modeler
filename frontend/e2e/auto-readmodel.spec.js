// Auto-displayed read models: RMs are never placed — the canvas derives them
// from relations. A wireframe's "←" offers catalog RMs (displayedBy); saving
// makes the RM card appear in the reading slice at command height. A fact's
// "→" offers the RM too (feeds); when the feeder sits in the slice immediately
// LEFT, the RM card straddles the shared boundary. Delete on an auto card is a
// no-op (there is no placement to remove).
import { test, expect } from '@playwright/test'
import { signup, createModelAndOpen, addSlice, createEntity } from './_workspaceHelpers.js'

test('read model auto-displays next to its reader and straddles the boundary when fed from the left slice', async ({ page }) => {
  await signup(page, 'auto-rm', test.info().workerIndex)
  await createModelAndOpen(page, 'Auto RM Flow')

  // RM created via the palette — proves creation works without placement.
  await createEntity(page, 'readModel', 'Budget Summary')

  // Slice A (left): a fact, create-new via the fact ghost.
  const sliceA = await addSlice(page)
  const boxA = page.getByTestId(`slice-box-${sliceA}`)
  await boxA.getByTestId('ghost-fact').click()
  await page.getByTestId('place-create-businessFact').click()
  await page.getByTestId('inspector-name').fill('Budget Line Recorded')
  await page.getByTestId('inspector-save').click()
  const factCard = page.locator('[data-entity-id]', { hasText: 'Budget Line Recorded' })
  await expect(factCard).toBeVisible({ timeout: 15_000 })

  // Slice B (right): a wireframe, create-new via the trigger ghost.
  const sliceB = await addSlice(page)
  const boxB = page.getByTestId(`slice-box-${sliceB}`)
  await boxB.getByTestId('ghost-trigger').click()
  await page.getByTestId('place-create-wireframe').click()
  await page.getByTestId('inspector-name').fill('Budget Screen')
  await page.getByTestId('inspector-save').click()
  const wireframeCard = page.locator('[data-entity-id]', { hasText: 'Budget Screen' })
  await expect(wireframeCard).toBeVisible({ timeout: 15_000 })
  const wfId = (await wireframeCard.getAttribute('data-testid')).replace('node-', '')

  // No read model ghost anywhere — manual RM placement is gone.
  await expect(page.getByTestId('ghost-readModel')).toHaveCount(0)

  // Wireframe "←": the catalog RM is the only legal source → connects
  // immediately, kind preselected to displayedBy.
  await wireframeCard.hover()
  await page.getByTestId(`relate-in-${wfId}`).click()
  await expect(page.getByTestId('relation-inspector')).toBeVisible()
  await expect(page.getByTestId('relation-kind')).toHaveValue('displayedBy')
  await page.getByTestId('relation-save').click()

  // The RM auto-appears INSIDE slice B (no placement involved) with its edge.
  const rmCard = boxB.locator('[data-entity-id]', { hasText: 'Budget Summary' })
  await expect(rmCard).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId(`edge-${sliceB}-displayedBy`)).toBeVisible({ timeout: 15_000 })

  // Not straddling yet: the RM card sits inside slice B's bounds.
  expect((await rmCard.boundingBox()).x).toBeGreaterThanOrEqual((await boxB.boundingBox()).x)

  // Fact "→": the RM is the only legal target → feeds, save.
  const factId = (await factCard.getAttribute('data-testid')).replace('node-', '')
  await factCard.hover()
  await page.getByTestId(`relate-out-${factId}`).click()
  await expect(page.getByTestId('relation-inspector')).toBeVisible()
  await expect(page.getByTestId('relation-kind')).toHaveValue('feeds')
  await page.getByTestId('relation-save').click()

  // Fed from the slice immediately left → the card straddles the boundary
  // (its left half hangs over slice A) and the cross-slice feeds edge renders.
  await expect(page.getByTestId(`edge-${sliceB}-feeds`)).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(
      async () => {
        // Fresh rects each round — the canvas reflows as boards refetch.
        const [rm, box] = await Promise.all([rmCard.boundingBox(), boxB.boundingBox()])
        return rm.x - box.x
      },
      { timeout: 15_000 },
    )
    .toBeLessThan(0)

  // Delete on the auto card is a no-op — nothing placed, nothing to remove.
  await rmCard.click()
  await page.keyboard.press('Delete')
  await expect(rmCard).toBeVisible()
  await expect(page.getByTestId('app-banner')).toHaveCount(0)
})
