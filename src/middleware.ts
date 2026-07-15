import { NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login", "/api/auth"]

// Slot-based country lock. Keep aligned with /api/auth/me.
const COUNTRY_LOCK_BY_SLOT: Record<number, string> = {
  2: "MX",
  3: "MX",
  4: "MX",
  5: "MX",
  6: "MX",
  7: "CO",
  9: "PE",
  10: "PE",
  11: "PE",
  12: "CO",
  13: "CO",
  14: "CO",
  15: "CO",
}

function getCountryLockForUsername(username: string): string | null {
  const normalized = username.trim().toLowerCase()
  for (const [slotRaw, country] of Object.entries(COUNTRY_LOCK_BY_SLOT)) {
    const slot = Number(slotRaw)
    const slotUser = process.env[`USER_APP${slot}`]?.trim().toLowerCase()
    if (slotUser && slotUser === normalized) return country
  }
  return null
}

async function verifyToken(token: string): Promise<{ valid: boolean; username: string | null }> {
  // AUTH_SECRET es una variable plain-text en Vercel, accesible en Edge Runtime.
  // PASS_APP1 / USER_APP1 pueden ser Sensitive y solo las usa la API de login.
  const validPass = process.env.AUTH_SECRET
  if (!validPass) return { valid: false, username: null }

  const lastDot = token.lastIndexOf(".")
  if (lastDot === -1) return { valid: false, username: null }

  const payload = token.substring(0, lastDot)
  const hmacHex = token.substring(lastDot + 1)

  // Validate payload structure: username.timestamp
  const parts = payload.split(".")
  if (parts.length < 2) return { valid: false, username: null }
  const username = parts.slice(0, -1).join(".").trim().toLowerCase()
  const timestamp = parseInt(parts[parts.length - 1])
  if (isNaN(timestamp)) return { valid: false, username: null }

  // Reject tokens older than 7 days
  const age = Date.now() - timestamp
  if (age > 7 * 24 * 60 * 60 * 1000 || age < 0) return { valid: false, username: null }

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

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payload)
    )
    return { valid, username: valid ? username : null }
  } catch {
    return { valid: false, username: null }
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

  const auth = await verifyToken(token)
  if (!auth.valid) {
    const response = NextResponse.redirect(new URL("/login", req.url))
    response.cookies.set("auth-token", "", { maxAge: 0, path: "/" })
    return response
  }

  // Enforce country lock server-side for data APIs, even if query params are tampered.
  const countryLock = auth.username ? getCountryLockForUsername(auth.username) : null
  if (countryLock && (pathname.startsWith("/api/sos") || pathname.startsWith("/api/search"))) {
    const rewritten = req.nextUrl.clone()
    rewritten.searchParams.set("country", countryLock)
    return NextResponse.rewrite(rewritten)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next|favicon|public|.*\\..*).*)"],
}
