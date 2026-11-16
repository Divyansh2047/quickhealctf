import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recordEvent } from '@/lib/events'
import { checkRateLimit, clientIp, rateLimitResponse } from '@/lib/rate-limit'
import { asRecord, asString } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

// DELIVERED is an internal stage (set at campaign launch) and is never
// accepted from the outside; everything else follows the 6-stage lifecycle.
const VALID_TYPES = ['OPEN', 'CLICK', 'LANDED', 'SUBMITTED', 'REPORT'] as const
type TrackType = (typeof VALID_TYPES)[number]

const TRACK_RATE_LIMIT = 120
const TRACK_RATE_WINDOW_MS = 60_000

const PRIVACY_NOTE = 'Input values are never transmitted or stored by this platform.'
const CREDENTIALS_REJECT_MESSAGE =
  'Credential submission is not accepted. This simulation never collects credentials.'

function serializeEnrollmentTimestamps(enrollment: {
  id: string
  openedAt: Date | null
  clickedAt: Date | null
  landedAt: Date | null
  submittedAt: Date | null
  reportedAt: Date | null
}) {
  return {
    id: enrollment.id,
    openedAt: enrollment.openedAt ? enrollment.openedAt.toISOString() : null,
    clickedAt: enrollment.clickedAt ? enrollment.clickedAt.toISOString() : null,
    landedAt: enrollment.landedAt ? enrollment.landedAt.toISOString() : null,
    submittedAt: enrollment.submittedAt ? enrollment.submittedAt.toISOString() : null,
    reportedAt: enrollment.reportedAt ? enrollment.reportedAt.toISOString() : null,
  }
}

export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(`track:${clientIp(request)}`, TRACK_RATE_LIMIT, TRACK_RATE_WINDOW_MS)
    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfterSec)
    }

    const raw: unknown = await request.json().catch(() => null)
    const body = asRecord(raw)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Privacy guard: the simulated phishing page never sends input values.
    // Reject any payload that tries to smuggle credentials-like fields.
    if ('credentials' in body || 'username' in body || 'password' in body) {
      return NextResponse.json({ error: CREDENTIALS_REJECT_MESSAGE }, { status: 400 })
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
      const event = await recordEvent(enrollmentId, 'OPEN', note, undefined, { broadcast: true })
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
        await recordEvent(enrollmentId, 'OPEN', note, undefined, { broadcast: true })
      }
      const event = await recordEvent(enrollmentId, 'CLICK', note, undefined, { broadcast: true })
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

    if (trackType === 'LANDED') {
      if (enrollment.landedAt) {
        return NextResponse.json({
          already: true,
          enrollment: serializeEnrollmentTimestamps(enrollment),
        })
      }
      // Reaching the simulated phishing page implies the email was opened and
      // the link clicked — mirror the implied-stage logic used by CLICK.
      const data: { landedAt: Date; clickedAt?: Date; openedAt?: Date } = { landedAt: now }
      if (!enrollment.clickedAt) {
        data.clickedAt = now
        if (!enrollment.openedAt) {
          data.openedAt = now
        }
      }
      const updated = await db.enrollment.update({ where: { id: enrollmentId }, data })
      if (!enrollment.openedAt) {
        await recordEvent(enrollmentId, 'OPEN', note, undefined, { broadcast: true })
      }
      if (!enrollment.clickedAt) {
        await recordEvent(enrollmentId, 'CLICK', note, undefined, { broadcast: true })
      }
      const event = await recordEvent(enrollmentId, 'LANDED', note, undefined, { broadcast: true })
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

    if (trackType === 'SUBMITTED') {
      if (enrollment.submittedAt) {
        return NextResponse.json({
          already: true,
          enrollment: serializeEnrollmentTimestamps(enrollment),
          credentialsStored: false,
          note: PRIVACY_NOTE,
        })
      }
      // Entering credentials on the simulated page implies the full funnel
      // (open -> click -> land) happened first. The values themselves are
      // never transmitted to or stored by this platform.
      const data: { submittedAt: Date; landedAt?: Date; clickedAt?: Date; openedAt?: Date } = {
        submittedAt: now,
      }
      if (!enrollment.landedAt) {
        data.landedAt = now
      }
      if (!enrollment.clickedAt) {
        data.clickedAt = now
        if (!enrollment.openedAt) {
          data.openedAt = now
        }
      }
      const updated = await db.enrollment.update({ where: { id: enrollmentId }, data })
      if (!enrollment.openedAt) {
        await recordEvent(enrollmentId, 'OPEN', note, undefined, { broadcast: true })
      }
      if (!enrollment.clickedAt) {
        await recordEvent(enrollmentId, 'CLICK', note, undefined, { broadcast: true })
      }
      if (!enrollment.landedAt) {
        await recordEvent(enrollmentId, 'LANDED', note, undefined, { broadcast: true })
      }
      const event = await recordEvent(enrollmentId, 'SUBMITTED', note, undefined, {
        broadcast: true,
      })
      return NextResponse.json({
        already: false,
        event: {
          id: event.id,
          type: event.type,
          createdAt: event.createdAt.toISOString(),
          note: event.note,
        },
        enrollment: serializeEnrollmentTimestamps(updated),
        credentialsStored: false,
        note: PRIVACY_NOTE,
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
    const event = await recordEvent(
      enrollmentId,
      'REPORT',
      note ?? 'Reported via simulated inbox',
      undefined,
      { broadcast: true }
    )
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
