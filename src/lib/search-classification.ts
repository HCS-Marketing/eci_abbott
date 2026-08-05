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

// Real Mexico search terms data
// BRANDED: 20 productos principales
// GENERIC: 51 búsquedas genéricas sin marca
export const SEARCH_CLASSIFICATIONS: SearchClassification[] = [
  // ── BRANDED PRODUCTS (20) ──
  { search: "ENSURE", type: "BRANDED", brand: "ENSURE" },
  { search: "ENSURE ADVANCE", type: "BRANDED", brand: "ENSURE ADVANCE" },
  { search: "ENSURE ORIGINAL", type: "BRANDED", brand: "ENSURE ORIGINAL" },
  { search: "ENSURE PRO-CARE", type: "BRANDED", brand: "ENSURE PRO-CARE" },
  { search: "ENSURE PROCARE", type: "BRANDED", brand: "ENSURE PRO-CARE" },
  { search: "PEDIASURE", type: "BRANDED", brand: "PEDIASURE" },
  { search: "PEDIASURE ORIGINAL", type: "BRANDED", brand: "PEDIASURE" },
  { search: "GLUCERNA", type: "BRANDED", brand: "GLUCERNA" },
  { search: "GLUCERNA ORIGINAL", type: "BRANDED", brand: "GLUCERNA" },
  { search: "PROSURE", type: "BRANDED", brand: "PROSURE" },
  { search: "PEDIALYTE", type: "BRANDED", brand: "PEDIALYTE" },
  { search: "PEDIALITE", type: "BRANDED", brand: "PEDIALYTE" },
  { search: "NEPRO HP", type: "BRANDED", brand: "NEPRO HP" },
  { search: "NEPRO LP", type: "BRANDED", brand: "NEPRO LP" },
  { search: "NEPRO PARA DIÁLISIS", type: "BRANDED", brand: "NEPRO HP" },
  { search: "NEPRO RENAL LP", type: "BRANDED", brand: "NEPRO LP" },
  { search: "SIMILAC", type: "BRANDED", brand: "SIMILAC" },
  { search: "FORMULA SIMILAC", type: "BRANDED", brand: "SIMILAC" },
  { search: "ALITRAQ", type: "BRANDED", brand: "ALITRAQ" },
  { search: "PULMOCARE", type: "BRANDED", brand: "PULMOCARE" },

  // ── GENERIC SEARCH TERMS (51) ──
  { search: "SUPLEMENTO NUTRICIONAL ADULTOS", type: "GENERIC", brand: "N/A" },
  { search: "NUTRICIÓN PARA PACIENTES CON CÁNCER", type: "GENERIC", brand: "N/A" },
  { search: "PROTEÍNA PARA ADULTOS MAYORES", type: "GENERIC", brand: "N/A" },
  { search: "NUTRICIÓN ESPECIALIZADA INFANTIL", type: "GENERIC", brand: "N/A" },
  { search: "SUPLEMENTO PARA DIABETES", type: "GENERIC", brand: "N/A" },
  { search: "BEBIDAS ELECTROLÍTICAS", type: "GENERIC", brand: "N/A" },
  { search: "SUPLEMENTO PARA INSUFICIENCIA RENAL", type: "GENERIC", brand: "N/A" },
  { search: "FÓRMULA INFANTIL", type: "GENERIC", brand: "N/A" },
  { search: "SUPLEMENTO CON GLUTAMINA", type: "GENERIC", brand: "N/A" },
  { search: "ENFERMEDAD PULMONAR", type: "GENERIC", brand: "N/A" },
  { search: "SUPLEMENTO PARA CÁNCER", type: "GENERIC", brand: "N/A" },
  { search: "NUTRICIÓN PARA ADULTOS", type: "GENERIC", brand: "N/A" },
  { search: "COMPLEMENTO ALIMENTICIO NIÑOS", type: "GENERIC", brand: "N/A" },
  { search: "BEBIDA PARA DIABÉTICOS", type: "GENERIC", brand: "N/A" },
  { search: "BEBIDA HIDRATANTE CON ELECTROLITOS", type: "GENERIC", brand: "N/A" },
  { search: "NUTRICIÓN PARA PACIENTES RENALES", type: "GENERIC", brand: "N/A" },
  { search: "NUTRICIÓN PARA ENFERMEDAD RENAL CRÓNICA", type: "GENERIC", brand: "N/A" },
  { search: "LECHE DE FÓRMULA", type: "GENERIC", brand: "N/A" },
  { search: "NUTRICIÓN ENTERAL", type: "GENERIC", brand: "N/A" },
  { search: "INSUFICIENCIA RESPIRATORIA", type: "GENERIC", brand: "N/A" },
  { search: "BEBIDA NUTRICIONAL", type: "GENERIC", brand: "N/A" },
  { search: "ALIMENTO PARA PACIENTES ONCOLÓGICOS", type: "GENERIC", brand: "N/A" },
  { search: "SUPLEMENTO NUTRICIONAL PARA ADULTOS", type: "GENERIC", brand: "N/A" },
  { search: "CALCIO PARA NIÑOS", type: "GENERIC", brand: "N/A" },
  { search: "SUPLEMENTO NUTRICIONAL CLÍNICO", type: "GENERIC", brand: "N/A" },
  { search: "SOLUCIÓN DE REHIDRATACIÓN ORAL", type: "GENERIC", brand: "N/A" },
  { search: "FÓRMULA PARA ENFERMEDAD RENAL CRÓNICA", type: "GENERIC", brand: "N/A" },
  { search: "ALIMENTO PARA PACIENTES RENALES", type: "GENERIC", brand: "N/A" },
  { search: "ALIMENTACIÓN PARA BEBÉS", type: "GENERIC", brand: "N/A" },
  { search: "ALIMENTACIÓN ENTERAL", type: "GENERIC", brand: "N/A" },
  { search: "NUTRICIÓN PULMONAR", type: "GENERIC", brand: "N/A" },
  { search: "SUPLEMENTO ALIMENTICIO", type: "GENERIC", brand: "N/A" },
  { search: "NUTRICIÓN ONCOLÓGICA", type: "GENERIC", brand: "N/A" },
  { search: "SALUD CARDIOVASCULAR", type: "GENERIC", brand: "N/A" },
  { search: "VITAMINAS PARA NIÑOS", type: "GENERIC", brand: "N/A" },
  { search: "PROTEÍNA PARA DIABÉTICOS", type: "GENERIC", brand: "N/A" },
  { search: "SUERO ORAL", type: "GENERIC", brand: "N/A" },
  { search: "ALIMENTACIÓN PARA DIÁLISIS", type: "GENERIC", brand: "N/A" },
  { search: "FÓRMULA RENAL BAJA EN PROTEÍNA", type: "GENERIC", brand: "N/A" },
  { search: "FÓRMULA PARA BEBÉS", type: "GENERIC", brand: "N/A" },
  { search: "FÓRMULA ENTERAL", type: "GENERIC", brand: "N/A" },
  { search: "SUPLEMENTO PARA ADULTOS MAYORES", type: "GENERIC", brand: "N/A" },
  { search: "SUPLEMENTO PARA QUIMIOTERAPIA", type: "GENERIC", brand: "N/A" },
  { search: "BEBIDA NUTRICIONAL PARA ADULTOS MAYORES", type: "GENERIC", brand: "N/A" },
  { search: "PROTEÍNA PARA NIÑOS", type: "GENERIC", brand: "N/A" },
  { search: "BATIDOS PARA DIABÉTICOS", type: "GENERIC", brand: "N/A" },
  { search: "SUERO PARA DESHIDRATACIÓN", type: "GENERIC", brand: "N/A" },
  { search: "PROTEÍNA PARA PACIENTES EN DIÁLISIS", type: "GENERIC", brand: "N/A" },
  { search: "ALIMENTACIÓN PARA CUIDADO RENAL", type: "GENERIC", brand: "N/A" },
]

/**
 * Clasifica un término de búsqueda
 * Si no se encuentra, devuelve GENERIC sin marca
 * Búsqueda case-insensitive
 */
export function classifySearch(searchTerm: string): SearchClassification {
  const normalized = (searchTerm || "").toUpperCase().trim()
  
  // Busca coincidencia exacta
  const found = SEARCH_CLASSIFICATIONS.find(
    c => c.search.toUpperCase() === normalized
  )
  
  if (found) return found
  
  // Si no hay exacta, busca coincidencia parcial
  const partial = SEARCH_CLASSIFICATIONS.find(
    c => normalized.includes(c.search.toUpperCase()) || c.search.toUpperCase().includes(normalized)
  )
  
  return partial || { search: normalized, type: "GENERIC", brand: "N/A" }
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
