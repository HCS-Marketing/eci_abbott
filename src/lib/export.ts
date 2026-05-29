/**
 * Export utilities for CSV download and PDF print.
 */

/** Download data as CSV */
export function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(","),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h]
        if (val == null) return ""
        const str = String(val)
        // Escape commas and quotes
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(",")
    ),
  ]
  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Print current page as PDF (triggers browser print dialog) */
export function exportPDF() {
  window.print()
}
