export type PerfectStoreClassification = "Perfect Store" | "PDP completa" | "PDP por optimizar" | "PDP incompleta"

export interface PerfectStoreScoreInput {
  marca: string
  titulo: string
  description: string
  img_count: number
}

export interface PerfectStoreScore {
  imageScore: number
  titleScore: number
  descriptionScore: number
  total: number
  classification: PerfectStoreClassification
}

const BRAND_CATEGORY_KEYWORDS: Record<string, string[]> = {
  SIMILAC: ["formula infantil", "etapa"],
  ENSURE: ["con proteina"],
  PEDIASURE: ["formula", "nutricional", "ninos", "complemento", "adolescentes"],
  PEDIALYTE: ["suero rehidratante"],
  GLUCERNA: ["formula para diabetes"],
}

const BENEFIT_GROUPS: Record<string, string[][]> = {
  SIMILAC: [["alimento lacteo", "ninos desde los 2 anos"], ["facil digestion"], ["hmo", "oligosacaridos"]],
  ENSURE: [["hmb"], ["proteina", "musculo"], ["28 vitaminas", "vitaminas y minerales"]],
  PEDIASURE: [["proteina"], ["carbohidrato"], ["vitamina"], ["mineral"], ["lipido"], ["fosfopeptido", "caseina"]],
  GLUCERNA: [["11 g de proteina", "proteina"], ["8,8 g de fibra", "fibra"], ["m-inositol", "inositol"], ["metabolismo"], ["glucosa"], ["sensibilidad a la insulina"]],
}

const PRESENTATION_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:mg|g|gr|gramos?|kg|ml|mililitros?|l|litros?|oz|lb|unidades?|uds?|capsulas?|tabletas?|sobres?|latas?|botellas?|cajas?|packs?)\b/i
const VARIANT_PATTERN = /\b(?:vainilla|chocolate|fresa|cafe|frut(?:a|os)|coco|manzana|uva|naranja|mandarina|limon|maracuya|natural|sin sabor|polvo|liquido|listo para tomar|etapa\s*\d+|advance|plus|max|triple zero|slim|active|en lata|en botella|en sobre)\b/i
const USE_OR_AUDIENCE_PATTERN = /\b(?:modo de uso|preparacion|preparar|consumir|tomar|porcion|dosis|uso diario|ninos?|adolescentes?|adultos?|diabetes|deportistas?|pacientes?|mayores de|desde los)\b/i

export function normalizePerfectStoreText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.,+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function includesAny(text: string, values: string[]): boolean {
  return values.some(value => text.includes(value))
}

function imageScore(marca: string, imageCount: number): number {
  const count = Math.max(0, Math.floor(Number(imageCount) || 0))
  if (normalizePerfectStoreText(marca) === "pedialyte" && count >= 1) return 25
  return Math.min(count, 5) * 5
}

function titleScore(marca: string, titulo: string): number {
  const brand = normalizePerfectStoreText(marca).toUpperCase()
  const title = normalizePerfectStoreText(titulo)
  if (!title) return 0

  const hasBrand = brand ? title.includes(brand.toLowerCase()) : false
  const hasPresentation = PRESENTATION_PATTERN.test(title)
  const hasVariant = VARIANT_PATTERN.test(title)
  const categoryKeywords = BRAND_CATEGORY_KEYWORDS[brand] || []
  const hasCategoryKeyword = includesAny(title, categoryKeywords)

  return (hasBrand ? 5 : 0) + 10 + (hasPresentation ? 5 : 0) + (hasVariant ? 5 : 0) + (hasCategoryKeyword ? 15 : 0)
}

function descriptionScore(marca: string, description: string): number {
  const brand = normalizePerfectStoreText(marca).toUpperCase()
  const text = normalizePerfectStoreText(description)
  if (!text) return 0

  const hasBrand = brand ? text.includes(brand.toLowerCase()) : false
  const benefitCount = brand === "PEDIALYTE"
    ? 2
    : (BENEFIT_GROUPS[brand] || []).filter(group => includesAny(text, group)).length
  const hasPresentationUseOrAudience = PRESENTATION_PATTERN.test(text) || USE_OR_AUDIENCE_PATTERN.test(text)

  return 5 + (hasBrand ? 10 : 0) + (benefitCount >= 2 ? 15 : 0) + (hasPresentationUseOrAudience ? 5 : 0)
}

export function classifyPerfectStoreScore(total: number): PerfectStoreClassification {
  if (total >= 90) return "Perfect Store"
  if (total >= 75) return "PDP completa"
  if (total >= 60) return "PDP por optimizar"
  return "PDP incompleta"
}

export function calculatePerfectStoreScore(input: PerfectStoreScoreInput): PerfectStoreScore {
  const images = imageScore(input.marca, input.img_count)
  const title = titleScore(input.marca, input.titulo)
  const description = descriptionScore(input.marca, input.description)
  const total = images + title + description

  return {
    imageScore: images,
    titleScore: title,
    descriptionScore: description,
    total,
    classification: classifyPerfectStoreScore(total),
  }
}