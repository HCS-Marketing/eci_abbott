import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { username, password } = body as { username?: string; password?: string }

  const validUser = process.env.USER_APP1
  const validPass = process.env.PASS_APP1

  if (!validUser || !validPass) {
    return NextResponse.json(
      { error: "Error de configuración en el servidor" },
      { status: 500 }
    )
  }

  if (!username || !password || username !== validUser || password !== validPass) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos" },
      { status: 401 }
    )
  }

  const timestamp = Date.now().toString()
  const payload = `${username}.${timestamp}`
  const hmac = createHmac("sha256", validPass).update(payload).digest("hex")
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
