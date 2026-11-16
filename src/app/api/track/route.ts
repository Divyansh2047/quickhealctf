import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recordEvent } from '@/lib/events'
import { asRecord, asString } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['OPEN', 'CLICK', 'REPORT'] as const
type TrackType = (typeof VALID_TYPES)[number]

function serializeEnrollmentTimestamps(enrollment: {
  id: string
  openedAt: Date | null
  clickedAt: Date | null
  reportedAt: Date | null
}) {
  return {
    id: enrollment.id,
    openedAt: enrollment.openedAt ? enrollment.openedAt.toISOString() : null,
    clickedAt: enrollment.clickedAt ? enrollment.clickedAt.toISOString() : null,
    reportedAt: enrollment.reportedAt ? enrollment.reportedAt.toISOString() : null,
  }
}

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json().catch(() => null)
    const body = asRecord(raw)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const enrollmentId = asString(body.enrollmentId) ?? ''
    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 })
    }
    const type = asString(body.type) ?? ''
    if (!(VALID_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
    }
    const trackType = type as TrackType

    const enrollment = await db.enrollment.findUnique({ where: { id: enrollmentId } })
    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }
    if (!enrollment.deliveredAt) {
      return NextResponse.json({ error: 'Email not yet delivered in simulation' }, { status: 400 })
    }

    const note = asString(body.note)
    const now = new Date()

    if (trackType === 'OPEN') {
      if (enrollment.openedAt) {
        return NextResponse.json({
          already: true,
          enrollment: serializeEnrollmentTimestamps(enrollment),
        })
      }
      const updated = await db.enrollment.update({
        where: { id: enrollmentId },
        data: { openedAt: now },
      })
      const event = await recordEvent(enrollmentId, 'OPEN', note)
      return NextResponse.json({
        already: false,
        event: {
          id: event.id,
          type: event.type,
          createdAt: event.createdAt.toISOString(),
          note: event.note,
        },
        enrollment: serializeEnrollmentTimestamps(updated),
      })
    }

    if (trackType === 'CLICK') {
      if (enrollment.clickedAt) {
        return NextResponse.json({
          already: true,
          enrollment: serializeEnrollmentTimestamps(enrollment),
        })
      }
      const data: { clickedAt: Date; openedAt?: Date } = { clickedAt: now }
      if (!enrollment.openedAt) {
        // A click implies the simulated email was opened.
        data.openedAt = now
      }
      const updated = await db.enrollment.update({ where: { id: enrollmentId }, data })
      if (!enrollment.openedAt) {
        await recordEvent(enrollmentId, 'OPEN', note)
      }
      const event = await recordEvent(enrollmentId, 'CLICK', note)
      return NextResponse.json({
        already: false,
        event: {
          id: event.id,
          type: event.type,
          createdAt: event.createdAt.toISOString(),
          note: event.note,
        },
        enrollment: serializeEnrollmentTimestamps(updated),
      })
    }

    // REPORT
    if (enrollment.reportedAt) {
      return NextResponse.json({
        already: true,
        enrollment: serializeEnrollmentTimestamps(enrollment),
      })
    }
    const updated = await db.enrollment.update({
      where: { id: enrollmentId },
      data: { reportedAt: now },
    })
    const event = await recordEvent(enrollmentId, 'REPORT', note ?? 'Reported via simulated inbox')
    return NextResponse.json({
      already: false,
      event: {
        id: event.id,
        type: event.type,
        createdAt: event.createdAt.toISOString(),
        note: event.note,
      },
      enrollment: serializeEnrollmentTimestamps(updated),
    })
  } catch (error) {
    console.error('POST /api/track failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
