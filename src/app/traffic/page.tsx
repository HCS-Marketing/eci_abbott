"use client"
import PageHeader from "@/components/ui/PageHeader"
import { Activity, Globe, TrendingUp, BarChart2 } from "lucide-react"

const COLUMNS = [
  { field: "Canal / Plataforma",         example: "ej: canal, plataforma, channel",      status: "pendiente" },
  { field: "Visitas / Tráfico",           example: "ej: visitas, traffic, visits",        status: "pendiente" },
  { field: "Porcentaje del total (%)",    example: "ej: pct_total, share, porcentaje",    status: "pendiente" },
  { field: "Tipo de canal",              example: "ej: tipo_canal (marketplace/retailer/banco/marca)", status: "pendiente" },
  { field: "Fecha",                      example: "ej: fecha, date",                     status: "pendiente" },
  { field: "Categoría",                 example: "ej: subcategoria, categoria",          status: "pendiente" },
  { field: "Marca / Brand",              example: "ej: marca, brand",                    status: "pendiente" },
  { field: "Color del canal (hex)",      example: "ej: color (opcional)",                status: "pendiente" },
]

const CANALES = [
  { name: "Canal A",  pct: 38, color: "#A427FF" },
  { name: "Canal B",  pct: 24, color: "#F5C518" },
  { name: "Canal C",  pct: 17, color: "#E31837" },
  { name: "Canal D",  pct: 12, color: "#4285F4" },
  { name: "Otros",   pct: 9,  color: "#9ca3af" },
]

export default function TrafficPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tráfico"
        subtitle="Distribución de visitas por canal — stacked bar, trend de 30 días y comparativa entre marketplaces, retailers y canales propios"
      />

      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">En construcción</span>
        <span className="text-xs text-amber-700">Indicá qué columnas de tu DB corresponden a cada campo para activar este módulo.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm opacity-40 pointer-events-none">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Vista previa — distribución por canal</div>
          {/* Stacked bar */}
          <div className="flex h-10 rounded-xl overflow-hidden gap-px mb-3">
            {CANALES.map(c => (
              <div key={c.name} className="relative h-full flex items-center justify-center"
                style={{ width: c.pct + "%", backgroundColor: c.color, minWidth: 8 }}>
                {c.pct >= 10 && (
                  <span className="text-white text-[10px] font-black">{c.pct}%</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-5">
            {CANALES.map(c => (
              <div key={c.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: c.color }} />
                <span className="text-[10px] text-gray-500">{c.name}</span>
                <span className="text-[10px] font-bold text-gray-700">{c.pct}%</span>
              </div>
            ))}
          </div>
          {/* Mini trend placeholder */}
          <div className="text-[10px] text-gray-400 mb-2">Tendencia 30 días</div>
          <svg viewBox="0 0 300 60" className="w-full">
            <polyline points="0,50 30,40 60,42 90,35 120,38 150,28 180,30 210,22 240,25 270,18 300,20"
              fill="none" stroke="#A427FF" strokeWidth="2" strokeLinecap="round" />
            <polyline points="0,55 30,52 60,50 90,48 120,50 150,45 180,44 210,42 240,40 270,38 300,36"
              fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4,3" />
          </svg>
        </div>

        <div className="space-y-3">
          {[
            { icon: Globe,      label: "Canal #1 en tráfico",   value: "—", color: "#7c3aed" },
            { icon: Activity,   label: "Visitas totales",        value: "—", color: "#16a34a" },
            { icon: TrendingUp, label: "Crecimiento vs período", value: "—", color: "#d97706" },
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
