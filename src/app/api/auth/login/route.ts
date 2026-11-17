import { NextResponse } from 'next/server'
import { issueSession, sessionCookie, verifyAdminPassword } from '@/lib/session'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
export async function POST(request: Request) {
  const limit = checkRateLimit('admin-login', 10, 60_000)
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec)
  const body = await request.json().catch(() => null)
  if (!body || typeof body.password !== 'string' || !verifyAdminPassword(body.password)) return NextResponse.json({ error: 'Invalid administrator passphrase' }, { status: 401 })
  const response = NextResponse.json({ ok: true })
  response.cookies.set(sessionCookie(issueSession('admin', 'program-administrator')))
  return response
}
