// CSV export helpers (same approach as the json-to-csv reference: RFC 4180
// escaping, UTF-8 BOM so Excel reads it correctly, Blob download).

export function escapeCsv(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

// columns: [{ key, label, csv?: (row) => value }]
export function toCsv(rows, columns) {
  const lines = [
    columns.map((c) => escapeCsv(c.label)).join(','),
    ...rows.map((row) => columns.map((c) => escapeCsv(c.csv ? c.csv(row) : row[c.key])).join(','))
  ]
  return '\uFEFF' + lines.join('\r\n')
}

export function downloadCsv(csvText, filename) {
  const url = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
