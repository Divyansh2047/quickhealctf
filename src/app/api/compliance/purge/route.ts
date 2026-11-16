import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'
import { checkRateLimit, clientIp, rateLimitResponse } from '@/lib/rate-limit'
import { readRetentionPolicy } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

const PURGE_RATE_LIMIT = 5
const PURGE_RATE_WINDOW_MS = 60_000

/**
 * POST /api/compliance/purge — enforces the retention policy immediately:
 * deletes every tracked event older than defaultRetentionDays.
 */
export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(`purge:${clientIp(request)}`, PURGE_RATE_LIMIT, PURGE_RATE_WINDOW_MS)
    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfterSec)
    }

    const policy = await readRetentionPolicy()
    const cutoff = new Date(Date.now() - policy.defaultRetentionDays * 24 * 60 * 60 * 1000)
    const result = await db.trackedEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    await logAudit(
      'RETENTION_PURGE',
      ADMIN_ACTOR,
      `Retention purge removed ${result.count} tracked event(s) older than ${policy.defaultRetentionDays} days (cutoff ${cutoff.toISOString()})`
    )

    return NextResponse.json({
      purged: result.count,
      cutoffAt: cutoff.toISOString(),
      autoPurge: policy.autoPurge,
    })
  } catch (error) {
    console.error('POST /api/compliance/purge failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
