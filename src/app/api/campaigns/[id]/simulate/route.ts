import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recordEvent } from '@/lib/events'
import { serializeCampaignDetail } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

const OPEN_PROBABILITY = 0.85
const REPORT_PROBABILITY = 0.45
const CLICK_PROBABILITY_BY_DIFFICULTY: Record<string, number> = {
  easy: 0.45,
  medium: 0.3,
  hard: 0.18,
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const campaign = await db.campaign.findUnique({
      where: { id },
      include: { template: { select: { difficulty: true } }, enrollments: true },
    })
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.status !== 'running') {
      return NextResponse.json({ error: 'Only running campaigns can be simulated' }, { status: 400 })
    }

    const clickProbability = CLICK_PROBABILITY_BY_DIFFICULTY[campaign.template.difficulty] ?? 0.3
    const now = new Date()
    let created = 0

    for (const enrollment of campaign.enrollments) {
      const updates: { openedAt?: Date; clickedAt?: Date; reportedAt?: Date } = {}
      let openedAt = enrollment.openedAt

      // 1) Simulated open — event timestamp spread over the past few hours.
      if (!openedAt && Math.random() < OPEN_PROBABILITY) {
        openedAt = now
        updates.openedAt = now
        await recordEvent(
          enrollment.id,
          'OPEN',
          undefined,
          new Date(Date.now() - Math.floor(Math.random() * 4 * 3600 * 1000))
        )
        created += 1
      }

      // 2) Simulated click — only for enrollments already opened before this pass.
      if (
        enrollment.openedAt &&
        !enrollment.clickedAt &&
        !enrollment.reportedAt &&
        Math.random() < clickProbability
      ) {
        updates.clickedAt = now
        await recordEvent(enrollment.id, 'CLICK')
        created += 1
      }

      // 3) Simulated report — possible in the same pass the open happened.
      if (openedAt && !enrollment.reportedAt && Math.random() < REPORT_PROBABILITY) {
        updates.reportedAt = now
        await recordEvent(enrollment.id, 'REPORT', 'Reported by participant during simulation')
        created += 1
      }

      if (Object.keys(updates).length > 0) {
        await db.enrollment.update({ where: { id: enrollment.id }, data: updates })
      }
    }

    const detail = await db.campaign.findUnique({
      where: { id },
      include: { template: true, enrollments: { include: { participant: true } } },
    })
    if (!detail) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({ created, campaign: serializeCampaignDetail(detail) })
  } catch (error) {
    console.error('POST /api/campaigns/[id]/simulate failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
