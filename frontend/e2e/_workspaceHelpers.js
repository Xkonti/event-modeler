// Shared e2e helpers for the workspace suite. Conventions (see
// auth.happy-path.spec.js): data-testid selectors ONLY, web-first expects, no
// clocks/RNG — per-spec emails use a fixed prefix + worker index, so re-runs
// against the throwaway Postgres are deterministic.
import { expect } from '@playwright/test'

export const PASSWORD = 'happy-path-pw-123'

/**
 * Sign up a fresh user (per spec file prefix + worker index) and land on the
 * dashboard.
 * @param {import('@playwright/test').Page} page
 * @param {string} prefix unique per spec file
 * @param {number} workerIndex
 */
export async function signup(page, prefix, workerIndex) {
  await page.goto('/signup')
  await page.getByTestId('signup-name').fill('E2E User')
  await page.getByTestId('signup-email').fill(`${prefix}-w${workerIndex}@example.test`)
  await page.getByTestId('signup-password').fill(PASSWORD)
  await page.getByTestId('signup-submit').click()
  await expect(page.getByTestId('app-shell')).toBeVisible()
}

/**
 * Create a model from the dashboard and open its workspace.
 * @returns {Promise<string>} the modelId (from the workspace URL)
 */
export async function createModelAndOpen(page, name) {
  await page.getByTestId('new-model').click()
  await page.getByTestId('new-model-name').fill(name)
  await page.getByTestId('new-model-submit').click()
  await expect(page).toHaveURL(/\/models\//)
  await expect(page.getByTestId('workspace-breadcrumb')).toHaveText(name)
  return page.url().split('/models/')[1]
}

/**
 * Create an entity via the palette "+ <Type>" → inspector create form.
 * Waits until the entity shows up in the palette catalog (projection settled).
 * @returns {Promise<void>}
 */
export async function createEntity(page, entityType, name) {
  await page.getByTestId(`palette-add-${entityType}`).click()
  await page.getByTestId('inspector-name').fill(name)
  await page.getByTestId('inspector-save').click()
  // Wait for EDIT mode, not the name value — the create form still shows the
  // typed name while the save is in flight, so toHaveValue alone passes
  // trivially. The Archive button exists only in edit mode, which requires the
  // catalog projection to have landed (the edit inspector resolves the entity
  // through the catalog).
  await expect(page.getByTestId('inspector-archive')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('inspector-name')).toHaveValue(name)
}

/**
 * Add a slice via the canvas overlay button; waits for the box to render.
 * @returns {Promise<string>} the sliceId (from the box testid)
 */
export async function addSlice(page) {
  const boxes = page.locator('[data-testid^="slice-box-"]')
  const before = await boxes.count()
  await page.getByTestId('add-slice').click()
  // Wait for the NEW box (count grows) — `.last()` alone races the projection
  // lag and can return an already-rendered earlier slice.
  await expect(boxes).toHaveCount(before + 1, { timeout: 15_000 })
  const testid = await boxes.last().getAttribute('data-testid')
  return testid.replace('slice-box-', '')
}

/**
 * Place an existing catalog entity into a slice's role ghost via the dialog.
 * @param {string} role trigger | command | fact (read models are auto-displayed)
 * @param {string} pickTestId `place-pick-<entityId>` — or use pickByName below
 */
export async function placeViaGhost(page, sliceId, role, entityName) {
  await page
    .getByTestId(`slice-box-${sliceId}`)
    .getByTestId(`ghost-${role}`)
    .click()
  await page
    .locator('[data-testid^="place-pick-"]', { hasText: entityName })
    .first()
    .click()
}

/**
 * An entity card on the canvas by name. Cards render inside their slice
 * frame's DOM (plain CSS-grid canvas), but with one workspace open, name +
 * .first() stays unambiguous enough for these specs.
 */
export function cardOnCanvas(page, entityName) {
  return page.locator('[data-entity-id]', { hasText: entityName }).first()
}
