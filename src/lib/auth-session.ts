import { cookies } from "next/headers"
import { createHmac } from "crypto"

// Slot-based country lock. Add new restricted users by slot number.
const COUNTRY_LOCK_BY_SLOT: Record<number, string[]> = {
  2: ["MX"],
  3: ["MX"],
  4: ["MX"],
  5: ["MX"],
  6: ["MX"],
  7: ["CO"],
  9: ["PE"],
  10: ["PE"],
  11: ["PE"],
  12: ["CO"],
  13: ["CO"],
  14: ["CO"],
  15: ["CO"],
  16: ["PE"],
}

// User-specific overrides for multi-country access.
const COUNTRY_LOCK_BY_USER: Record<string, string[]> = {
  "laura.jimenez1@abbott.com": ["MX", "CO"],
}

export type SessionInfo =
  | { authenticated: false; countryLock: null }
  | { authenticated: true; username: string; countryLock: string[] | null }

const UNAUTHENTICATED: SessionInfo = { authenticated: false, countryLock: null }

/** Reads and validates the auth-token cookie. Returns the user and their country lock (null = all countries). */
export async function getSession(): Promise<SessionInfo> {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) return UNAUTHENTICATED

  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) return UNAUTHENTICATED

  // Validate HMAC
  const lastDot = token.lastIndexOf(".")
  if (lastDot === -1) return UNAUTHENTICATED

  const payload  = token.substring(0, lastDot)
  const hmacHex  = token.substring(lastDot + 1)
  const expected = createHmac("sha256", authSecret).update(payload).digest("hex")
  if (expected !== hmacHex) return UNAUTHENTICATED

  // Check expiry — timestamp is the last segment of the payload
  const parts     = payload.split(".")
  const timestamp = parseInt(parts[parts.length - 1])
  if (isNaN(timestamp) || Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) return UNAUTHENTICATED

  // Extract username (everything before the timestamp)
  const username = parts.slice(0, -1).join(".").trim().toLowerCase()

  // Determine country lock by username override first, then slot mapping.
  let countryLock: string[] | null = COUNTRY_LOCK_BY_USER[username] ?? null
  if (!countryLock) {
    for (const [slotRaw, lock] of Object.entries(COUNTRY_LOCK_BY_SLOT)) {
      const slot = Number(slotRaw)
      const slotUser = process.env[`USER_APP${slot}`]?.trim().toLowerCase()
      if (slotUser && slotUser === username) {
        countryLock = lock
        break
      }
    }
  }

  return { authenticated: true, username, countryLock }
}
