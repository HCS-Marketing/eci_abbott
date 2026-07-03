"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Search } from "lucide-react"

interface ProductMultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (items: string[]) => void
  label?: string
  className?: string
}

export default function ProductMultiSelect({
  options,
  selected,
  onChange,
  label = "Producto",
  className = "",
}: ProductMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(item => item.toLowerCase().includes(q))
  }, [options, search])

  const allVisibleSelected = filtered.length > 0 && filtered.every(item => selected.includes(item))

  function toggleItem(item: string) {
    if (selected.includes(item)) {
      onChange(selected.filter(v => v !== item))
      return
    }
    onChange([...selected, item])
  }

  function selectVisible() {
    const merged = Array.from(new Set([...selected, ...filtered]))
    onChange(merged)
  }

  function clearVisible() {
    const visibleSet = new Set(filtered)
    onChange(selected.filter(v => !visibleSet.has(v)))
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-[280px] max-w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-xs text-left text-gray-700 flex items-center justify-between"
      >
        <span className="truncate">
          {selected.length === 0 ? "Todos los productos" : `${selected.length} seleccionados`}
        </span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-[360px] max-w-[92vw] rounded-xl border border-gray-200 bg-white shadow-lg p-2">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5 mb-2">
            <Search size={12} className="text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full text-xs outline-none text-gray-700"
            />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={allVisibleSelected ? clearVisible : selectVisible}
              className="text-[11px] px-2 py-1 rounded border border-gray-200 bg-gray-50 text-gray-700"
            >
              {allVisibleSelected ? "Quitar visibles" : "Seleccionar visibles"}
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] px-2 py-1 rounded border border-gray-200 bg-white text-gray-700"
            >
              Limpiar todo
            </button>
          </div>

          <div className="max-h-64 overflow-auto border border-gray-100 rounded-lg">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">Sin coincidencias</div>
            ) : (
              filtered.map(item => (
                <label key={item} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(item)}
                    onChange={() => toggleItem(item)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate text-gray-700">{item}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
