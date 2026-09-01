/**
 * Builds a CSV file and hands it to the browser as a download.
 *
 * Escaping matters more than it looks. A driver called O'Brien, an address with
 * a comma, or a note containing a line break will all corrupt the file if the
 * values are simply joined — the row count changes and columns shift. Every
 * value is therefore quoted, and inner quotes are doubled, per RFC 4180.
 *
 * A leading BOM is written so Excel opens the file as UTF-8; without it,
 * accented names arrive mangled, which is the single most common complaint
 * about exported reports.
 */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const row of rows) lines.push(row.map(escapeCell).join(','))
  return lines.join('\r\n')
}

/** Turns "Working hours audit" into "working-hours-audit-2026-08-31.csv". */
export function csvFilename(label: string, date: Date = new Date()): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const stamp = date.toISOString().slice(0, 10)
  return `${slug}-${stamp}.csv`
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Freed on the next tick — revoking immediately cancels the download in some
  // browsers before it has started reading the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  downloadBlob(
    filename,
    new Blob(['\uFEFF' + toCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' }),
  )
}

export function downloadText(filename: string, body: string) {
  downloadBlob(filename, new Blob([body], { type: 'text/plain;charset=utf-8' }))
}
