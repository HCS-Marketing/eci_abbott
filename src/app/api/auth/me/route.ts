import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createHmac } from "crypto"

export const dynamic = "force-dynamic"

// Slot-based country lock. Add new restricted users by slot number.
const COUNTRY_LOCK_BY_SLOT: Record<number, string[]> = {
  2: ["MX"],
  3: ["MX"],
  4: ["MX"],
  5: ["MX"],
  6: ["MX"],
  7: ["CO"],
}

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

  // Determine country lock by matching username against configured slot(s)
  let countryLock: string[] | null = null
  for (const [slotRaw, lock] of Object.entries(COUNTRY_LOCK_BY_SLOT)) {
    const slot = Number(slotRaw)
    const slotUser = process.env[`USER_APP${slot}`]
    if (slotUser && slotUser === username) {
      countryLock = lock
      break
    }
  }

  return NextResponse.json({ authenticated: true, username, countryLock })
}
