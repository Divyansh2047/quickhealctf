import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getZai } from '@/lib/ai'

export const dynamic = 'force-dynamic'

/** Base URL of the live-feed mini-service (strip a trailing /emit if set). */
const LIVE_FEED_BASE = (process.env.LIVE_FEED_URL ?? 'http://127.0.0.1:3004/emit').replace(
  /\/emit\/?$/,
  ''
)

async function checkDatabase(): Promise<boolean> {
  try {
    await db.setting.findFirst()
    return true
  } catch (error) {
    console.error('Health check: database failed:', error)
    return false
  }
}

async function checkLiveFeed(): Promise<boolean> {
  try {
    const response = await fetch(`${LIVE_FEED_BASE}/health`, {
      signal: AbortSignal.timeout(1500),
    })
    return response.ok
  } catch (error) {
    console.error('Health check: live feed failed:', error)
    return false
  }
}

async function checkAi(): Promise<boolean> {
  // getZai memoizes successful creation; failures are retried on the next call.
  try {
    await getZai()
    return true
  } catch (error) {
    console.error('Health check: ai failed:', error)
    return false
  }
}

export async function GET() {
  try {
    const [database, liveFeed, ai] = await Promise.all([checkDatabase(), checkLiveFeed(), checkAi()])

    return NextResponse.json({
      ok: database && liveFeed && ai,
      checks: { database, liveFeed, ai },
      uptimeSec: Math.round(process.uptime()),
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('GET /api/health failed:', error)
    return NextResponse.json(
      { ok: false, checks: { database: false, liveFeed: false, ai: false }, uptimeSec: Math.round(process.uptime()), generatedAt: new Date().toISOString() },
      { status: 500 }
    )
  }
}
