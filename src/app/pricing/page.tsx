"use client"
import PageHeader from "@/components/ui/PageHeader"
import { Tag, TrendingUp, TrendingDown, BarChart2 } from "lucide-react"

const COLUMNS = [
  { field: "ID / SKU del producto",   example: "ej: id, item_id, sku",                status: "pendiente" },
  { field: "Título del producto",     example: "ej: producto, titulo",                status: "pendiente" },
  { field: "Precio actual",           example: "ej: precio, price",                   status: "pendiente" },
  { field: "Precio original / tachado", example: "ej: precio_original, list_price",  status: "pendiente" },
  { field: "Descuento %",             example: "ej: descuento, discount_pct",          status: "pendiente" },
  { field: "Seller / Vendedor",       example: "ej: seller, vendedor",                status: "pendiente" },
  { field: "Canal / Plataforma",      example: "ej: plataforma, canal",               status: "pendiente" },
  { field: "Categoría",              example: "ej: subcategoria, categoria",          status: "pendiente" },
  { field: "Marca / Brand",          example: "ej: marca, brand",                    status: "pendiente" },
  { field: "Fecha",                  example: "ej: fecha, date",                     status: "pendiente" },
  { field: "Cuotas (cantidad)",      example: "ej: cuotas, installments",            status: "pendiente" },
  { field: "Envío gratis (flag)",    example: "ej: free_shipping, envio_gratis",     status: "pendiente" },
  { field: "Región / Ciudad",        example: "ej: region, ciudad, state",           status: "pendiente" },
]

export default function PricingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing Live"
        subtitle="Comparación de precios por seller y canal, dispersión de precios, análisis de cuotas y financiamiento"
      />

      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">En construcción</span>
        <span className="text-xs text-amber-700">Indicá qué columnas de tu DB corresponden a cada campo para activar este módulo.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Vista previa — datos de ejemplo</div>
          <div className="opacity-40 pointer-events-none space-y-2">
            {[
              { seller: "Seller 1", price: "$420.000", disc: "12%", cuotas: "12 sin interés", color: "#16a34a", diff: "-8%" },
              { seller: "Seller 2", price: "$455.000", disc: "5%",  cuotas: "6 sin interés",  color: "#6b7280", diff: "0%" },
              { seller: "Seller 3", price: "$489.000", disc: "0%",  cuotas: "3 sin interés",  color: "#dc2626", diff: "+7%" },
            ].map(p => (
              <div key={p.seller} className="flex items-center gap-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-700">{p.seller}</div>
                  <div className="text-[10px] text-gray-400">{p.cuotas}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-gray-900">{p.price}</div>
                  <div className="text-[10px] font-bold" style={{ color: p.color }}>{p.diff} vs promedio</div>
                </div>
                <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200 font-bold">{p.disc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {[
            { icon: Tag,         label: "Precio mínimo",       value: "—", color: "#16a34a" },
            { icon: BarChart2,   label: "Precio promedio",     value: "—", color: "#7c3aed" },
            { icon: TrendingUp,  label: "Dispersión de precios", value: "—", color: "#d97706" },
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
