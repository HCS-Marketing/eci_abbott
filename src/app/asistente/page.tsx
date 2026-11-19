"use client"
import { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import { Sparkles, Send, Loader2, Database, RotateCcw } from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import AIMarkdown from "@/components/ai/AIMarkdown"
import { useAIChat } from "@/lib/use-ai-chat"

const COUNTRY_NAMES: Record<string, string> = { MX: "México", CO: "Colombia", PE: "Perú" }

const SUGGESTIONS: Record<string, string[]> = {
  MX: [
    "¿Cuál es el precio promedio de Ensure por retail en la última fecha?",
    "¿En qué retails Abbott tiene más productos en la primera página?",
    "¿Qué productos de Abbott están sin stock hoy?",
    "¿Qué sellers venden productos de Abbott en Mercado Libre?",
  ],
  CO: [
    "¿Cuál es el precio promedio de Abbott por retail en la última fecha?",
    "¿Qué competidores tienen más presencia en Rappi?",
    "¿Qué productos de Abbott tienen descuento hoy?",
    "¿Cómo se compara el precio de PediaSure entre retails?",
  ],
  PE: [
    "¿Cuál es el precio promedio de Abbott por retail en la última fecha?",
    "¿Qué fabricantes dominan los primeros puestos del ranking?",
    "¿Qué productos de Abbott tienen descuento hoy?",
    "¿Cómo evolucionó el share de Abbott en la última semana?",
  ],
}

export default function AsistentePage() {
  const { country, messages, loading, send, reset } = useAIChat()
  const [input, setInput] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const countryName = COUNTRY_NAMES[country] || country
  const suggestions = SUGGESTIONS[country] ?? SUGGESTIONS.MX

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading])

  const submit = (text: string) => {
    if (!text.trim() || loading) return
    send(text)
    setInput("")
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] min-h-[520px]">
      <PageHeader
        title="Asistente IA"
        subtitle="Preguntá en lenguaje natural sobre los datos del dashboard"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
              Datos de {countryName}
            </span>
            {messages.length > 0 && (
              <button onClick={reset}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                <RotateCcw size={12} /> Nueva conversación
              </button>
            )}
          </div>
        }
      />

      {/* Conversación */}
      <div className="flex-1 overflow-y-auto py-4 space-y-5">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto text-center pt-8">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center mb-3">
              <Sparkles size={22} className="text-white" />
            </div>
            <div className="text-base font-semibold text-gray-900">¿Qué querés saber de {countryName}?</div>
            <div className="text-sm text-gray-500 mt-1">
              Claude consulta la base de datos en vivo. Todas las respuestas usan solo datos de {countryName};
              para ver otro país, cambialo en el selector del menú.
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-6 text-left">
              {suggestions.map(s => (
                <button key={s} onClick={() => submit(s)}
                  className="text-sm text-gray-700 px-3.5 py-3 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={clsx("flex gap-3 max-w-4xl", m.role === "user" ? "ml-auto justify-end" : "mr-auto")}>
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
                <Sparkles size={14} className="text-white" />
              </div>
            )}
            <div className={clsx(
              "rounded-2xl px-4 py-3 min-w-0",
              m.role === "user"
                ? "bg-purple-600 text-white text-[15px] max-w-[80%]"
                : m.error ? "bg-red-50 border border-red-200 text-red-700 text-sm" : "bg-white border border-gray-200 flex-1",
            )}>
              {m.role === "assistant" && !m.error ? <AIMarkdown text={m.content} /> : m.content}
              {m.queries && m.queries.length > 0 && (
                <details className="mt-3 pt-2 border-t border-gray-100">
                  <summary className="text-[11px] text-gray-400 cursor-pointer flex items-center gap-1 select-none">
                    <Database size={11} /> {m.queries.length} consulta{m.queries.length > 1 ? "s" : ""} a la base ({m.country})
                  </summary>
                  <ul className="mt-1.5 space-y-0.5">
                    {m.queries.map((q, j) => <li key={j} className="text-[11px] text-gray-500">· {q}</li>)}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 size={15} className="text-purple-500 animate-spin" />
              <span className="text-sm text-gray-500">Consultando la base de {countryName}…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Entrada */}
      <div className="pt-3 border-t border-gray-100">
        <div className="flex items-end gap-2 bg-white border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-purple-300 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input) } }}
            placeholder={`Preguntá sobre precios, ranking, stock, sellers… (${countryName})`}
            className="flex-1 resize-none bg-transparent text-[15px] text-gray-800 placeholder-gray-400 outline-none max-h-40 py-1"
          />
          <button onClick={() => submit(input)} disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-purple-700 transition-colors">
            <Send size={15} className="text-white" />
          </button>
        </div>
        <div className="text-[10px] text-gray-400 text-center mt-1.5">
          Claude puede equivocarse: verificá las cifras importantes en el módulo correspondiente.
        </div>
      </div>
    </div>
  )
}
