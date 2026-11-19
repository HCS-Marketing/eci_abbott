"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { X, Send, Sparkles, Loader2, Maximize2 } from "lucide-react"
import clsx from "clsx"
import AIMarkdown from "@/components/ai/AIMarkdown"
import { useAIChat } from "@/lib/use-ai-chat"

// ─── PAGE SUGGESTIONS ─────────────────────────────────────────
const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  "/share-of-search":  ["¿Cómo mejorar el share en las categorías donde perdemos?", "¿Qué canales tienen mayor potencial?", "¿Cómo interpreto la tendencia de share?"],
  "/ranking":          ["¿Qué factores afectan el score de ranking?", "¿Cómo ganar posición frente a competidores?", "¿Qué categorías tienen más oportunidad?"],
  "/bestsellers":      ["¿Cuáles son los productos estrella y por qué?", "¿Qué tienen en común los productos con mejor ranking?", "¿Cómo replicar el éxito de los bestsellers?"],
  "/pricing":          ["¿Estamos competitivos en precio?", "¿Cómo responder a un competidor más barato?", "¿Dónde podemos subir precio sin perder share?"],
  "/buybox":           ["¿Por qué perdemos BuyBox en ciertas categorías?", "¿Qué cambios de precio/promo nos harían ganar más BuyBox?", "¿Cuál es el impacto de perder BuyBox?"],
  "/assortment":       ["¿Dónde están nuestros mayores gaps de catálogo?", "¿Qué marcas tienen mejor cobertura que nosotros?", "¿Qué categorías deberíamos priorizar para ampliar surtido?"],
  "/inventory":        ["¿Qué productos de Abbott tienen rotura de stock?", "¿Cómo impacta el quiebre de stock en el posicionamiento?", "¿Qué acciones tomar ante una rotura crítica?"],
  "/price-index":      ["¿En qué categorías somos más caros que la competencia?", "¿Dónde podemos bajar el índice de precio?", "¿Cómo leer el price index para tomar decisiones?"],
}

const DEFAULT_SUGGESTIONS = [
  "¿Cuál es el estado actual de Abbott en el mercado?",
  "¿Cómo mejorar la visibilidad en MercadoLibre?",
  "¿Qué acciones priorizar esta semana?",
]

// ─── COMPONENT ────────────────────────────────────────────────
export default function AIAdvisor() {
  const [open,  setOpen]  = useState(false)
  const [input, setInput] = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)
  const pathname       = usePathname()

  // El servidor consulta la base con las herramientas; acá solo le contamos en qué pantalla está el usuario.
  const getPageContext = useCallback(() => `Página activa del usuario: ${pathname ?? "/"}`, [pathname])
  const { country, messages, loading, send, reset } = useAIChat(getPageContext)

  const suggestions = (pathname ? SUGGESTED_QUESTIONS[pathname] : null) ?? DEFAULT_SUGGESTIONS

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const sendMessage = (text: string) => {
    if (!text.trim() || loading) return
    send(text)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  // En la página del asistente el chat flotante sobra
  if (pathname?.startsWith("/asistente")) return null

  return (
    <>
      {/* ── Floating button ──────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={clsx(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105",
          open
            ? "bg-white border border-gray-200 text-gray-500"
            : "bg-gradient-to-br from-purple-500 to-purple-700 text-white"
        )}>
        {open ? <X size={22} /> : <Sparkles size={22} />}
        {!open && messages.length === 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-400 border-2 border-white animate-pulse" />
        )}
      </button>

      {/* ── Chat panel ───────────────────────────────── */}
      <div className={clsx(
        "fixed bottom-24 right-6 z-50 w-[370px] max-w-[calc(100vw-3rem)] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col transition-all duration-300 origin-bottom-right",
        open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
      )} style={{ height: "540px" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Abbott AI Advisor</div>
            <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Datos en tiempo real · {country}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={reset}
                className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
                Nueva consulta
              </button>
            )}
            <Link href="/asistente" onClick={() => setOpen(false)} title="Abrir Asistente IA en pantalla completa"
              className="text-gray-400 hover:text-purple-600 transition-colors">
              <Maximize2 size={14} />
            </Link>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-4">
              <div className="text-2xl mb-2">🧠</div>
              <div className="text-sm font-semibold text-gray-800 mb-1">Consultor Abbott</div>
              <div className="text-xs text-gray-400 leading-relaxed">
                Preguntame sobre precios, ranking, BuyBox, assortment e inventario de Abbott. Uso solo datos de {country}.
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={clsx("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles size={11} className="text-white" />
                </div>
              )}
              <div className={clsx("max-w-[88%] rounded-2xl px-3.5 py-2.5",
                msg.role === "user"
                  ? "bg-purple-600 text-white text-sm"
                  : msg.error ? "bg-red-50 border border-red-200 text-red-700 text-sm" : "bg-gray-50 border border-gray-100 min-w-0"
              )}>
                {msg.role === "assistant" && !msg.error ? <AIMarkdown text={msg.content} compact /> : msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
                <Sparkles size={11} className="text-white" />
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl px-3.5 py-3 flex items-center gap-2">
                <Loader2 size={14} className="text-purple-500 animate-spin" />
                <span className="text-xs text-gray-400">Pensando... puede estar consultando la DB</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 0 && (
          <div className="px-4 pb-2 flex-shrink-0 space-y-1.5">
            {suggestions.map(s => (
              <button key={s} onClick={() => sendMessage(s)}
                className="w-full text-left text-xs text-gray-600 px-3 py-2 bg-gray-50 hover:bg-purple-50 border border-gray-100 hover:border-purple-200 rounded-xl transition-colors hover:text-purple-700">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-purple-300 transition-colors">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntame sobre estrategia de Abbott..."
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-purple-700 transition-colors">
              <Send size={13} className="text-white" />
            </button>
          </div>
          <div className="text-[9px] text-gray-400 text-center mt-1.5">
            Powered by Claude · consulta la DB en tiempo real
          </div>
        </div>
      </div>
    </>
  )
}
