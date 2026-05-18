"use client"
import PageHeader from "@/components/ui/PageHeader"
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"

const COLUMNS = [
  { field: "ID / SKU del producto",     example: "ej: id, item_id, sku",              status: "pendiente" },
  { field: "Título del producto",       example: "ej: producto, titulo",              status: "pendiente" },
  { field: "Precio actual",             example: "ej: precio, price",                 status: "pendiente" },
  { field: "Precio base / referencia",  example: "ej: precio_base, base_price",       status: "pendiente" },
  { field: "Seller / Retailer",         example: "ej: seller, vendedor, retailer",    status: "pendiente" },
  { field: "Marca / Brand",             example: "ej: marca, brand",                  status: "pendiente" },
  { field: "Categoría",                example: "ej: subcategoria, categoria",        status: "pendiente" },
  { field: "Canal / Plataforma",        example: "ej: plataforma, canal",             status: "pendiente" },
  { field: "Fecha",                    example: "ej: fecha, date",                   status: "pendiente" },
  { field: "Es propio / competitor flag", example: "ej: is_me, es_propio, my_brand", status: "pendiente" },
  { field: "Cuotas / financiamiento",  example: "ej: cuotas, installments",          status: "pendiente" },
]

const CATS = ["Cat. A", "Cat. B", "Cat. C", "Cat. D"]

export default function PriceIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Price Index"
        subtitle="Índice de precios propio vs mercado por categoría — alertas de productos caros, tendencia semanal y análisis con financiamiento"
      />

      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">En construcción</span>
        <span className="text-xs text-amber-700">Indicá qué columnas de tu DB corresponden a cada campo para activar este módulo.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm opacity-40 pointer-events-none">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Vista previa — índice por categoría</div>
          <div className="space-y-3">
            {CATS.map((cat, i) => {
              const idx = [98, 103, 95, 107][i]
              const color = idx <= 100 ? "#16a34a" : "#dc2626"
              return (
                <div key={cat} className="flex items-center gap-4">
                  <div className="text-xs font-medium text-gray-700 w-20 flex-shrink-0">{cat}</div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: Math.min(100, idx) + "%", backgroundColor: color }} />
                  </div>
                  <span className="text-xs font-black font-mono w-12 text-right" style={{ color }}>{idx}</span>
                  {idx > 100
                    ? <TrendingUp size={12} style={{ color }} className="flex-shrink-0" />
                    : <TrendingDown size={12} style={{ color }} className="flex-shrink-0" />
                  }
                </div>
              )
            })}
          </div>
          <div className="mt-4 text-[10px] text-gray-400">Índice 100 = paridad con mercado. &gt;100 = más caro. &lt;100 = más barato.</div>
        </div>

        <div className="space-y-3">
          {[
            { icon: BarChart2,    label: "Índice global propio",      value: "—", color: "#7c3aed" },
            { icon: TrendingUp,   label: "Categorías más caras",      value: "—", color: "#dc2626" },
            { icon: AlertTriangle, label: "Alertas precio +5%",       value: "—", color: "#d97706" },
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
