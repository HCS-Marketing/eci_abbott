"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useGlobalFilters } from "@/lib/filter-context"

export interface AIChatMessage {
  role: "user" | "assistant"
  content: string
  queries?: string[]   // consultas a la base que hizo Claude para esta respuesta
  country?: string
  error?: boolean
}

/**
 * Estado de una conversación con el asistente. La conversación queda atada al país
 * activo del selector global: si el usuario cambia de país, se reinicia.
 */
export function useAIChat(getPageContext?: () => string) {
  const { country } = useGlobalFilters()
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    setMessages([])
    setLoading(false)
  }, [country])

  const send = useCallback(async (text: string) => {
    const question = text.trim()
    if (!question || loading) return
    const history = [...messages.filter(m => !m.error), { role: "user" as const, content: question }]
    setMessages(prev => [...prev, { role: "user", content: question }])
    setLoading(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          country,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          pageContext: getPageContext?.() || "",
        }),
      })
      const data = await res.json().catch(() => ({}))
      const textReply: string | undefined = data?.content?.[0]?.text
      if (!res.ok || !textReply) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data?.error || "No se pudo procesar la consulta. Intentá nuevamente.",
          error: true,
        }])
      } else {
        setMessages(prev => [...prev, {
          role: "assistant", content: textReply, queries: data.queries || [], country: data.country,
        }])
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return
      setMessages(prev => [...prev, { role: "assistant", content: "Error de conexión. Intentá de nuevo.", error: true }])
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null
        setLoading(false)
      }
    }
  }, [messages, loading, country, getPageContext])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setLoading(false)
  }, [])

  return { country, messages, loading, send, reset }
}
