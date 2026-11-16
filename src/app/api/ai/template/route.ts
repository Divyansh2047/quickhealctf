import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { AI_ACTOR, aiJson, withTimeout } from '@/lib/ai'
import { checkRateLimit, clientIp, rateLimitResponse } from '@/lib/rate-limit'
import { zodFirstIssueMessage } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

const AI_RATE_LIMIT = 12
const AI_RATE_WINDOW_MS = 60_000
const AI_TIMEOUT_MS = 45_000
const MAX_BODY_HTML = 4000

const bodySchema = z.object({
  scenario: z
    .string()
    .min(5, 'scenario must be at least 5 characters')
    .max(500, 'scenario must be at most 500 characters'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string().max(100).optional(),
})

// LLM output shape — parsed defensively, anything off goes to the fallback.
const llmSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  subject: z.string().min(1),
  senderName: z.string().min(1),
  senderEmail: z.string().min(1),
  bodyHtml: z.string().min(1),
  landingMessage: z.string().min(1),
  redFlags: z.array(z.string()).min(1),
  rationale: z.string().optional(),
})

// Domains that must never appear as a simulation sender (real brands).
const REAL_DOMAIN_DENYLIST = new Set([
  'google.com',
  'gmail.com',
  'microsoft.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'office365.com',
  'yahoo.com',
  'amazon.com',
  'apple.com',
  'icloud.com',
  'paypal.com',
  'netflix.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'dropbox.com',
  'adobe.com',
  'dhl.com',
  'fedex.com',
  'ups.com',
  'usps.com',
  'irs.gov',
  'gov.uk',
])

const SYSTEM_PROMPT = `You are the template designer inside PhishGuard, an AUTHORIZED security-awareness phishing simulation platform. Campaigns run only against employees who have given explicit consent, and the simulated pages never collect any data.

Hard rules:
- NEVER request real credentials, banking PINs, one-time banking codes, social-security numbers, or any genuinely sensitive data. Simulated pages collect nothing.
- Every lure brand must be fictional: use fictional companies such as "NexumTech", a fictional HR/payroll portal, a fictional parcel service, and fictional (but plausible-looking) internal teams.
- Difficulty controls subtlety: "easy" = obvious typos and an odd sender domain; "medium" = a decent imitation with 1-2 subtle red flags; "hard" = a near-perfect imitation with very subtle red flags only.
- The email body must be compact styled HTML using inline styles only. The call-to-action link must use href="#" (the platform replaces links at simulation time).
- Do NOT include any visible "[SIMULATED]" marker, disclaimer, or warning inside the email body — realism matters; the platform displays its own simulation banner around the email.
- Respond with valid JSON only, no markdown fences.`

interface TemplateDraft {
  name: string
  category: string
  difficulty: string
  subject: string
  senderName: string
  senderEmail: string
  bodyHtml: string
  landingMessage: string
  redFlags: string[]
  aiGenerated: boolean
}

/** Keep senders off real domains: append .simulation.invalid when needed. */
function sanitizeSenderEmail(email: string): string {
  let value = email.trim()
  if (!value.includes('@')) {
    value = `${value}@nexumtech-portal.simulation.invalid`
  }
  const domain = value.split('@').pop()?.toLowerCase().trim() ?? ''
  if (REAL_DOMAIN_DENYLIST.has(domain)) {
    return `${value}.simulation.invalid`
  }
  return value
}

/** Enforce href="#" for any absolute link and cap the HTML size. */
function sanitizeBodyHtml(html: string): string {
  const withoutRealLinks = html
    .replace(/href\s*=\s*"(https?:\/\/[^"]*)"/gi, 'href="#"')
    .replace(/href\s*=\s*'(https?:\/\/[^']*)'/gi, "href='#'")
  return withoutRealLinks.length > MAX_BODY_HTML
    ? `${withoutRealLinks.slice(0, MAX_BODY_HTML)}...`
    : withoutRealLinks
}

/*
 * Deterministic fallback draft, built purely from the scenario + difficulty.
 * Used whenever the LLM is unavailable or returns unparsable output, so the
 * AI Template Studio never hard-fails.
 */
