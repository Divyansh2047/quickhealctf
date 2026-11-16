import { db } from '@/lib/db'

export type TrackedEventType = 'DELIVERED' | 'OPEN' | 'CLICK' | 'REPORT'

/**
 * Record a simulation tracking event for an enrollment.
 * The row is created at `at ?? now`.
 */
export async function recordEvent(
  enrollmentId: string,
  type: TrackedEventType,
  note?: string,
  at?: Date
) {
  return db.trackedEvent.create({
    data: {
      enrollmentId,
      type,
      note: note ?? null,
      createdAt: at ?? new Date(),
    },
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
