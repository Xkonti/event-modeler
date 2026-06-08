// Playwright happy-path E2E over the REAL Vue canvas UI against the REAL backend.
//
// Scope: ONE thin happy path proving the canvas wires connect — slice creation →
// define+place entities → persistence across reload → drawing a relation by
// dragging between handles. Edge cases (422 invalid pair, 409 dup, crypto-shred,
// archived ghosts) belong to the backend integration suite, not here.
//
// Selectors: data-testid ONLY (page.getByTestId) — never CSS/text. Testids:
//   signup-form, signup-name, signup-email, signup-password, signup-submit
//   new-slice, slice-canvas, add-business-fact, add-command
//   create-entity-dialog, create-entity-name, create-entity-submit
//   node-${entityId}, handle-source-${id}, handle-target-${id}, edge-${src}-${tgt}
//
// Assertions: web-first expect (auto-waiting/retrying) throughout — no manual
// sleeps or bare boolean checks.
//
// Determinism: per-run email = fixed literal prefix + Playwright worker index
// (no clock, no RNG). The throwaway Postgres from global-setup is fresh each run,
// so reusing the address never collides.

import { test, expect } from '@playwright/test'

const PASSWORD = 'happy-path-pw-123' // >= 8 chars → passes the signup client check
const NAME = 'Canvas Happy Path User'

/**
 * Deterministic, unique-per-worker email. Distinct workers never collide.
 * @param {number} workerIndex
 * @returns {string}
 */
function emailForWorker(workerIndex) {
  return `canvas-happy-w${workerIndex}@example.test`
}

/** Sign up a fresh user → lands authed on the app shell at '/'. */
async function signUp(page, email) {
  await page.goto('/signup')
  await expect(page.getByTestId('signup-form')).toBeVisible()
  await page.getByTestId('signup-name').fill(NAME)
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(PASSWORD)
  await page.getByTestId('signup-submit').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('app-shell')).toBeVisible()
}

/** Create an entity via the seeded dialog, returning nothing — asserts a node appears. */
async function createEntity(page, toolbarTestid, name) {
  await page.getByTestId(toolbarTestid).click()
  await expect(page.getByTestId('create-entity-dialog')).toBeVisible()
  await page.getByTestId('create-entity-name').fill(name)
  await page.getByTestId('create-entity-submit').click()
  await expect(page.getByTestId('create-entity-dialog')).toBeHidden()
  // The new node carries the entity name; assert it rendered on the canvas.
  await expect(page.getByTestId('node-name').filter({ hasText: name })).toBeVisible()
}

test('new slice → add fact + command → persist across reload → draw relation', async ({ page }) => {
  const email = emailForWorker(test.info().workerIndex)

  // 1. Authenticate (fresh user) and land on the app shell.
  await signUp(page, email)

  // 2. Create a slice from Home → routes to /slices/:id with the canvas mounted.
  await page.getByTestId('new-slice').click()
  await expect(page).toHaveURL(/\/slices\/[^/]+$/)
  await expect(page.getByTestId('slice-canvas')).toBeVisible()

  // 3. Add a business fact "Order Placed" → its node renders.
  await createEntity(page, 'add-business-fact', 'Order Placed')

  // 4. Add a command "Place Order" → its node renders.
  await createEntity(page, 'add-command', 'Place Order')

  // 5. Reload → both placements survive (server-persisted, refetched by useSlice).
  await page.reload()
  await expect(page.getByTestId('slice-canvas')).toBeVisible()
  await expect(page.getByTestId('node-name').filter({ hasText: 'Order Placed' })).toBeVisible()
  await expect(page.getByTestId('node-name').filter({ hasText: 'Place Order' })).toBeVisible()

  // 6. Draw a relation: drag from the command's source handle to the fact's
  //    target handle. Resolve handle ids from the node containers (node id =
  //    entityId, which we don't know up front), so locate each node by its name
  //    span → walk to its node container → find its handle by role.
  const commandNode = page
    .getByTestId('node-name')
    .filter({ hasText: 'Place Order' })
    .locator('xpath=ancestor::*[starts-with(@data-testid,"node-")]')
  const factNode = page
    .getByTestId('node-name')
    .filter({ hasText: 'Order Placed' })
    .locator('xpath=ancestor::*[starts-with(@data-testid,"node-")]')

  // Source handle lives inside the command node; target handle inside the fact.
  const sourceHandle = commandNode.locator('[data-testid^="handle-source-"]')
  const targetHandle = factNode.locator('[data-testid^="handle-target-"]')

  const srcBox = await sourceHandle.boundingBox()
  const tgtBox = await targetHandle.boundingBox()
  expect(srcBox).not.toBeNull()
  expect(tgtBox).not.toBeNull()

  // Mouse drag between handle centers: move → down → move (in steps) → up.
  await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + tgtBox.height / 2, { steps: 8 })
  await page.mouse.up()

  // 7. The relation was drawn server-side and the refetch rendered the edge.
  //    The edge label carries data-testid="edge-${source}-${target}". We don't
  //    know the ids, so assert SOME edge-* testid is visible.
  await expect(page.locator('[data-testid^="edge-"]')).toBeVisible()
})
