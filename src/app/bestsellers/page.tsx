"use client"
import PageHeader from "@/components/ui/PageHeader"
import { Trophy, Tag, Star, Truck, TrendingUp } from "lucide-react"

const COLUMNS = [
  { field: "Título del producto",     example: "ej: producto, titulo, description",  status: "pendiente" },
  { field: "Posición / Ranking",       example: "ej: ranking, posicion, rank",         status: "pendiente" },
  { field: "Seller / Vendedor",        example: "ej: seller, vendedor",                status: "pendiente" },
  { field: "Categoría",               example: "ej: subcategoria, categoria",          status: "pendiente" },
  { field: "Precio",                  example: "ej: precio, price",                   status: "pendiente" },
  { field: "Precio original / Tachado", example: "ej: precio_original",              status: "pendiente" },
  { field: "Descuento %",             example: "ej: descuento, discount_pct",          status: "pendiente" },
  { field: "Marca / Brand",           example: "ej: marca, brand",                    status: "pendiente" },
  { field: "Rating / Puntaje reseñas",example: "ej: rating, score_reseñas",           status: "pendiente" },
  { field: "Cantidad reseñas",        example: "ej: reviews, cantidad_reseñas",        status: "pendiente" },
  { field: "Envío gratis (flag)",     example: "ej: free_shipping, envio_gratis",     status: "pendiente" },
  { field: "Thumbnail / Imagen URL",  example: "ej: thumbnail, imagen_url",           status: "pendiente" },
  { field: "URL del producto",        example: "ej: permalink, url",                  status: "pendiente" },
  { field: "Canal / Plataforma",      example: "ej: plataforma, canal, channel",      status: "pendiente" },
  { field: "Fecha",                   example: "ej: fecha, date",                     status: "pendiente" },
]

export default function BestsellersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bestsellers"
        subtitle="Top productos por categoría ordenados por posición, con precio, descuento, rating y seller"
      />

      {/* Status banner */}
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">En construcción</span>
        <span className="text-xs text-amber-700">Indicá qué columnas de tu DB corresponden a cada campo para activar este módulo.</span>
      </div>

      {/* Preview de lo que mostrará */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Preview card */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Vista previa — datos de ejemplo</div>
          <div className="space-y-2 opacity-40 pointer-events-none">
            {[
              { rank: 1, title: "Producto A — Smart TV 55\" 4K UHD", seller: "Seller 1", price: "$450.000", disc: "15%", rating: 4.8, reviews: 312, badge: "bg-yellow-100 text-yellow-700" },
              { rank: 2, title: "Producto B — Heladera No Frost 400L",  seller: "Seller 2", price: "$380.000", disc: "10%", rating: 4.5, reviews: 187, badge: "bg-gray-100 text-gray-600" },
              { rank: 3, title: "Producto C — Lavarropas 8kg Inverter", seller: "Seller 3", price: "$290.000", disc: "8%",  rating: 4.3, reviews: 95,  badge: "bg-orange-100 text-orange-700" },
            ].map(p => (
              <div key={p.rank} className="flex items-center gap-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${p.badge}`}>#{p.rank}</div>
                <div className="w-12 h-12 bg-gray-200 rounded-xl flex-shrink-0 flex items-center justify-center text-gray-300 text-[10px]">img</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-700 truncate">{p.title}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-black text-gray-900">{p.price}</span>
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">-{p.disc}</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-gray-500"><Star size={9} className="text-amber-400 fill-amber-400" />{p.rating} ({p.reviews})</span>
                    <span className="text-[10px] text-gray-400">{p.seller}</span>
                  </div>
                </div>
                <Truck size={11} className="text-blue-400 flex-shrink-0" />
              </div>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-gray-400 text-center">Los datos reales se cargarán cuando se mapeen las columnas</div>
        </div>

        {/* KPIs preview */}
        <div className="space-y-3">
          {[
            { icon: Trophy, label: "Productos en Top 3", value: "—", color: "#d97706" },
            { icon: TrendingUp, label: "Mejor posición propia", value: "—", color: "#7c3aed" },
            { icon: Tag, label: "Descuento promedio top 10", value: "—", color: "#16a34a" },
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

      {/* Tabla de mapeo de columnas */}
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
