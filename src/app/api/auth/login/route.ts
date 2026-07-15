import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { username, password } = body as { username?: string; password?: string }

  const normalizedUsername = (username ?? "").trim().toLowerCase()
  const normalizedPassword = (password ?? "").trim()

  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) {
    return NextResponse.json(
      { error: "Error de configuración en el servidor" },
      { status: 500 }
    )
  }

  // Check all configured user slots (USER_APP1 … USER_APP15)
  const slots = Array.from({ length: 15 }, (_, i) => ({
    user: process.env[`USER_APP${i + 1}`],
    pass: process.env[`PASS_APP${i + 1}`],
  }))
  const matched = slots.find(
    s =>
      s.user &&
      s.pass &&
      s.user.trim().toLowerCase() === normalizedUsername &&
      s.pass.trim() === normalizedPassword
  )

  if (!normalizedUsername || !normalizedPassword || !matched) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos" },
      { status: 401 }
    )
  }

  const timestamp = Date.now().toString()
  const tokenUsername = matched.user!.trim().toLowerCase()
  const payload = `${tokenUsername}.${timestamp}`
  const hmac = createHmac("sha256", authSecret).update(payload).digest("hex")
  const token = `${payload}.${hmac}`

  const response = NextResponse.json({ success: true })
  response.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })

  return response
}
