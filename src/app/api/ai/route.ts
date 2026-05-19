import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Read the guide once at module load (server-side only)
const GUIDE_PATH = path.join(process.cwd(), "market_seller_guide.txt")
let GUIDE = ""
try { GUIDE = fs.readFileSync(GUIDE_PATH, "utf-8").trim() } catch { /* guide optional */ }

const BASE_SYSTEM = `Eres un consultor senior de estrategia de e-commerce para el mercado latinoamericano, especializado en inteligencia competitiva para NEWSAN — fabricante y vendedor en marketplaces argentinos (MercadoLibre, Falabella, Fravega, etc.).

Tu rol es proporcionar análisis accionables y recomendaciones estratégicas basadas en los datos reales de la plataforma de inteligencia de Newsan.

Áreas de expertise:
- Share of Search, visibilidad orgánica y posicionamiento en góndola virtual
- Estrategia de pricing competitivo y análisis de dispersión de precios
- Optimización de Buy Box y gestión de sellers en MercadoLibre
- Cobertura de catálogo (Assortment) y detección de gaps vs competencia
- Gestión de inventario inferida por presencia/ausencia de productos
- Análisis de bestsellers y productos con mayor score de ranking
- Categorías: electrodomésticos, climatización, línea blanca, electrónica de consumo

Principios de respuesta:
- Respuestas estructuradas, basadas en los datos del contexto provisto
- Identificar la acción de mayor impacto y prioridad para Newsan
- Máximo 3-4 insights clave con recomendaciones específicas
- Tono profesional y ejecutivo, en español neutro
- Si no hay datos suficientes en el contexto, indicarlo y dar recomendaciones generales
- Evitar generalidades; cada recomendación debe ser específica y aplicable`

export async function POST(req: Request) {
  try {
    const { messages, pageContext } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[]
      pageContext?: string
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 503 })
    }

    // Build full system prompt
    const systemParts = [BASE_SYSTEM]
    if (GUIDE) systemParts.push(`\n\n---\nGUÍA DE REFERENCIA — GESTIÓN INTELIGENTE DEL VENDEDOR:\n${GUIDE}`)
    if (pageContext) systemParts.push(`\n\n---\nCONTEXTO ACTUAL DE DATOS (extraído de la base de datos en tiempo real):\n${pageContext}`)
    const system = systemParts.join("")

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system,
        messages,
      }),
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
