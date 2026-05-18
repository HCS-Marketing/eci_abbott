"use client"
import PageHeader from "@/components/ui/PageHeader"
import { Star, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"

const COLUMNS = [
  { field: "ID producto / URL",         example: "ej: item_id, product_id, url",      status: "pendiente" },
  { field: "Título del producto",       example: "ej: producto, titulo",              status: "pendiente" },
  { field: "Texto de la reseña",        example: "ej: review_text, contenido",        status: "pendiente" },
  { field: "Puntaje / Rating (1-5)",    example: "ej: rating, stars, puntaje",        status: "pendiente" },
  { field: "Fecha de la reseña",        example: "ej: fecha, review_date",            status: "pendiente" },
  { field: "Título de la reseña",       example: "ej: review_title, titulo_reseña",  status: "pendiente" },
  { field: "Likes / Votos útiles",      example: "ej: likes, helpful_votes",          status: "pendiente" },
  { field: "Seller / Vendedor",         example: "ej: seller, vendedor",              status: "pendiente" },
  { field: "Marca / Brand",             example: "ej: marca, brand",                  status: "pendiente" },
  { field: "Categoría",                example: "ej: subcategoria, categoria",        status: "pendiente" },
  { field: "Canal / Plataforma",        example: "ej: plataforma, canal",             status: "pendiente" },
]

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        subtitle="Análisis de reseñas de productos — distribución de ratings, sentimiento, alertas automáticas y comparativa vs mercado"
      />

      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">En construcción</span>
        <span className="text-xs text-amber-700">Indicá qué columnas de tu DB corresponden a cada campo para activar este módulo.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm opacity-40 pointer-events-none">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Vista previa — distribución de ratings</div>
          <div className="space-y-1.5">
            {[
              { stars: 5, count: 142, pct: 58 },
              { stars: 4, count: 61,  pct: 25 },
              { stars: 3, count: 24,  pct: 10 },
              { stars: 2, count: 12,  pct: 5  },
              { stars: 1, count: 5,   pct: 2  },
            ].map(r => (
              <div key={r.stars} className="flex items-center gap-3">
                <div className="flex items-center gap-0.5 w-16 flex-shrink-0">
                  {Array.from({ length: r.stars }).map((_, i) => (
                    <Star key={i} size={9} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-300 rounded-full" style={{ width: r.pct + "%" }} />
                </div>
                <span className="text-[10px] text-gray-400 font-mono w-10 text-right">{r.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Star size={14} className="text-amber-400 fill-amber-400" />
            <span className="text-base font-black text-gray-700">4.4</span>
            <span className="text-xs text-gray-400">promedio · 244 reseñas</span>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { icon: Star,          label: "Rating promedio",         value: "—", color: "#d97706" },
            { icon: TrendingUp,    label: "Reseñas positivas (4-5★)", value: "—", color: "#16a34a" },
            { icon: AlertTriangle, label: "Alertas detectadas",       value: "—", color: "#dc2626" },
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
