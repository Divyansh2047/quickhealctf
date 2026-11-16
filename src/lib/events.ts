import { db } from '@/lib/db'

export type TrackedEventType =
  | 'DELIVERED'
  | 'OPEN'
  | 'CLICK'
  | 'LANDED'
  | 'SUBMITTED'
  | 'REPORT'

export interface LiveEventPayload {
  eventId: string
  enrollmentId: string
  campaignId: string
  campaignName: string
  participantName: string
  department: string
  templateName: string
  templateCategory: string
  templateDifficulty: string
  type: TrackedEventType
  note: string | null
  createdAt: string
}

/**
 * Record a simulation tracking event for an enrollment.
 * The row is created at `at ?? now`.
 * When `broadcast` is enabled, the event is pushed to the live activity feed
 * over the WebSocket mini-service (best effort — never blocks or fails tracking).
 */
export async function recordEvent(
  enrollmentId: string,
  type: TrackedEventType,
  note?: string,
  at?: Date,
  options?: { broadcast?: boolean }
) {
  const event = await db.trackedEvent.create({
    data: {
      enrollmentId,
      type,
      note: note ?? null,
      createdAt: at ?? new Date(),
    },
  })

  if (options?.broadcast) {
    void broadcastEvent(event.id).catch(() => undefined)
  }

  return event
}

/**
 * Build the enriched live-feed payload for an event and POST it to the
 * WebSocket mini-service which fans it out to all connected dashboards.
 * Fire-and-forget: any failure is swallowed so tracking never breaks.
 */
async function broadcastEvent(eventId: string): Promise<void> {
  const event = await db.trackedEvent.findUnique({
    where: { id: eventId },
    include: {
      enrollment: {
        include: {
          campaign: { include: { template: { select: { name: true, category: true, difficulty: true } } } },
          participant: { select: { name: true, department: true } },
        },
      },
    },
  })
  if (!event) return

  const payload: LiveEventPayload = {
    eventId: event.id,
    enrollmentId: event.enrollmentId,
    campaignId: event.enrollment.campaign.id,
    campaignName: event.enrollment.campaign.name,
    participantName: event.enrollment.participant.name,
    department: event.enrollment.participant.department,
    templateName: event.enrollment.campaign.template.name,
    templateCategory: event.enrollment.campaign.template.category,
    templateDifficulty: event.enrollment.campaign.template.difficulty,
    type: event.type as TrackedEventType,
    note: event.note,
    createdAt: event.createdAt.toISOString(),
  }

  const wsUrl = process.env.LIVE_FEED_URL ?? 'http://127.0.0.1:3004/emit'
  await fetch(wsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(1500),
  })
}

/**
 * Safely parse a JSON array column (e.g. Template.redFlags, TrainingModule.redFlagTips).
 * Returns [] on missing value, malformed JSON, or non-array/non-string entries.
 */
export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}
