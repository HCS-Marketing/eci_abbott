"use client"
import PageHeader from "@/components/ui/PageHeader"
import { Zap, Trophy, Tag, TrendingUp } from "lucide-react"

const COLUMNS = [
  { field: "ID / SKU del producto",     example: "ej: id, item_id, sku",              status: "pendiente" },
  { field: "Título del producto",       example: "ej: producto, titulo",              status: "pendiente" },
  { field: "Seller / Vendedor",         example: "ej: seller, vendedor",              status: "pendiente" },
  { field: "Posición / Ranking",        example: "ej: ranking, posicion, rank",        status: "pendiente" },
  { field: "Precio actual",             example: "ej: precio, price",                 status: "pendiente" },
  { field: "Precio original / tachado", example: "ej: precio_original",              status: "pendiente" },
  { field: "Descuento %",               example: "ej: descuento, discount_pct",        status: "pendiente" },
  { field: "Tipo de listing",           example: "ej: listing_type, tipo_publicacion", status: "pendiente" },
  { field: "Envío gratis (flag)",       example: "ej: free_shipping, envio_gratis",   status: "pendiente" },
  { field: "Condición (nuevo/usado)",   example: "ej: condition, condicion",          status: "pendiente" },
  { field: "Ciudad / Región",           example: "ej: ciudad, state, region",         status: "pendiente" },
  { field: "Es oficial (flag)",         example: "ej: is_official, tienda_oficial",   status: "pendiente" },
  { field: "Canal / Plataforma",        example: "ej: plataforma, canal",             status: "pendiente" },
  { field: "Categoría",                example: "ej: subcategoria, categoria",        status: "pendiente" },
  { field: "Fecha",                    example: "ej: fecha, date",                   status: "pendiente" },
]

export default function BuyboxPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="BuyBox"
        subtitle="Quién gana la posición destacada por producto — análisis de sellers, dispersión de precios y listing types"
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
              { seller: "Seller 1", pos: 1, price: "$420.000", type: "Premium", official: true,  color: "#f59e0b" },
              { seller: "Seller 2", pos: 2, price: "$439.000", type: "Pro",     official: false, color: "#8b5cf6" },
              { seller: "Seller 3", pos: 3, price: "$455.000", type: "Clásico", official: false, color: "#3b82f6" },
            ].map(p => (
              <div key={p.seller} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <span className="w-6 h-6 rounded-lg bg-yellow-100 text-yellow-700 text-xs font-black flex items-center justify-center flex-shrink-0">#{p.pos}</span>
                {p.pos === 1 && <Trophy size={11} className="text-yellow-500 flex-shrink-0" />}
                <div className="flex-1">
                  <div className="text-xs font-semibold text-gray-700">{p.seller}</div>
                  <div className="text-[10px] text-gray-400">{p.official ? "Tienda oficial" : "Seller independiente"}</div>
                </div>
                <span className="text-xs font-black text-gray-900">{p.price}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: p.color + "20", color: p.color, borderColor: p.color + "40" }}>{p.type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {[
            { icon: Trophy,     label: "Ganador BuyBox actual",  value: "—", color: "#d97706" },
            { icon: Tag,        label: "Dispersión de precios",  value: "—", color: "#7c3aed" },
            { icon: Zap,        label: "Con envío gratis",       value: "—", color: "#16a34a" },
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
