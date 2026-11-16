import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJsonArray } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [modules, completions] = await Promise.all([
      db.trainingModule.findMany({
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { completions: true } } },
      }),
      db.trainingCompletion.findMany({
        orderBy: { completedAt: 'desc' },
        include: { participant: { select: { name: true } } },
      }),
    ])

    return NextResponse.json({
      modules: modules.map((trainingModule) => ({
        id: trainingModule.id,
        title: trainingModule.title,
        category: trainingModule.category,
        durationMin: trainingModule.durationMin,
        summary: trainingModule.summary,
        contentMd: trainingModule.contentMd,
        redFlagTips: parseJsonArray(trainingModule.redFlagTips),
        completions: trainingModule._count.completions,
      })),
      completions: completions.map((completion) => ({
        participantId: completion.participantId,
        participantName: completion.participant.name,
        moduleId: completion.moduleId,
        completedAt: completion.completedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('GET /api/training failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
