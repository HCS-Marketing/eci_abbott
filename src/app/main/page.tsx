import Link from "next/link"
import {
  Search, ListOrdered, Trophy, Tag, Zap, Layers, Package,
} from "lucide-react"

const MODULES = [
  {
    href: "/ecommerce-index",
    label: "SOS",
    description: "Visibilidad de productos por seller y categoría",
    icon: Search,
    color: "#A427FF",
  },
  {
    href: "/ranking",
    label: "Ranking",
    description: "Posicionamiento de productos en resultados de búsqueda",
    icon: ListOrdered,
    color: "#6366f1",
  },
  {
    href: "/bestsellers",
    label: "Bestsellers",
    description: "Productos más vendidos por categoría y marca",
    icon: Trophy,
    color: "#f59e0b",
  },
  {
    href: "/pricing",
    label: "Pricing Live",
    description: "Monitoreo de precios en tiempo real",
    icon: Tag,
    color: "#10b981",
  },
  {
    href: "/buybox",
    label: "BuyBox",
    description: "Análisis de quién gana la BuyBox por producto",
    icon: Zap,
    color: "#ef4444",
  },
  {
    href: "/assortment",
    label: "Assortment",
    description: "Surtido y disponibilidad de catálogo",
    icon: Layers,
    color: "#3b82f6",
  },
  {
    href: "/inventory",
    label: "Inventario",
    description: "Estado del stock por SKU y bodega",
    icon: Package,
    color: "#14b8a6",
  },
]

export const metadata = {
  title: "Inicio",
}

export default function MainPage() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel principal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Selecciona un módulo para comenzar a analizar tu desempeño en el marketplace
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map(({ href, label, description, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-2xl p-5 bg-white border border-gray-100 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
          >
            {/* Icon bubble */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}18` }}
            >
              <Icon size={18} style={{ color }} />
            </div>

            {/* Text */}
            <div>
              <div className="text-sm font-semibold text-gray-900 group-hover:text-[#A427FF] transition-colors">
                {label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {description}
              </div>
            </div>

            {/* Arrow */}
            <div className="mt-auto pt-1">
              <span className="text-xs font-medium" style={{ color }}>
                Ir al módulo →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
