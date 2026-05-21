"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

function SOSBrandmark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 128" fill="none">
      <circle cx="107" cy="20.24" r="13.3" fill="#A427FF" />
      <path
        d="M86.9686 43.9048C86.9505 43.8867 86.9346 43.8663 86.9188 43.8482L74.865 83.1451C74.7316 83.7063 74.5892 84.2674 74.4173 84.8264C72.405 91.3887 67.9597 96.772 61.9 99.9876C55.8404 103.203 48.8921 103.864 42.3372 101.85C28.8025 97.6908 21.1713 83.2899 25.3272 69.7444C28.4 59.7312 37.0644 52.9472 46.8436 51.7705L41.9235 67.8119C39.9631 74.2022 43.5514 80.975 49.9367 82.9369C51.1193 83.3012 52.3154 83.4732 53.4911 83.4732C55.5577 83.4732 57.561 82.9301 59.3269 81.9571C61.9792 80.493 64.091 78.0446 65.0497 74.9173L69.4294 60.6364L74.1618 45.2082C75.9594 39.3496 73.0924 33.1743 67.6839 30.6738C67.2904 30.4928 66.8857 30.3298 66.4674 30.1895C66.3611 30.1533 66.2571 30.1171 66.1486 30.0832C65.9677 30.0266 65.7868 29.9768 65.6059 29.9316C65.2419 29.8094 64.8756 29.6917 64.5048 29.5786C38.2221 21.4979 10.2707 36.331 2.20092 62.6367C-5.86885 88.9425 8.95023 116.916 35.2375 124.992C40.0716 126.477 45.0166 127.214 49.9344 127.214C57.968 127.214 65.9338 125.25 73.2325 121.376C83.95 115.69 92.0673 106.507 96.3837 95.2853L96.5035 95.3215L97.5436 91.9318L112.021 44.7352L88.895 37.6298L86.9686 43.907V43.9048Z"
        fill="#A427FF"
      />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        router.push("/main")
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || "Error al iniciar sesión")
      }
    } catch {
      setError("No se pudo conectar con el servidor")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#0D1117" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <SOSBrandmark size={48} />
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">Share of Shelf</h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              Ingresa tus credenciales para continuar
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Tu usuario"
                required
                autoComplete="username"
                className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all"
                style={{
                  backgroundColor: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "#A427FF")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                required
                autoComplete="current-password"
                className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-all"
                style={{
                  backgroundColor: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "#A427FF")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                className="rounded-xl px-4 py-2.5 text-xs text-center"
                style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171" }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all mt-1"
              style={{
                backgroundColor: loading ? "rgba(164,39,255,0.5)" : "#A427FF",
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = "#8B1EE0" }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = "#A427FF" }}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
