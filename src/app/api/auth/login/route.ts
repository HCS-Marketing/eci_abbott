import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { username, password } = body as { username?: string; password?: string }

  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) {
    return NextResponse.json(
      { error: "Error de configuración en el servidor" },
      { status: 500 }
    )
  }

  // Check all user slots (USER_APP1 … USER_APP6)
  const slots = Array.from({ length: 6 }, (_, i) => ({
    user: process.env[`USER_APP${i + 1}`],
    pass: process.env[`PASS_APP${i + 1}`],
  }))
  const matched = slots.find(
    s => s.user && s.pass && s.user === username && s.pass === password
  )

  if (!username || !password || !matched) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos" },
      { status: 401 }
    )
  }

  const timestamp = Date.now().toString()
  const payload = `${username}.${timestamp}`
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
