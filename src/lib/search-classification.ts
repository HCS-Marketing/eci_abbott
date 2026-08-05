/**
 * Search Term Classification
 * Mapea términos de búsqueda (search) a:
 * - Tipo: BRANDED o GENERIC
 * - Marca: ENSURE, ENSURE ADVANCE, ENSURE PROSURE, etc.
 */

export type SearchType = "BRANDED" | "GENERIC"

export interface SearchClassification {
  search: string
  type: SearchType
  brand: string
}

// Mapeo de términos de búsqueda → clasificación
// Patrón: BRANDED son términos que mencionan marcas específicas
// GENERIC son búsquedas por categoría/beneficio genérico
export const SEARCH_CLASSIFICATIONS: SearchClassification[] = [
  // ── ENSURE (BRANDED) ──
  { search: "ensure", type: "BRANDED", brand: "ENSURE" },
  { search: "ensure original", type: "BRANDED", brand: "ENSURE" },
  { search: "ensure classic", type: "BRANDED", brand: "ENSURE" },
  { search: "ensure chocolate", type: "BRANDED", brand: "ENSURE" },
  { search: "ensure vainilla", type: "BRANDED", brand: "ENSURE" },
  { search: "ensure fresa", type: "BRANDED", brand: "ENSURE" },
  
  // ── ENSURE ADVANCE (BRANDED) ──
  { search: "ensure advance", type: "BRANDED", brand: "ENSURE ADVANCE" },
  { search: "ensure advance chocolate", type: "BRANDED", brand: "ENSURE ADVANCE" },
  { search: "ensure advance vainilla", type: "BRANDED", brand: "ENSURE ADVANCE" },
  { search: "ensure advance fresa", type: "BRANDED", brand: "ENSURE ADVANCE" },
  
  // ── ENSURE PROSURE (BRANDED) ──
  { search: "ensure prosure", type: "BRANDED", brand: "ENSURE PROSURE" },
  { search: "ensure prosure chocolate", type: "BRANDED", brand: "ENSURE PROSURE" },
  { search: "ensure prosure vainilla", type: "BRANDED", brand: "ENSURE PROSURE" },
  { search: "ensure prosure fresa", type: "BRANDED", brand: "ENSURE PROSURE" },
  
  // ── GENERIC (sin marca específica) ──
  { search: "nutricion", type: "GENERIC", brand: "N/A" },
  { search: "suplemento nutricional", type: "GENERIC", brand: "N/A" },
  { search: "proteina", type: "GENERIC", brand: "N/A" },
  { search: "bebida nutricional", type: "GENERIC", brand: "N/A" },
  { search: "collagen", type: "GENERIC", brand: "N/A" },
  { search: "vitaminas", type: "GENERIC", brand: "N/A" },
  { search: "mineral", type: "GENERIC", brand: "N/A" },
  { search: "energia", type: "GENERIC", brand: "N/A" },
  { search: "recuperacion", type: "GENERIC", brand: "N/A" },
  { search: "huesos", type: "GENERIC", brand: "N/A" },
]

/**
 * Clasifica un término de búsqueda
 * Si no se encuentra, devuelve GENERIC sin marca
 */
export function classifySearch(searchTerm: string): SearchClassification {
  const normalized = (searchTerm || "").toLowerCase().trim()
  
  // Busca coincidencia exacta o parcial
  const found = SEARCH_CLASSIFICATIONS.find(
    c => c.search === normalized || normalized.includes(c.search)
  )
  
  return found || { search: normalized, type: "GENERIC", brand: "N/A" }
}

/**
 * Obtiene todas las marcas únicas
 */
export function getAllBrands(): string[] {
  const brands = new Set(SEARCH_CLASSIFICATIONS.map(c => c.brand))
  return Array.from(brands).sort()
}

/**
 * Obtiene los tipos únicos
 */
export function getSearchTypes(): SearchType[] {
  return ["BRANDED", "GENERIC"]
}

/**
 * Filtra search terms por tipo
 */
export function filterByType(type: SearchType): SearchClassification[] {
  return SEARCH_CLASSIFICATIONS.filter(c => c.type === type)
}

/**
 * Filtra search terms por marca
 */
export function filterByBrand(brand: string): SearchClassification[] {
  return SEARCH_CLASSIFICATIONS.filter(c => c.brand === brand)
}

/**
 * Filtra search terms por tipo y marca
 */
export function filterByTypeAndBrand(type: SearchType, brand: string): SearchClassification[] {
  return SEARCH_CLASSIFICATIONS.filter(c => c.type === type && c.brand === brand)
}
