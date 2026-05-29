/** Format price based on country code */
export function fmtPrice(n: number | null | undefined, country?: string): string {
  if (!n || n === 0) return "—"
  const cfg: Record<string, { locale: string; currency: string }> = {
    MX: { locale: "es-MX", currency: "MXN" },
    CO: { locale: "es-CO", currency: "COP" },
    PE: { locale: "es-PE", currency: "PEN" },
  }
  const { locale, currency } = cfg[country || "MX"] || cfg.MX
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
}

/** Fixed colors per retailer — visually distinct */
export const RETAIL_COLORS: Record<string, string> = {
  "AMAZON":              "#FF9900",
  "FARMACIA DEL AHORRO": "#00A650",
  "FARMACIA SAN PABLO":  "#B91C5C",
  "WALMART":             "#0071CE",
  "SAMS CLUB":           "#1B3A6B",
  "MERCADO LIBRE":       "#D4A017",
  "BENAVIDES":           "#E30613",
  "HEB":                 "#7B2D8B",
  "INKAFARMA":           "#0EA5E9",
  "MIFARMA":             "#E4002B",
  "TOTTUS":              "#15803D",
  "CRUZ VERDE":          "#059669",
  "FARMATODO":           "#2563EB",
  "RAPPI":               "#FF441F",
  "DROGUERIA VIRTUAL":   "#6366F1",
  "REBAJA VIRTUAL":      "#EA580C",
}

/** Get color for a retailer, falling back to a wide palette */
const FALLBACK_PALETTE = [
  "#003DA5","#E91E63","#00BCD4","#FF9800","#8BC34A",
  "#9C27B0","#009688","#F44336","#3F51B5","#CDDC39",
  "#795548","#607D8B","#FF5722","#4CAF50","#2196F3",
  "#FFC107","#673AB7","#00ACC1","#D81B60","#7CB342",
]

export function getRetailColor(retail: string, index?: number): string {
  return RETAIL_COLORS[retail?.toUpperCase()] || FALLBACK_PALETTE[(index || 0) % FALLBACK_PALETTE.length]
}
