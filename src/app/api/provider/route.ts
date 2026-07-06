import { NextResponse } from "next/server"
import { loadMxProviderRows, maxMxProviderDate, minMxProviderDate, toProviderSkuid } from "@/lib/mx-provider-data"

export const dynamic = "force-dynamic"

function normalizeChannel(value: string): string {
  const raw = String(value || "").toUpperCase()
  if (!raw) return ""
  if (raw === "ML" || raw.includes("MERCADO")) return "MERCADO LIBRE"
  if (raw.includes("AMAZON")) return "AMAZON"
  return raw
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get("action") || "health"
    const channel = searchParams.get("channel") || ""
    const date = searchParams.get("date") || ""
    const endDate = searchParams.get("endDate") || ""
    const show = searchParams.get("show") || "all"
    const seller = searchParams.get("seller") || ""
    const products = (searchParams.get("products") || "")
      .split(",")
      .map(v => decodeURIComponent(v.trim()))
      .filter(Boolean)
    const sortBy = (searchParams.get("sortBy") || "score").toLowerCase()
    const sortDir = (searchParams.get("sortDir") || "desc").toLowerCase() === "asc" ? "asc" : "desc"
    const limit = Math.min(5000, Number.parseInt(searchParams.get("limit") || "500", 10))

    const rows = loadMxProviderRows()
    const channelNorm = normalizeChannel(channel)
    const rowsByChannel = channelNorm ? rows.filter(r => r.retail === channelNorm) : rows
    const maxDate = maxMxProviderDate(rowsByChannel)
    const effectiveDate = date || endDate || maxDate

    if (action === "health") {
      return NextResponse.json({
        ok: true,
        rows: rows.length,
        min: minMxProviderDate(rows),
        max: maxMxProviderDate(rows),
        channels: Array.from(new Set(rows.map(r => r.retail))).sort((a, b) => a.localeCompare(b, "es")),
      })
    }

    if (action === "dates") {
      return NextResponse.json({
        min: minMxProviderDate(rowsByChannel),
        max: maxMxProviderDate(rowsByChannel),
      })
    }

    if (action === "channels") {
      const filtered = endDate ? rows.filter(r => r.fecha <= endDate) : rows
      const channels = Array.from(new Set(filtered.map(r => r.retail))).sort((a, b) => a.localeCompare(b, "es"))
      return NextResponse.json(channels)
    }

    if (action === "products") {
      const scoped = rowsByChannel.filter(r => !effectiveDate || r.fecha === effectiveDate)
      const items = Array.from(new Set(scoped.map(r => r.titulo).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"))
      return NextResponse.json(items)
    }

    if (action === "sellers") {
      const sellers = Array.from(new Set(rowsByChannel.map(r => r.seller))).sort((a, b) => a.localeCompare(b, "es"))
      return NextResponse.json(sellers)
    }

    if (action === "raw") {
      const base = rowsByChannel
        .filter(r => products.length === 0 || products.includes(r.titulo))
        .filter(r => !effectiveDate || r.fecha === effectiveDate)
        .sort((a, b) => {
          if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
          if (a.retail !== b.retail) return a.retail.localeCompare(b.retail)
          return (a.posicion ?? 9999) - (b.posicion ?? 9999)
        })
      return NextResponse.json(base.slice(0, limit))
    }

    if (action === "inventory") {
      const grouped = new Map<string, typeof rowsByChannel>()

      for (const r of rowsByChannel) {
        if (products.length > 0 && !products.includes(r.titulo)) continue
        if (r.fecha > effectiveDate) continue
        const key = `${r.retail}|||${r.titulo}`
        const list = grouped.get(key) || []
        list.push(r)
        grouped.set(key, list)
      }

      const out = Array.from(grouped.entries()).map(([key, list]) => {
        list.sort((a, b) => (a.fecha === b.fecha ? (a.posicion ?? 9999) - (b.posicion ?? 9999) : b.fecha.localeCompare(a.fecha)))
        const current = list[0]
        const lastAvailable = list.find(x => x.disponible)
        return {
          id: key,
          estado: current?.disponibilidad || "NO DISPONIBLE",
          producto: current?.titulo || "",
          canal: current?.retail || "",
          ultimo_visto: lastAvailable?.fecha || null,
          stock_status: current?.disponible ? "in_stock" : "break",
        }
      })

      const shown = out.filter(r => {
        if (show === "in_stock") return r.stock_status === "in_stock"
        if (show === "break") return r.stock_status === "break"
        return true
      })

      shown.sort((a, b) => {
        if (a.estado !== b.estado) return a.estado.localeCompare(b.estado)
        if (a.canal !== b.canal) return a.canal.localeCompare(b.canal)
        return a.producto.localeCompare(b.producto, "es")
      })

      return NextResponse.json(shown.slice(0, limit))
    }

    if (action === "buybox") {
      const todays = rowsByChannel
        .filter(r => r.fecha === effectiveDate)
        .filter(r => products.length === 0 || products.includes(r.titulo))
      const byKey = new Map<string, typeof todays[number]>()
      for (const r of todays) {
        const key = `${r.retail}|||${r.titulo}`
        const prev = byKey.get(key)
        if (!prev || (r.posicion ?? 9999) < (prev.posicion ?? 9999)) byKey.set(key, r)
      }

      const out = Array.from(byKey.values())
        .sort((a, b) => {
          if (a.retail !== b.retail) return a.retail.localeCompare(b.retail)
          return (a.posicion ?? 9999) - (b.posicion ?? 9999)
        })
        .map((r, idx) => ({
          id: `${r.retail}|||${r.titulo}|||${idx}`,
          producto: r.titulo,
          plataforma: r.retail,
          estado_hoy: r.disponibilidad,
          winner_seller: r.seller || "SIN INFORMACION",
          url_producto: r.url_producto || "",
        }))

      return NextResponse.json(out.slice(0, limit))
    }

    if (action === "content") {
      const sellerNorm = seller.trim().toUpperCase()
      const base = rowsByChannel.filter(r => r.fecha === effectiveDate).filter(r => {
        if (products.length > 0 && !products.includes(r.titulo)) return false
        if (!sellerNorm) return true
        const fab = r.seller.trim().toUpperCase().includes("ABBOTT") ? "ABBOTT" : r.seller.trim().toUpperCase()
        return fab === sellerNorm || r.seller.trim().toUpperCase() === sellerNorm
      })

      const dedup = new Map<string, typeof base[number]>()
      for (const r of base) {
        const key = `${r.retail}|||${r.titulo}`
        const prev = dedup.get(key)
        if (!prev || (r.posicion ?? 9999) < (prev.posicion ?? 9999)) dedup.set(key, r)
      }

      const parsed = Array.from(dedup.values()).map((r, idx) => ({
        titulo: r.titulo,
        skuid: toProviderSkuid(r, idx),
        plataforma: r.retail,
        fabricante: r.seller.trim().toUpperCase().includes("ABBOTT") ? "ABBOTT" : r.seller,
        valoracion: r.valoracion,
        reviews: r.reviews,
        img_count: r.img_count,
        video_count: r.video_count,
        title_count_characters: r.title_count_characters,
        count_character_desc: r.count_character_desc,
        url_producto: r.url_producto || "",
      }))

      const maxReviews = parsed.reduce((m, r) => Math.max(m, r.reviews), 0)
      const scored = parsed.map(r => {
        const reviewsNorm = maxReviews > 0 ? r.reviews / maxReviews : 0
        const ratingNorm = r.valoracion > 0 ? r.valoracion / 5 : 0
        const score = ((reviewsNorm * 0.6) + (ratingNorm * 0.4)) * 100
        return { ...r, score: Math.round(score * 100) / 100 }
      })

      const rankByScore = [...scored]
        .sort((a, b) => (b.score - a.score) || (b.reviews - a.reviews) || (b.valoracion - a.valoracion) || a.titulo.localeCompare(b.titulo))
        .map((r, i) => ({ ...r, rank: i + 1 }))

      const sorted = [...rankByScore].sort((a, b) => {
        let cmp = 0
        if (sortBy === "valoracion") cmp = a.valoracion - b.valoracion
        else if (sortBy === "reviews") cmp = a.reviews - b.reviews
        else if (sortBy === "titulo") cmp = a.titulo.localeCompare(b.titulo)
        else cmp = a.score - b.score
        return sortDir === "asc" ? cmp : -cmp
      })

      return NextResponse.json(sorted.slice(0, limit))
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
