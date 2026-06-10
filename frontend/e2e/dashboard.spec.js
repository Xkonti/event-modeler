// W2 dashboard happy path: create → rename → export (download = O1 state-view
// JSON) → archive. Conventions per auth.happy-path.spec.js (testids, web-first
// expects, deterministic emails).
import { test, expect } from '@playwright/test'
import { signup } from './_workspaceHelpers.js'

test('model dashboard: create → rename → export JSON → archive', async ({ page }) => {
  await signup(page, 'dashboard', test.info().workerIndex)

  // Create — lands in the workspace, then back to the dashboard list.
  await page.getByTestId('new-model').click()
  await page.getByTestId('new-model-name').fill('Budgeting')
  await page.getByTestId('new-model-submit').click()
  await expect(page).toHaveURL(/\/models\//)
  const modelId = page.url().split('/models/')[1]
  // Wait for the breadcrumb — it reads the async `models` projection, so once
  // it shows, the dashboard list (a fresh fetch after goto) will include the
  // model too.
  await expect(page.getByTestId('workspace-breadcrumb')).toHaveText('Budgeting')

  await page.goto('/')
  const row = page.getByTestId(`model-row-${modelId}`)
  await expect(row).toBeVisible()
  await expect(row.getByTestId('model-name')).toHaveText('Budgeting')

  // Rename.
  await page.getByTestId(`model-rename-${modelId}`).click()
  await page.getByTestId('rename-model-name').fill('Budgeting 2027')
  await page.getByTestId('rename-model-submit').click()
  await expect(row.getByTestId('model-name')).toHaveText('Budgeting 2027')

  // Export — a client-side download of the O1 export JSON.
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId(`model-export-${modelId}`).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('.event-model.json')
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  expect(exported.schemaVersion).toBe(1)
  expect(exported.model.name).toBe('Budgeting 2027')
  expect(Array.isArray(exported.entities)).toBe(true)

  // Archive — confirm dialog, row disappears.
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId(`model-archive-${modelId}`).click()
  await expect(row).toHaveCount(0)
})
