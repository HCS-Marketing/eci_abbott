"use client"

import Link from "next/link"
import { Search, ScanSearch, ListOrdered, Zap, Package, Tag, Star } from "lucide-react"
import { useGlobalFilters } from "@/lib/filter-context"

const MODULES = [
  {
    href: "/share-of-shelf",
    label: "Share of Shelf",
    description: "Presencia por fabricante, marca y título en página 1 y total",
    icon: Search,
    color: "#A427FF",
  },
  {
    href: "/search",
    label: "Share of Search",
    description: "Visibilidad en resultados de búsqueda por términos clave",
    icon: ScanSearch,
    color: "#00A3E0",
  },
  {
    href: "/ranking",
    label: "Ranking Score",
    description: "Suma del score de posición acumulado por fabricante, marca y título",
    icon: ListOrdered,
    color: "#003DA5",
  },
  {
    href: "/buybox",
    label: "BuyBox",
    description: "Quién gana la posición destacada por producto — Abbott vs competencia",
    icon: Zap,
    color: "#ef4444",
  },
  {
    href: "/inventory",
    label: "Inventario",
    description: "Estado del stock por SKU — productos activos y roturas detectadas",
    icon: Package,
    color: "#14b8a6",
  },
  {
    href: "/catalog-content",
    label: "Contenido de catalogo",
    description: "Valoración, ventas y score de producto para priorizar planograma",
    icon: Star,
    color: "#d97706",
  },
  {
    href: "/pricing",
    label: "Pricing Live",
    description: "Precios actuales por producto, fabricante y canal — con descuentos y promociones",
    icon: Tag,
    color: "#ea580c",
  },
]

const MX_ONLY_MODULES = new Set(["/buybox", "/inventory", "/catalog-content"])

export default function MainPage() {
  const { country } = useGlobalFilters()
  const visibleModules = country === "MX"
    ? MODULES
    : MODULES.filter(module => !MX_ONLY_MODULES.has(module.href))

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel principal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Selecciona un módulo para comenzar a analizar el desempeño de Abbott en el e-commerce
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleModules.map(({ href, label, description, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-2xl p-5 bg-white border border-gray-100 shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}18` }}
            >
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 group-hover:text-[#A427FF] transition-colors">
                {label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {description}
              </div>
            </div>
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
