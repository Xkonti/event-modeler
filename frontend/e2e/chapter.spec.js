// C1 chapter band: every slice shows the band row; "+ new chapter…" creates a
// chapter inline and assigns it (define → 422-retry assign); a second slice
// picks the existing chapter from the select; clearing returns to (no chapter).
import { test, expect } from '@playwright/test'
import { signup, createModelAndOpen, addSlice } from './_workspaceHelpers.js'

test('chapter band: inline create → assign, reuse on a second slice, clear', async ({ page }) => {
  await signup(page, 'chapter', test.info().workerIndex)
  await createModelAndOpen(page, 'Chaptered Flow')

  const sliceA = await addSlice(page)
  const sliceB = await addSlice(page)

  const selectA = page.getByTestId(`chapter-select-${sliceA}`)
  const selectB = page.getByTestId(`chapter-select-${sliceB}`)

  // Band renders on both slices, unassigned.
  await expect(page.getByTestId(`chapter-band-${sliceA}`)).toBeVisible()
  await expect(selectA).toHaveValue('')
  await expect(selectB).toHaveValue('')

  // Inline-create a chapter on slice A (prompt-driven, like slice rename).
  page.once('dialog', (dialog) => dialog.accept('Setup'))
  await selectA.selectOption('__new__')

  // The define + assign round-trips through the async projections.
  await expect(selectA.locator('option', { hasText: 'Setup' })).toHaveCount(1, {
    timeout: 15_000,
  })
  await expect
    .poll(
      async () => {
        const value = await selectA.inputValue()
        if (!value) return ''
        return selectA.locator(`option[value="${value}"]`).textContent()
      },
      { timeout: 15_000 },
    )
    .toContain('Setup')

  // Slice B reuses the existing chapter from the band select.
  const chapterValue = await selectA.inputValue()
  await selectB.selectOption(chapterValue)
  await expect.poll(() => selectB.inputValue(), { timeout: 15_000 }).toBe(chapterValue)

  // Clear slice A back to (no chapter).
  await selectA.selectOption('')
  await expect.poll(() => selectA.inputValue(), { timeout: 15_000 }).toBe('')
})
