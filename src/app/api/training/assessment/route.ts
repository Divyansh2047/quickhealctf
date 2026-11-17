import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canActFor } from '@/lib/participant-access'
import { questionsFor } from '@/lib/learning'
import { z } from 'zod'
const schema = z.object({ participantId: z.string().min(1), moduleId: z.string().min(1), phase: z.enum(['baseline','followup']), answers: z.array(z.number().int().min(0).max(2)).length(2).optional() }).strict()
export async function POST(request: Request) {
 const parsed = schema.safeParse(await request.json().catch(() => null))
 if (!parsed.success) return NextResponse.json({ error: 'Invalid assessment request' }, { status: 400 })
 const { participantId, moduleId, phase, answers } = parsed.data
 if (!await canActFor(participantId)) return NextResponse.json({ error: 'Participation not authorized' }, { status: 403 })
 const lesson = await db.trainingModule.findUnique({ where: { id: moduleId } })
 if (!lesson) return NextResponse.json({ error: 'Module not found' }, { status: 404 })
 if (phase === 'followup' && !await db.trainingAttempt.findFirst({ where: { participantId, moduleId, phase: 'baseline' } })) return NextResponse.json({ error: 'Complete the baseline first' }, { status: 409 })
 const questions = questionsFor(lesson.title, phase)
 if (!answers) return NextResponse.json({ questions: questions.map(({ question, options }) => ({ question, options })) })
 const score = questions.reduce((n, q, i) => n + Number(q.answer === answers[i]), 0)
 const attempt = await db.$transaction(async tx => {
  // Baseline is immutable for this learning cycle; refreshes cannot inflate gain.
  if (phase === 'baseline') {
   const previous = await tx.trainingAttempt.findFirst({ where: { participantId, moduleId, phase }, orderBy: { createdAt: 'asc' } })
   if (previous) return previous
  }
  const a = await tx.trainingAttempt.create({ data: { participantId, moduleId, phase, score, total: questions.length } })
  if (phase === 'followup' && score === questions.length) await tx.trainingCompletion.upsert({ where: { participantId_moduleId: { participantId, moduleId } }, update: {}, create: { participantId, moduleId } })
  return a
 })
 return NextResponse.json({ score: attempt.score, total: attempt.total, passed: attempt.score === attempt.total, explanations: questions.map(q => q.explanation) })
}
