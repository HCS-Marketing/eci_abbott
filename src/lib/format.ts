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

/** Fixed colors per retailer */
export const RETAIL_COLORS: Record<string, string> = {
  "AMAZON":              "#FF9900",
  "FARMACIA DEL AHORRO": "#00A650",
  "FARMACIA SAN PABLO":  "#E31837",
  "WALMART":             "#0071CE",
  "SAMS CLUB":           "#0060A9",
  "MERCADO LIBRE":       "#FFE600",
  "BENAVIDES":           "#E30613",
  "HEB":                 "#EE2E24",
  "INKAFARMA":           "#00A651",
  "MIFARMA":             "#E4002B",
  "TOTTUS":              "#008C45",
  "CRUZ VERDE":          "#00963F",
  "FARMATODO":           "#0072BC",
  "RAPPI":               "#FF441F",
  "DROGUERIA VIRTUAL":   "#4A90D9",
  "REBAJA VIRTUAL":      "#FF6B00",
}

/** Get color for a retailer, falling back to a palette */
const FALLBACK_PALETTE = ["#003DA5","#00A3E0","#ef4444","#f59e0b","#06b6d4","#84cc16","#ec4899","#14b8a6","#f97316","#8b5cf6"]

export function getRetailColor(retail: string, index?: number): string {
  return RETAIL_COLORS[retail?.toUpperCase()] || FALLBACK_PALETTE[(index || 0) % FALLBACK_PALETTE.length]
}
