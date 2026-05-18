"use client"
import PageHeader from "@/components/ui/PageHeader"
import { MessageSquare, TrendingUp, TrendingDown, Heart } from "lucide-react"

const COLUMNS = [
  { field: "ID producto / URL",        example: "ej: item_id, product_id, url",       status: "pendiente" },
  { field: "Título del producto",      example: "ej: producto, titulo",               status: "pendiente" },
  { field: "Texto de la reseña",       example: "ej: review_text, contenido",         status: "pendiente" },
  { field: "Puntaje / Rating (1-5)",   example: "ej: rating, stars, puntaje",         status: "pendiente" },
  { field: "Fecha de la reseña",       example: "ej: fecha, review_date",             status: "pendiente" },
  { field: "Marca / Brand",            example: "ej: marca, brand",                   status: "pendiente" },
  { field: "Seller / Vendedor",        example: "ej: seller, vendedor",               status: "pendiente" },
  { field: "Canal / Plataforma",       example: "ej: plataforma, canal",              status: "pendiente" },
  { field: "Categoría",               example: "ej: subcategoria, categoria",         status: "pendiente" },
  { field: "Título de la reseña",     example: "ej: review_title, titulo_reseña",    status: "pendiente" },
  { field: "Likes / Votos útiles",    example: "ej: likes, helpful_votes",           status: "pendiente" },
]

export default function BrandSentimentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand Sentiment"
        subtitle="Análisis de sentimiento de reseñas por marca, temas positivos/negativos, NPS estimado y comparativa vs competidores"
      />

      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">En construcción</span>
        <span className="text-xs text-amber-700">Indicá qué columnas de tu DB corresponden a cada campo para activar este módulo.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm opacity-40 pointer-events-none">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Vista previa — gauge + temas</div>
          <div className="flex gap-6">
            {/* Gauge placeholder */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full border-4 border-purple-200 flex items-center justify-center">
                <span className="text-xl font-black text-gray-300">72</span>
              </div>
              <div className="text-[10px] text-gray-400">Score sentiment</div>
            </div>
            {/* Temas */}
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-bold text-green-600 mb-1">✓ Positivo</div>
                {["Buena calidad", "Entrega rápida", "Fácil instalación"].map(t => (
                  <div key={t} className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full mb-1 inline-block mr-1 border border-green-100">{t}</div>
                ))}
              </div>
              <div>
                <div className="text-[10px] font-bold text-red-500 mb-1">✗ Negativo</div>
                {["Precio alto", "Soporte lento"].map(t => (
                  <div key={t} className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full mb-1 inline-block mr-1 border border-red-100">{t}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { icon: Heart,        label: "NPS estimado",         value: "—", color: "#7c3aed" },
            { icon: TrendingUp,   label: "Temas positivos",      value: "—", color: "#16a34a" },
            { icon: TrendingDown, label: "Alertas detectadas",   value: "—", color: "#dc2626" },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm opacity-50">
              <div className="flex items-center gap-2 mb-2">
                <k.icon size={13} style={{ color: k.color }} />
                <div className="text-[10px] uppercase tracking-wider text-gray-400">{k.label}</div>
              </div>
              <div className="text-2xl font-bold text-gray-300">{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-700">Columnas necesarias — indicá el nombre exacto en tu DB</div>
          <span className="text-[10px] text-gray-400">{COLUMNS.length} campos</span>
        </div>
        <div className="divide-y divide-gray-50">
          {COLUMNS.map(c => (
            <div key={c.field} className="flex items-center gap-4 px-5 py-2.5">
              <div className="w-3 h-3 rounded-full bg-amber-200 border border-amber-400 flex-shrink-0" />
              <div className="flex-1 text-xs font-medium text-gray-700">{c.field}</div>
              <div className="text-[10px] text-gray-400 font-mono">{c.example}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
