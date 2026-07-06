export function toIsoDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseIsoDateUTC(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function getDefaultLast7DayRange(bounds: { min?: string; max?: string }): { start: string; end: string } {
  const min = bounds.min || ""
  const max = bounds.max || ""
  const maxDate = parseIsoDateUTC(max)
  const minDate = parseIsoDateUTC(min)
  if (!maxDate) return { start: "", end: "" }

  // Business rule: default starts 7 days before latest update day.
  const startDate = new Date(maxDate)
  startDate.setUTCDate(startDate.getUTCDate() - 7)

  if (minDate && startDate < minDate) {
    return { start: toIsoDateUTC(minDate), end: max }
  }
  return { start: toIsoDateUTC(startDate), end: max }
}
