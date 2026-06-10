// Client-side file download (the W2/W3 Export button). Blob + anchor click —
// no server round-trip beyond the export GET itself.

/**
 * @param {string} filename e.g. 'budgeting.event-model.json'
 * @param {unknown} data JSON-serializable payload
 */
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
