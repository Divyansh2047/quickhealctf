import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJsonArray } from '@/lib/events'
import {
  buildDepartments,
  buildTrend,
  computeRates,
  computeResilienceScore,
  pct,
  readRetentionPolicy,
  type TrendPoint,
} from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [participants, campaigns, enrollments, events, modules, completions, retention] =
      await Promise.all([
        db.participant.findMany(),
        db.campaign.findMany({ include: { template: true, enrollments: true } }),
        db.enrollment.findMany({ include: { participant: { select: { department: true } } } }),
        db.trackedEvent.findMany(),
        db.trainingModule.findMany(),
        db.trainingCompletion.findMany(),
        readRetentionPolicy(),
      ])

    const delivered = events.filter((event) => event.type === 'DELIVERED').length
    const opens = events.filter((event) => event.type === 'OPEN').length
    const clicks = events.filter((event) => event.type === 'CLICK').length
    const reports = events.filter((event) => event.type === 'REPORT').length

    const rates = computeRates(delivered, opens, clicks, reports)
    const consentedActiveCount = participants.filter((p) => p.consented && p.active).length
    const trainingCompletions = completions.length
    const trainingCompletionRate = pct(trainingCompletions, consentedActiveCount * modules.length)
    const resilienceScore = computeResilienceScore(
      rates.clickRate,
      rates.reportRate,
      trainingCompletionRate
    )

    const overall = {
      participants: participants.length,
      consentedParticipants: participants.filter((p) => p.consented).length,
      delivered,
      opens,
      clicks,
      reports,
      openRate: rates.openRate,
      clickRate: rates.clickRate,
      reportRate: rates.reportRate,
      resilienceScore,
      trainingCompletionRate,
      trainingCompletions,
    }

    const trend: TrendPoint[] = buildTrend(events)

    const launchedCampaigns = campaigns.filter((campaign) => campaign.launchedAt !== null)
    launchedCampaigns.sort((a, b) => {
      const aTime = a.launchedAt ? a.launchedAt.getTime() : 0
      const bTime = b.launchedAt ? b.launchedAt.getTime() : 0
      return bTime - aTime
    })

    const reportCampaigns = launchedCampaigns.map((campaign) => {
      const campaignDelivered = campaign.enrollments.filter((e) => e.deliveredAt !== null).length
      const campaignOpens = campaign.enrollments.filter((e) => e.openedAt !== null).length
      const campaignClicks = campaign.enrollments.filter((e) => e.clickedAt !== null).length
      const campaignReports = campaign.enrollments.filter((e) => e.reportedAt !== null).length
      return {
        name: campaign.name,
        status: campaign.status,
        launchedAt: campaign.launchedAt ? campaign.launchedAt.toISOString() : '',
        completedAt: campaign.completedAt ? campaign.completedAt.toISOString() : null,
        participantCount: campaign.enrollments.length,
        delivered: campaignDelivered,
        opens: campaignOpens,
        clicks: campaignClicks,
        reports: campaignReports,
        clickRate: pct(campaignClicks, campaignDelivered),
        reportRate: pct(campaignReports, campaignDelivered),
      }
    })

    const enrollmentDepartment = new Map<string, string>(
      enrollments.map((enrollment): [string, string] => [
        enrollment.id,
        enrollment.participant.department,
      ])
    )
    const departments = buildDepartments(participants, events, enrollmentDepartment)

    // Red flags of templates used by running/completed campaigns,
    // counted once per campaign using that template.
    const flagCounts = new Map<string, number>()
    for (const campaign of campaigns) {
      if (campaign.status !== 'running' && campaign.status !== 'completed') continue
      for (const flag of new Set(parseJsonArray(campaign.template.redFlags))) {
        flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1)
      }
    }
    const topRedFlags = [...flagCounts.entries()]
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count || a.flag.localeCompare(b.flag))
      .slice(0, 8)

    // Data-driven recommendations (max 4 conditional + 2 always-on).
    const unconsentedCount = participants.filter((p) => !p.consented).length
    const conditional: string[] = []
    if (rates.clickRate > 30) {
      conditional.push(
        'Click rates above 30% indicate urgency-based lures are still effective — schedule the "Urgency & Pressure Tactics" module for all departments.'
      )
    }
    if (rates.reportRate < 25) {
      conditional.push(
        'Reporting rates below 25% show suspicious emails are going unreported — reinforce the "Spot & Report Phishing" module in your next security briefing.'
      )
    }
    for (const department of departments) {
      if (department.clickRate > 50) {
        conditional.push(
          `${department.department} shows elevated click susceptibility — assign targeted micro-training.`
        )
      }
    }
    if (trainingCompletionRate < 70) {
      conditional.push(
        'Training completion is below 70% — block calendar time this week and send reminders to participants with outstanding modules.'
      )
    }
    if (unconsentedCount > 0) {
      conditional.push(
        `${unconsentedCount} participant(s) have not yet granted consent — follow up before including them in future simulations.`
      )
    }
    const recommendations = [
      ...conditional.slice(0, 4),
      'All analytics are aggregated; individual simulation results are visible only to program administrators for coaching purposes.',
      `Event data is auto-purged after the configured retention window (currently ${retention.defaultRetentionDays} days).`,
    ]

    const report = {
      generatedAt: new Date().toISOString(),
      overall,
      trend,
      campaigns: reportCampaigns,
      departments,
      topRedFlags,
      recommendations,
      privacy: {
        credentialCollection: false,
        realEmailDelivery: false,
        individualScoresAnonymous: true,
        defaultRetentionDays: retention.defaultRetentionDays,
        autoPurge: retention.autoPurge,
      },
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('GET /api/analytics/report failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
