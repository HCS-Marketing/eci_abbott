"use client"
import Link from "next/link"
import { Search, ScanSearch, ListOrdered } from "lucide-react"

const MODULES = [
  {
    href: "/ecommerce-index",
    icon: Search,
    title: "Share of Shelf",
    description: "Presencia por fabricante, marca y título en página 1 y total",
    color: "#A427FF",
    bg: "bg-purple-50",
    border: "border-purple-100",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    href: "/search",
    icon: ScanSearch,
    title: "Share of Search",
    description: "Visibilidad en resultados de búsqueda por términos clave",
    color: "#00A3E0",
    bg: "bg-sky-50",
    border: "border-sky-100",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
  },
  {
    href: "/ranking",
    icon: ListOrdered,
    title: "Ranking Score",
    description: "Suma del score de posición acumulado por fabricante, marca y título",
    color: "#003DA5",
    bg: "bg-blue-50",
    border: "border-blue-100",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
  },
]

export default function MainPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Panel de analítica</h1>
        <p className="text-sm text-gray-400">Selecciona un módulo para comenzar</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl">
        {MODULES.map(({ href, icon: Icon, title, description, bg, border, iconBg, iconColor }) => (
          <Link
            key={href}
            href={href}
            className={`group flex flex-col items-center text-center gap-4 p-7 rounded-2xl border ${bg} ${border} hover:shadow-md transition-all hover:scale-[1.02]`}
          >
            <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center`}>
              <Icon size={26} className={iconColor} />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-1">{title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
