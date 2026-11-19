import { Fragment, type ReactNode } from "react"

// Renderizador mínimo de Markdown para las respuestas del asistente:
// títulos (#), listas (- / 1.), **negrita**, `código`, tablas | a | b | y párrafos.

function inline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g)
  return parts.map((p, i) => {
    const key = `${keyBase}-${i}`
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={key} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={key} className="px-1 py-0.5 rounded bg-gray-100 text-[0.85em]">{p.slice(1, -1)}</code>
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) return <em key={key} className="text-gray-500">{p.slice(1, -1)}</em>
    return <Fragment key={key}>{p}</Fragment>
  })
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim())
}

const isTableSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)

export default function AIMarkdown({ text, compact = false }: { text: string; compact?: boolean }) {
  const lines = text.split("\n")
  const out: ReactNode[] = []
  const size = compact ? "text-sm" : "text-[15px]"
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const key = `l${i}`

    // Tabla: fila de encabezado + separador
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]))
        i++
      }
      out.push(
        <div key={key} className="overflow-x-auto my-2 border border-gray-200 rounded-lg">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>{header.map((h, j) => <th key={j} className="px-2.5 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">{inline(h, `${key}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-gray-100">
                  {r.map((c, j) => <td key={j} className="px-2.5 py-1.5 text-gray-700 whitespace-nowrap">{inline(c, `${key}r${ri}c${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      out.push(<div key={key} className="font-semibold text-gray-900 mt-3 mb-1">{inline(heading[2], key)}</div>)
    } else if (/^\s*[-•*]\s+/.test(line)) {
      out.push(
        <div key={key} className={`flex gap-2 text-gray-700 leading-relaxed ${size}`}>
          <span className="text-purple-500 flex-shrink-0">·</span>
          <span>{inline(line.replace(/^\s*[-•*]\s+/, ""), key)}</span>
        </div>,
      )
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      const n = line.match(/\d+/)?.[0]
      out.push(
        <div key={key} className={`flex gap-2 text-gray-700 leading-relaxed ${size}`}>
          <span className="text-purple-500 flex-shrink-0 font-mono text-xs mt-0.5">{n}.</span>
          <span>{inline(line.replace(/^\s*\d+[.)]\s+/, ""), key)}</span>
        </div>,
      )
    } else if (line.trim() === "") {
      out.push(<div key={key} className="h-2" />)
    } else {
      out.push(<div key={key} className={`text-gray-700 leading-relaxed ${size}`}>{inline(line, key)}</div>)
    }
    i++
  }

  return <div>{out}</div>
}
