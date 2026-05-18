"use client"
import PageHeader from "@/components/ui/PageHeader"
import { Package, AlertTriangle, CheckCircle, DollarSign } from "lucide-react"

const COLUMNS = [
  { field: "ID / SKU del producto",      example: "ej: id, item_id, sku",                  status: "pendiente" },
  { field: "Título del producto",        example: "ej: producto, titulo",                  status: "pendiente" },
  { field: "Disponibilidad / Stock",     example: "ej: stock, disponible, available, qty", status: "pendiente" },
  { field: "Seller / Retailer",          example: "ej: seller, vendedor, retailer",         status: "pendiente" },
  { field: "Marca / Brand",              example: "ej: marca, brand",                       status: "pendiente" },
  { field: "Categoría",                 example: "ej: subcategoria, categoria",             status: "pendiente" },
  { field: "Canal / Plataforma",         example: "ej: plataforma, canal",                  status: "pendiente" },
  { field: "Precio",                    example: "ej: precio, price",                      status: "pendiente" },
  { field: "Fecha",                     example: "ej: fecha, date",                        status: "pendiente" },
  { field: "Es propio / competitor flag", example: "ej: is_me, es_propio, my_brand",      status: "pendiente" },
]

const RETAILERS = ["Seller A", "Seller B", "Seller C", "Seller D", "Seller E"]
const CATEGORIES = ["Categoría 1", "Categoría 2", "Categoría 3"]

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        subtitle="Disponibilidad de productos por retailer y categoría — OOS críticos, revenue en riesgo y días de reposición"
      />

      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">En construcción</span>
        <span className="text-xs text-amber-700">Indicá qué columnas de tu DB corresponden a cada campo para activar este módulo.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tabla de disponibilidad */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm opacity-40 pointer-events-none overflow-x-auto">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Vista previa — disponibilidad %</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-1.5 text-gray-500 font-semibold text-[10px] pr-3">Retailer</th>
                {CATEGORIES.map(c => (
                  <th key={c} className="text-center py-1.5 text-gray-500 font-semibold text-[10px] px-2">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {RETAILERS.map((ret, ri) => (
                <tr key={ret}>
                  <td className="py-2 pr-3 font-semibold text-gray-700 text-[11px]">{ret}</td>
                  {CATEGORIES.map((_, ci) => {
                    const v = 60 + ((ri * 3 + ci * 7) % 35)
                    const color = v >= 90 ? "#16a34a" : v >= 70 ? "#d97706" : "#dc2626"
                    return (
                      <td key={ci} className="py-2 px-2 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ backgroundColor: color + "15", color, borderColor: color + "40" }}>{v}%</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          {[
            { icon: Package,       label: "SKUs con quiebre",        value: "—", color: "#dc2626" },
            { icon: DollarSign,    label: "Revenue en riesgo",       value: "—", color: "#d97706" },
            { icon: CheckCircle,   label: "Disponibilidad promedio", value: "—", color: "#16a34a" },
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
