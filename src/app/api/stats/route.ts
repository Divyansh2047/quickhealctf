import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildDepartments,
  buildTrend,
  computeRates,
  computeResilienceScore,
  pct,
  type TrendPoint,
} from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [participants, campaigns, enrollments, events, modules, completions, recent] =
      await Promise.all([
        db.participant.findMany(),
        db.campaign.findMany({ include: { enrollments: true }, orderBy: { createdAt: 'desc' } }),
        db.enrollment.findMany({ include: { participant: { select: { department: true } } } }),
        db.trackedEvent.findMany(),
        db.trainingModule.findMany(),
        db.trainingCompletion.findMany(),
        db.trackedEvent.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            enrollment: {
              include: { participant: true, campaign: { include: { template: true } } },
            },
          },
        }),
      ])

    const delivered = events.filter((event) => event.type === 'DELIVERED').length
    const opens = events.filter((event) => event.type === 'OPEN').length
    const clicks = events.filter((event) => event.type === 'CLICK').length
    const reports = events.filter((event) => event.type === 'REPORT').length

    const rates = computeRates(delivered, opens, clicks, reports)
    const consentedActiveCount = participants.filter((p) => p.consented && p.active).length
    const trainingCompletionRate = pct(completions.length, consentedActiveCount * modules.length)
    const resilienceScore = computeResilienceScore(
      rates.clickRate,
      rates.reportRate,
      trainingCompletionRate
    )

    const trend: TrendPoint[] = buildTrend(events)

    const enrollmentDepartment = new Map<string, string>(
      enrollments.map((enrollment): [string, string] => [
        enrollment.id,
        enrollment.participant.department,
      ])
    )
    const departments = buildDepartments(participants, events, enrollmentDepartment)

    const recentEvents = recent.map((event) => ({
      id: event.id,
      type: event.type,
      participant: event.enrollment.participant.name,
      campaign: event.enrollment.campaign.name,
      template: event.enrollment.campaign.template.name,
      createdAt: event.createdAt.toISOString(),
    }))

    const campaignSummaries = campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      participantCount: campaign.enrollments.length,
      opens: campaign.enrollments.filter((e) => e.openedAt !== null).length,
      clicks: campaign.enrollments.filter((e) => e.clickedAt !== null).length,
      reports: campaign.enrollments.filter((e) => e.reportedAt !== null).length,
      launchedAt: campaign.launchedAt ? campaign.launchedAt.toISOString() : null,
    }))

    return NextResponse.json({
      totals: {
        participants: participants.length,
        consentedParticipants: participants.filter((p) => p.consented).length,
        campaigns: campaigns.length,
        runningCampaigns: campaigns.filter((c) => c.status === 'running').length,
        delivered,
        opens,
        clicks,
        reports,
      },
      rates,
      trainingCompletionRate,
      resilienceScore,
      trend,
      departments,
      recentEvents,
      campaigns: campaignSummaries,
    })
  } catch (error) {
    console.error('GET /api/stats failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
