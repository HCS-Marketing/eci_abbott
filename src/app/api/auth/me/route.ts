import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createHmac } from "crypto"

export const dynamic = "force-dynamic"

// Users locked to Mexico only (slots 2–6)
const MX_SLOTS = [2, 3, 4, 5, 6]

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value

  if (!token) return NextResponse.json({ authenticated: false, countryLock: null })

  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) return NextResponse.json({ authenticated: false, countryLock: null })

  // Validate HMAC
  const lastDot = token.lastIndexOf(".")
  if (lastDot === -1) return NextResponse.json({ authenticated: false, countryLock: null })

  const payload  = token.substring(0, lastDot)
  const hmacHex  = token.substring(lastDot + 1)
  const expected = createHmac("sha256", authSecret).update(payload).digest("hex")

  if (expected !== hmacHex) return NextResponse.json({ authenticated: false, countryLock: null })

  // Check expiry — timestamp is the last segment of the payload
  const parts     = payload.split(".")
  const timestamp = parseInt(parts[parts.length - 1])
  if (isNaN(timestamp) || Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ authenticated: false, countryLock: null })
  }

  // Extract username (everything before the timestamp)
  const username = parts.slice(0, -1).join(".")

  // Determine country lock by matching against env vars
  const mxUsers = MX_SLOTS
    .map(i => process.env[`USER_APP${i}`])
    .filter(Boolean) as string[]

  const countryLock: string[] | null = mxUsers.includes(username) ? ["MX"] : null

  return NextResponse.json({ authenticated: true, username, countryLock })
}
