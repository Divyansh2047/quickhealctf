import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { asRecord, asString } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json().catch(() => null)
    const body = asRecord(raw)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const participantId = asString(body.participantId) ?? ''
    const moduleId = asString(body.moduleId) ?? ''
    if (!participantId || !moduleId) {
      return NextResponse.json({ error: 'participantId and moduleId are required' }, { status: 400 })
    }

    const participant = await db.participant.findUnique({
      where: { id: participantId },
      select: { id: true },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }
    const trainingModule = await db.trainingModule.findUnique({
      where: { id: moduleId },
      select: { id: true },
    })
    if (!trainingModule) {
      return NextResponse.json({ error: 'Training module not found' }, { status: 404 })
    }

    const completion = await db.trainingCompletion.upsert({
      where: { participantId_moduleId: { participantId, moduleId } },
      update: {},
      create: { participantId, moduleId },
    })

    return NextResponse.json({
      completion: {
        participantId: completion.participantId,
        moduleId: completion.moduleId,
        completedAt: completion.completedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('POST /api/training/complete failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
