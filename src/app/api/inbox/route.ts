import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parseJsonArray } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const participantId = request.nextUrl.searchParams.get('participantId')
    if (!participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 })
    }
    const participant = await db.participant.findUnique({ where: { id: participantId } })
    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const enrollments = await db.enrollment.findMany({
      where: {
        participantId,
        deliveredAt: { not: null },
        campaign: { status: { not: 'cancelled' } },
      },
      include: { campaign: { include: { template: true } } },
      orderBy: { deliveredAt: 'desc' },
    })

    const inbox = enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      campaignId: enrollment.campaignId,
      campaignName: enrollment.campaign.name,
      deliveredAt: enrollment.deliveredAt ? enrollment.deliveredAt.toISOString() : '',
      opened: enrollment.openedAt !== null,
      clicked: enrollment.clickedAt !== null,
      landed: enrollment.landedAt !== null,
      submitted: enrollment.submittedAt !== null,
      reported: enrollment.reportedAt !== null,
      landedAt: enrollment.landedAt ? enrollment.landedAt.toISOString() : null,
      submittedAt: enrollment.submittedAt ? enrollment.submittedAt.toISOString() : null,
      template: {
        id: enrollment.campaign.template.id,
        subject: enrollment.campaign.template.subject,
        senderName: enrollment.campaign.template.senderName,
        senderEmail: enrollment.campaign.template.senderEmail,
        bodyHtml: enrollment.campaign.template.bodyHtml,
        landingMessage: enrollment.campaign.template.landingMessage,
        category: enrollment.campaign.template.category,
        difficulty: enrollment.campaign.template.difficulty,
        aiGenerated: enrollment.campaign.template.aiGenerated,
        redFlags: parseJsonArray(enrollment.campaign.template.redFlags),
      },
    }))

    return NextResponse.json({
      participant: {
        id: participant.id,
        name: participant.name,
        email: participant.email,
        department: participant.department,
      },
      inbox,
    })
  } catch (error) {
    console.error('GET /api/inbox failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