function buildFallbackTemplate(
  scenario: string,
  difficulty: 'easy' | 'medium' | 'hard',
  category?: string
): { template: TemplateDraft; rationale: string } {
  const label = scenario.trim().replace(/\s+/g, ' ')
  const short = label.length > 60 ? `${label.slice(0, 57)}...` : label
  const redFlags =
    difficulty === 'easy'
      ? [
          'Sender address uses a look-alike domain with obvious typos',
          'Generic greeting with no personalization',
          'Artificial urgency: an implausible deadline',
        ]
      : difficulty === 'medium'
        ? [
            'Slightly mismatched sender domain compared to the official portal',
            'Mild urgency designed to discourage verifying the request first',
          ]
        : [
            'Display name looks internal but the actual domain differs subtly',
            'The call-to-action link target is not the official portal address',
          ]

  const template: TemplateDraft = {
    name: `Simulated lure: ${short}`,
    category: category?.trim() || 'AI Generated',
    difficulty,
    subject: `Action required: ${short}`,
    senderName: 'NexumTech Service Desk',
    senderEmail: 'no-reply@nexumtech-portal.simulation.invalid',
    bodyHtml:
      '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #d4d4d8;border-radius:8px;overflow:hidden">' +
      '<div style="background:#134e4a;color:#ffffff;padding:16px 24px;font-size:18px;font-weight:bold">NexumTech Service Desk</div>' +
      '<div style="padding:24px;color:#18181b;font-size:14px;line-height:1.6">' +
      '<p>Hello,</p>' +
      `<p>During a routine review we flagged an item related to: <strong>${short}</strong>. ` +
      'The matter must be reviewed before the end of the business day to avoid an interruption of service.</p>' +
      '<p style="margin:24px 0">' +
      '<a href="#" style="background:#134e4a;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Review the notification</a>' +
      '</p>' +
      '<p>Thank you,<br/>NexumTech IT Team</p>' +
      '</div>' +
      '</div>',
    landingMessage:
      'This was a simulated phishing email. Nothing was collected — the goal was to help you pause and verify unexpected requests before acting. When in doubt, contact the service desk through a channel you trust.',
    redFlags,
    aiGenerated: false,
  }
  const rationale = `Deterministic fallback draft: a ${difficulty}-level lure built around "${short}" that leans on urgency and apparent internal authority. It targets staff who act quickly on requests that look like they come from trusted internal teams.`
  return { template, rationale }
}

export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(`ai:${clientIp(request)}`, AI_RATE_LIMIT, AI_RATE_WINDOW_MS)
    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfterSec)
    }

    const raw: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: zodFirstIssueMessage(parsed.error) }, { status: 400 })
    }
    const { scenario, difficulty } = parsed.data
    const category = parsed.data.category?.trim() || undefined

    try {
      const userPrompt = [
        'Create one phishing-simulation email draft for the scenario below.',
        `Scenario: ${scenario}`,
        `Difficulty: ${difficulty}`,
        category ? `Category: ${category}` : null,
        '',
        'JSON shape to return:',
        '{ "name": string, "category": string, "subject": string, "senderName": string, "senderEmail": string, "bodyHtml": string (max ~4000 chars), "landingMessage": string (educational feedback shown after a simulated click), "redFlags": string[] (2-4 items), "rationale": string (1-2 sentences on the psychological hook and which groups it targets) }',
      ]
        .filter((line): line is string => line !== null)
        .join('\n')

      const draft = await withTimeout(
        aiJson<unknown>(SYSTEM_PROMPT, userPrompt),
        AI_TIMEOUT_MS,
        'AI template generation'
      )
      const validated = llmSchema.safeParse(draft)
      if (!validated.success) {
        throw new Error('AI template did not match the expected schema')
      }

      const ai = validated.data
      const cleanFlags = ai.redFlags.map((flag) => flag.trim()).filter((flag) => flag.length > 0)
      const template: TemplateDraft = {
        name: ai.name.trim(),
        category: ai.category.trim() || category || 'AI Generated',
        difficulty,
        subject: ai.subject.trim(),
        senderName: ai.senderName.trim(),
        senderEmail: sanitizeSenderEmail(ai.senderEmail),
        bodyHtml: sanitizeBodyHtml(ai.bodyHtml),
        landingMessage: ai.landingMessage.trim(),
        redFlags: cleanFlags.length > 0 ? cleanFlags : ['The message pressures you to act before verifying'],
        aiGenerated: true,
      }
      const rationale =
        ai.rationale?.trim() ||
        `${difficulty}-level lure built around the requested scenario; hook and target groups were chosen by the model.`

      await logAudit(
        'AI_TEMPLATE_GENERATED',
        AI_ACTOR,
        `AI template draft generated (${difficulty}, source: ai) for scenario: ${scenario.slice(0, 120)}`
      )

      return NextResponse.json({ template, rationale, source: 'ai', aiGenerated: true })
    } catch (aiError) {
      console.error('AI template generation fell back:', aiError)
      const { template, rationale } = buildFallbackTemplate(scenario, difficulty, category)

      await logAudit(
        'AI_TEMPLATE_GENERATED',
        AI_ACTOR,
        `AI template draft generated (${difficulty}, source: fallback) for scenario: ${scenario.slice(0, 120)}`
      )

      return NextResponse.json({ template, rationale, source: 'fallback', aiGenerated: false })
    }
  } catch (error) {
    console.error('POST /api/ai/template failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
