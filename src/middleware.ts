import { NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login", "/api/auth"]

async function verifyToken(token: string): Promise<boolean> {
  const validPass = process.env.PASS_APP1
  if (!validPass) return false

  const lastDot = token.lastIndexOf(".")
  if (lastDot === -1) return false

  const payload = token.substring(0, lastDot)
  const hmacHex = token.substring(lastDot + 1)

  // Validate payload structure: username.timestamp
  const parts = payload.split(".")
  if (parts.length < 2) return false
  const timestamp = parseInt(parts[parts.length - 1])
  if (isNaN(timestamp)) return false

  // Reject tokens older than 7 days
  const age = Date.now() - timestamp
  if (age > 7 * 24 * 60 * 60 * 1000 || age < 0) return false

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(validPass),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )

    const sigBytes = Uint8Array.from(
      (hmacHex.match(/.{2}/g) ?? []).map(b => parseInt(b, 16))
    )

    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payload)
    )
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths (login page + auth API)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get("auth-token")?.value

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const valid = await verifyToken(token)
  if (!valid) {
    const response = NextResponse.redirect(new URL("/login", req.url))
    response.cookies.set("auth-token", "", { maxAge: 0, path: "/" })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next|favicon|public|.*\\..*).*)"],
}
