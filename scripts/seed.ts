/**
 * PhishGuard — Seed script
 * Creates a rich, realistic demo dataset: participants, templates,
 * campaigns with a month of tracked events, training, compliance records.
 * Run: bun run scripts/seed.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const day = (n: number, hourOffset = 0, minOffset = 0) =>
  new Date(Date.now() - n * 24 * 3600 * 1000 + hourOffset * 3600 * 1000 + minOffset * 60 * 1000)

const J = (arr: string[]) => JSON.stringify(arr)

function emailShell(headerColor: string, headerTitle: string, inner: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:${headerColor};padding:14px 20px;color:#ffffff;border-radius:8px 8px 0 0;">
    <div style="font-size:17px;font-weight:bold;">${headerTitle}</div>
  </div>
  <div style="padding:22px 24px;border:1px solid #d8d8d8;border-top:none;border-radius:0 0 8px 8px;background:#ffffff;color:#2b2b2b;font-size:14px;line-height:1.55;">
    ${inner}
  </div>
  <div style="margin-top:10px;font-size:11px;color:#999;text-align:center;">SIMULATION — controlled test environment. No real credentials are collected.</div>
</div>`
}

const btn = (label: string) =>
  `<a href="#" data-simulated="link" style="display:inline-block;background:#c0392b;color:#ffffff;padding:11px 26px;text-decoration:none;border-radius:5px;font-weight:bold;">${label}</a>`

async function main() {
  console.log('Clearing existing data...')
  await db.auditLog.deleteMany()
  await db.trackedEvent.deleteMany()
  await db.enrollment.deleteMany()
  await db.campaign.deleteMany()
  await db.trainingCompletion.deleteMany()
  await db.trainingModule.deleteMany()
  await db.template.deleteMany()
  await db.participant.deleteMany()
  await db.allowedDomain.deleteMany()
  await db.setting.deleteMany()

  // ---------------- Settings ----------------
  await db.setting.createMany({
    data: [
      { key: 'defaultRetentionDays', value: '90' },
      { key: 'autoPurge', value: 'true' },
    ],
  })

  // ---------------- Allowed sender domains ----------------
  await db.allowedDomain.createMany({
    data: [
      { domain: 'mail.securelab.test', approvedBy: 'security.admin@acme-corp.test', createdAt: day(60) },
      { domain: 'notifications.acme-corp.test', approvedBy: 'security.admin@acme-corp.test', createdAt: day(60) },
      { domain: 'hr-benefits.acme-corp.test', approvedBy: 'security.admin@acme-corp.test', createdAt: day(60) },
      { domain: 'billing.acme-vendor.test', approvedBy: 'security.admin@acme-corp.test', createdAt: day(45) },
    ],
  })

  // ---------------- Participants ----------------
  const people: {
    name: string
    email: string
    department: string
    consented?: boolean
  }[] = [
    { name: 'Priya Nair', email: 'priya.nair@acme-corp.test', department: 'Finance' },
    { name: 'Marcus Chen', email: 'marcus.chen@acme-corp.test', department: 'Finance' },
    { name: 'Elena Petrova', email: 'elena.petrova@acme-corp.test', department: 'Finance' },
    { name: 'Arjun Mehta', email: 'arjun.mehta@acme-corp.test', department: 'Engineering' },
    { name: 'Sofia Rossi', email: 'sofia.rossi@acme-corp.test', department: 'Engineering' },
    { name: 'David Kim', email: 'david.kim@acme-corp.test', department: 'Engineering' },
    { name: 'Grace Wanjiru', email: 'grace.wanjiru@acme-corp.test', department: 'HR' },
    { name: 'Hannah Lee', email: 'hannah.lee@acme-corp.test', department: 'Marketing' },
    { name: 'Omar Farouk', email: 'omar.farouk@acme-corp.test', department: 'Marketing' },
    { name: 'Ingrid Svensson', email: 'ingrid.svensson@acme-corp.test', department: 'Operations' },
    // Two people have NOT consented -> used to demonstrate the authorization gate
    { name: 'Tomás Alvarez', email: 'tomas.alvarez@acme-corp.test', department: 'HR', consented: false },
    { name: 'Kenji Tanaka', email: 'kenji.tanaka@acme-corp.test', department: 'Operations', consented: false },
  ]

  const participants: Record<string, { id: string }> = {}
  for (const p of people) {
    const row = await db.participant.create({
      data: {
        name: p.name,
        email: p.email,
        department: p.department,
        consented: p.consented ?? true,
        consentedAt: p.consented ?? true ? day(58) : null,
        active: true,
        createdAt: day(59),
      },
    })
    participants[p.name] = row
  }

  // ---------------- Templates ----------------
  const tPassword = await db.template.create({
    data: {
      name: 'Password Expiry Alert',
      category: 'Credential Harvesting (simulated)',
      difficulty: 'easy',
      subject: 'Action required: your password expires today',
      senderName: 'Microsoft 365 Security',
      senderEmail: 'security@mail.securelab.test',
      landingMessage:
        'You clicked a simulated credential-harvesting link. Real attacks like this lead to a fake sign-in page that steals your password. Always reach login portals by typing the known address yourself or using your company SSO bookmark.',
      redFlags: J([
        'Urgent deadline pressure ("expires today")',
        'Generic greeting — no personalization',
        'Sender domain is look-alike, not your real tenant domain',
        'Button leads to a non-SSO page asking for credentials',
      ]),
      bodyHtml: emailShell(
        '#2b5797',
        'Microsoft 365',
        `<p>Dear User,</p>
        <p>Your password will <b>expire within 24 hours</b>. To avoid losing access to your work email and files, you must renew it now.</p>
        <p style="margin:22px 0;">${btn('Renew password now')}</p>
        <p>If you do not act today, your account will be <b>locked automatically</b>.</p>
        <p>IT Service Desk<br/>AcmeCorp</p>`
      ),
      isBuiltIn: true,
      createdAt: day(55),
    },
  })

  const tInvoice = await db.template.create({
    data: {
      name: 'Overdue Invoice Payment',
      category: 'Invoice Fraud',
      difficulty: 'easy',
      subject: 'Invoice #4471 — payment overdue, final notice',
      senderName: 'BrightPath Billing',
      senderEmail: 'accounts@billing.acme-vendor.test',
      landingMessage:
        'This simulated invoice scam is a classic payment-fraud attempt. Fraudsters impersonate vendors with overdue notices and changed bank details. Always verify payment changes through a known contact — never using details inside the email.',
      redFlags: J([
        'Threatening "final notice" language',
        'Bank details changed in the email body',
        'Vendor domain not in your approved vendor list',
        'Pressure to act before month-end close',
      ]),
      bodyHtml: emailShell(
        '#6d4c9f',
        'BrightPath Solutions — Accounts',
        `<p>Hello,</p>
        <p>Our records show invoice <b>#4471 ($2,480.00)</b> is now <b>14 days overdue</b>. This is our final notice before the account is escalated to collections.</p>
        <p><b>Note:</b> our bank details changed this month — please use the updated account in the attached remittance advice.</p>
        <p style="margin:22px 0;">${btn('Review invoice & pay')}</p>
        <p>Kind regards,<br/>Accounts Receivable</p>`
      ),
      isBuiltIn: true,
      createdAt: day(50),
    },
  })

  const tPayroll = await db.template.create({
    data: {
      name: 'Payroll Verification Request',
      category: 'Credential Harvesting (simulated)',
      difficulty: 'medium',
      subject: 'Payroll profile verification required — salary on hold',
      senderName: 'AcmeCorp HR Operations',
      senderEmail: 'hr-alerts@notifications.acme-corp.test',
      landingMessage:
        'You clicked a simulated payroll-verification phish. Notice the manufactured consequence ("salary on hold") — attackers pair urgency with a financial stake. HR never verifies identity through links in email. When in doubt, open the HR portal from your bookmark.',
      redFlags: J([
        'Salary suspension threat creates fear',
        "Sender domain 'notifications.acme-corp.test' is not the real HR domain",
        'No employee ID or ticket reference',
        'Link does not match the official HR portal URL',
      ]),
      bodyHtml: emailShell(
        '#00838f',
        'AcmeCorp HR Portal',
        `<p>Dear Employee,</p>
        <p>Our records indicate your payroll profile requires <b>immediate verification</b> for deposits to continue without interruption.</p>
        <p style="margin:22px 0;">${btn('Verify payroll account')}</p>
        <p>This link expires in <b>24 hours</b>. Unverified profiles will have the next salary run <b>suspended</b>.</p>
        <p>HR Operations Team<br/>AcmeCorp</p>`
      ),
      isBuiltIn: true,
      createdAt: day(40),
    },
  })

  const tLayoff = await db.template.create({
    data: {
      name: 'Confidential Org Changes',
      category: 'Curiosity / Confidential Data',
      difficulty: 'hard',
      subject: 'RE: Confidential — Q4 org changes & affected roles',
      senderName: 'Grace Wanjiru (HR)',
      senderEmail: 'grace.wanjiru@hr-benefits.acme-corp.test',
      landingMessage:
        'Curiosity is one of the most exploited emotions in phishing. A "confidential" attachment about layoffs is bait engineered to bypass your judgment. Confirm sensitive HR communications through an internal, verified channel — and never open unexpected attachments.',
      redFlags: J([
        'Exploits curiosity and anxiety about layoffs',
        'Reply-to domain differs from the real internal HR domain',
        'Unexpected attachment with a double extension',
        'Thread-like "RE:" subject with no original email',
      ]),
      bodyHtml: emailShell(
        '#455a64',
        'HR — Confidential Correspondence',
        `<p>Hi,</p>
        <p>As discussed in the leadership call, the preliminary <b>Q4 org changes</b> are below. This list is not public — please keep it confidential until comms goes out.</p>
        <p style="margin:22px 0;">${btn('Open confidential document')}</p>
        <p>Please do not forward this message.</p>
        <p>Grace<br/>People Operations</p>`
      ),
      isBuiltIn: true,
      createdAt: day(35),
    },
  })

  const tPackage = await db.template.create({
    data: {
      name: 'Failed Delivery Notification',
      category: 'Consumer Scam',
      difficulty: 'easy',
      subject: 'Your package could not be delivered — reschedule now',
      senderName: 'ExpressParcel',
      senderEmail: 'notice@mail.securelab.test',
      landingMessage:
        'Delivery-scam phishes exploit the expectation of an incoming parcel. The "small redelivery fee" is where real attackers harvest card details. Check the carrier app or website directly instead of clicking email links.',
      redFlags: J([
        'You were not expecting a parcel at work',
        'Requests a small "redelivery fee" (card harvesting)',
        'Carrier branding but mismatched sender domain',
        'Artificial deadline to reschedule',
      ]),
      bodyHtml: emailShell(
        '#d84315',
        'ExpressParcel — Delivery Notice',
        `<p>Notification for: Employee,</p>
        <p>We attempted delivery of parcel <b>EX-8842190</b> today, but nobody was available. Your parcel is held at the local depot.</p>
        <p>A <b>$1.99 redelivery fee</b> applies to reschedule.</p>
        <p style="margin:22px 0;">${btn('Reschedule delivery')}</p>
        <p>Thank you,<br/>ExpressParcel Team</p>`
      ),
      isBuiltIn: true,
      createdAt: day(30),
    },
  })

  const tWire = await db.template.create({
    data: {
      name: 'Urgent Executive Wire Transfer',
      category: 'CEO Fraud / BEC',
      difficulty: 'hard',
      subject: 'Re: urgent — confidential acquisition payment',
      senderName: 'Daniel Osei, CEO',
      senderEmail: 'd.osei.ceo@notifications.acme-corp.test',
      landingMessage:
        'Executive impersonation (BEC) causes the largest financial losses of any phishing type. Real CEOs do not request secret wire transfers over email. Verify any payment request via a live call to a known number — even if the message appears to come from leadership.',
      redFlags: J([
        'Authority pressure from "the CEO"',
        'Requests secrecy ("keep this between us")',
        'Look-alike sender domain',
        'Unusual payment channel outside normal finance process',
      ]),
      bodyHtml: emailShell(
        '#37474f',
        'Executive Office',
        `<p>I'm boarding a flight — short on time.</p>
        <p>We are closing a confidential acquisition. I need Finance to initiate a <b>$48,000 wire</b> to the escrow account I forwarded earlier. <b>Keep this between us</b> until the announcement.</p>
        <p style="margin:22px 0;">${btn('Open payment instructions')}</p>
        <p>— Daniel</p>`
      ),
      isBuiltIn: true,
      createdAt: day(25),
    },
  })

  // ---------------- Campaigns ----------------
  // Stage offsets relative to the click day: landed = click +5 min, submitted = click +17 min.
  type Outcome = {
    who: string
    delivered: number
    open?: number
    click?: number
    landed?: boolean // simulated phishing page rendered after the click
    submitted?: boolean // credentials typed on the simulated page (values discarded, never stored)
    report?: number
  }
  const enroll = async (campaignId: string, outcomes: Outcome[]) => {
    for (const o of outcomes) {
      const didLand = o.landed === true && o.click !== undefined
      const didSubmit = o.submitted === true && didLand
      const e = await db.enrollment.create({
        data: {
          campaignId,
          participantId: participants[o.who].id,
          deliveredAt: day(o.delivered, 9, 15),
          openedAt: o.open !== undefined ? day(o.open, 11, 30) : null,
          clickedAt: o.click !== undefined ? day(o.click, 13, 45) : null,
          landedAt: didLand ? day(o.click as number, 13, 50) : null,
          submittedAt: didSubmit ? day(o.click as number, 14, 2) : null,
          reportedAt: o.report !== undefined ? day(o.report, 15, 10) : null,
          createdAt: day(o.delivered, 9, 14),
        },
      })
      const evs: { type: string; at: Date; note?: string }[] = [
        { type: 'DELIVERED', at: day(o.delivered, 9, 15) },
      ]
      if (o.open !== undefined) evs.push({ type: 'OPEN', at: day(o.open, 11, 30) })
      if (o.click !== undefined) evs.push({ type: 'CLICK', at: day(o.click, 13, 45) })
      if (didLand)
        evs.push({
          type: 'LANDED',
          at: day(o.click as number, 13, 50),
          note: 'Simulated phishing page rendered',
        })
      if (didSubmit)
        evs.push({
          type: 'SUBMITTED',
          at: day(o.click as number, 14, 2),
          note: 'Credentials entered on simulated page — input values discarded, never stored',
        })
      if (o.report !== undefined)
        evs.push({
          type: 'REPORT',
          at: day(o.report, 15, 10),
          note:
            o.click !== undefined
              ? 'Reported after clicking — good recovery!'
              : 'Reported before clicking — ideal behaviour!',
        })
      for (const ev of evs) {
        await db.trackedEvent.create({
          data: { enrollmentId: e.id, type: ev.type, note: ev.note, createdAt: ev.at },
        })
      }
    }
  }

  // Campaign 1 — completed, 32 days ago (easy)
  const c1 = await db.campaign.create({
    data: {
      name: 'Q3 Password Expiry Drill',
      description:
        'Baseline awareness drill targeting Finance, Engineering and Operations with a classic password-expiry lure.',
      status: 'completed',
      templateId: tPassword.id,
      retentionDays: 90,
      launchedAt: day(32, 9, 15),
      completedAt: day(28),
      createdAt: day(34),
    },
  })
  await enroll(c1.id, [
    { who: 'Priya Nair', delivered: 32, open: 32, click: 31, landed: true, submitted: true },
    { who: 'Marcus Chen', delivered: 32, open: 32, click: 31, landed: true, submitted: true, report: 30 },
    { who: 'Elena Petrova', delivered: 32, open: 31, report: 31 },
    { who: 'Arjun Mehta', delivered: 32, open: 33 },
    { who: 'Sofia Rossi', delivered: 32, open: 32, click: 30, landed: true },
    { who: 'David Kim', delivered: 32, open: 31, report: 29 },
    { who: 'Ingrid Svensson', delivered: 32 },
  ])

  // Campaign 2 — completed, 14 days ago (easy)
  const c2 = await db.campaign.create({
    data: {
      name: 'Q4 Invoice Fraud Drill',
      description: 'Vendor invoice-fraud simulation for Finance and Operations ahead of month-end close.',
      status: 'completed',
      templateId: tInvoice.id,
      retentionDays: 90,
      launchedAt: day(14, 9, 0),
      completedAt: day(10),
      createdAt: day(16),
    },
  })
  await enroll(c2.id, [
    { who: 'Priya Nair', delivered: 14, open: 14, report: 14 },
    { who: 'Marcus Chen', delivered: 14, open: 14, click: 13, landed: true },
    { who: 'Elena Petrova', delivered: 14, open: 13, report: 13 },
    { who: 'Ingrid Svensson', delivered: 14, open: 14 },
    { who: 'Hannah Lee', delivered: 14, open: 13, click: 12, landed: true, submitted: true, report: 12 },
  ])

  // Campaign 3 — RUNNING, launched 5 days ago, partial activity (live demo target)
  const c3 = await db.campaign.create({
    data: {
      name: 'Q4 Payroll Verification Drill',
      description:
        'Running drill: payroll-verification lure for Finance, HR and Marketing. Live training moment on click.',
      status: 'running',
      templateId: tPayroll.id,
      retentionDays: 90,
      launchedAt: day(5, 9, 0),
      createdAt: day(6),
    },
  })
  await enroll(c3.id, [
    { who: 'Priya Nair', delivered: 5, open: 5, click: 4, landed: true, submitted: true },
    { who: 'Marcus Chen', delivered: 5, open: 4, click: 4, landed: true },
    { who: 'Grace Wanjiru', delivered: 5, open: 4, report: 3 },
    { who: 'Elena Petrova', delivered: 5, open: 3, report: 2 },
    { who: 'Hannah Lee', delivered: 5, open: 5 },
    { who: 'Omar Farouk', delivered: 5 },
  ])

  // Campaign 4 — DRAFT, includes a NON-CONSENTED participant (authorization gate demo)
  const c4 = await db.campaign.create({
    data: {
      name: 'Q1 Confidential Data Test',
      description: 'Planned curiosity-driven drill with a hard-difficulty lure. Pending authorization review.',
      status: 'draft',
      templateId: tLayoff.id,
      retentionDays: 90,
      createdAt: day(2),
    },
  })
  for (const who of ['Grace Wanjiru', 'Tomás Alvarez', 'Arjun Mehta', 'David Kim']) {
    await db.enrollment.create({
      data: { campaignId: c4.id, participantId: participants[who].id },
    })
  }

  const tEsign = await db.template.create({
    data: {
      name: 'AI Studio — E-Signature Request',
      category: 'Credential Harvesting (simulated)',
      difficulty: 'hard',
      subject: 'eSign: "Offer Letter — Senior Analyst role" awaits your signature',
      senderName: 'NexumTech People Team via SignFlow',
      senderEmail: 'signflow-noreply@notifications.acme-corp.test',
      landingMessage:
        'AI-crafted hard-difficulty lure: it references a plausible internal process and a real-looking document portal. The tells are subtle — the portal domain is not the approved vendor domain, and the message creates curiosity pressure with an attachment-like button. Verify signing requests in the HR system directly.',
      redFlags: J([
        'Very subtle: sender domain differs from the approved vendor list',
        'Curiosity pressure — a confidential "offer letter" you were not expecting',
        'Login required before viewing the document (classic harvest pattern)',
        'No internal ticket or reference number',
      ]),
      bodyHtml: emailShell(
        '#4a148c',
        'SignFlow · Document Portal',
        `<p>Hi,</p>
        <p><b>"Offer Letter — Senior Analyst (Fin-2025-118)"</b> is waiting for your e-signature. The document will be archived after 72 hours.</p>
        <p style="margin:22px 0;">${btn('Review &amp; sign document')}</p>
        <p>You may be asked to sign in with your work account to view the document.</p>
        <p>SignFlow for NexumTech · People Team</p>`
      ),
      isBuiltIn: false,
      aiGenerated: true,
      createdAt: day(3),
    },
  })

  // ---------------- Training modules ----------------
  const modules = [
    {
      title: 'Spotting Phishing Red Flags',
      category: 'Foundations',
      durationMin: 5,
      summary: 'Learn the universal warning signs present in nearly every phishing attempt.',
      contentMd: `## Why this matters
Phishing is the #1 initial access vector in real breaches. Most attacks fail not because of technology, but because **one alert human** noticed something off.

## The big four red flags
1. **Urgency & pressure** — "expires today", "final notice", "account will be suspended".
2. **Authority or fear** — fake executives, fake IT, fake HR, threats of consequences.
3. **Mismatched details** — sender domain look-alikes, links that don't match the text, generic greetings.
4. **Unusual requests** — payments outside process, confidential attachments you didn't expect.

## The 10-second habit
Before clicking anything: **Stop. Inspect the sender. Hover the link. Ask: was I expecting this?**

## Golden rule
No legitimate organization punishes you for verifying through an official channel. When in doubt, report it.`,
      redFlagTips: J(['Urgency', 'Authority', 'Mismatched details', 'Unusual requests']),
    },
    {
      title: 'Urgency & Pressure Tactics',
      category: 'Social Engineering',
      durationMin: 4,
      summary: 'How attackers manufacture deadlines to shut down your critical thinking.',
      contentMd: `## The psychology
Urgency narrows attention. When we feel time pressure, we switch from deliberate thinking to fast, automatic reactions — exactly what attackers want.

## Common pressure scripts
- "Your account will be deleted in 24 hours"
- "Final notice before collections"
- "The CEO needs this before boarding"

## The counter-move
Any genuine deadline survives a 5-minute verification. **Urgency that punishes verification is the attack itself.**

## Practice
Next urgent email: reply (in your head) — "Interesting claim. How would I verify this officially?"`,
      redFlagTips: J(['Manufactured deadlines', 'Consequence threats', 'Secrecy + urgency combos']),
    },
    {
      title: 'Safe Link Hygiene',
      category: 'Foundations',
      durationMin: 6,
      summary: 'Hovering, domain reading and the anatomy of a deceptive URL.',
      contentMd: `## Read URLs right-to-left
In \`secure-acme.login-portal.test\`, the real domain owner is **login-portal.test** — everything before it is just a path.

## Habits that catch 90% of malicious links
1. **Hover before you click** (long-press on mobile) and read the tooltip.
2. Prefer **bookmarks / SSO dashboards** for sensitive portals.
3. Treat **shortened links** as opaque — expand them first.
4. A padlock icon means encryption, **not honesty** — phishing sites have certificates too.

## Simulated clicks in this platform
When you click a simulated link, you see a safe teaching moment instead of a credential page. No credentials are ever requested or stored here.`,
      redFlagTips: J(['Right-to-left domain reading', 'Hover to verify', 'Bookmarks beat links']),
    },
    {
      title: 'Reporting: Your Superpower',
      category: 'Response',
      durationMin: 3,
      summary: 'Why every report — right or wrong — makes the organization safer.',
      contentMd: `## Reports are data, not verdicts
A report button press takes 3 seconds and gives the security team eyes on the threat. False positives cost nothing; a missed phish can cost millions.

## Speed matters
Time-to-report is the metric that stops campaigns: reported phishes get blocked for everyone within minutes.

## In this platform
Use **Report Phish** in the simulated inbox. Reporting *before* clicking is the ideal behaviour we train for — but reporting *after* clicking is just as valuable: say something early.`,
      redFlagTips: J(['Report early', 'Never fear false alarms', 'Report even after clicking']),
    },
    {
      title: 'Executive Impersonation & BEC',
      category: 'Advanced',
      durationMin: 7,
      summary: 'Business Email Compromise: the most expensive phishing category.',
      contentMd: `## What BEC looks like
No links, no attachments — just a convincing "urgent, confidential" request from leadership. The FBI consistently ranks BEC among the costliest cyber-crime categories.

## The tell-tale pattern
1. Authority (CEO/CFO) + urgency ("before my flight") + secrecy ("keep this internal").
2. A payment or data request **outside** the normal process.
3. Reply-to or display-name tricks.

## The unbreakable rule
**Out-of-band verification**: any payment or credential request is confirmed by phone/video with a known number — never by replying to the email.`,
      redFlagTips: J(['Authority + secrecy', 'Out-of-band verification', 'Process exceptions are attacks']),
    },
  ]
  for (const m of modules) {
    await db.trainingModule.create({ data: { ...m, createdAt: day(50) } })
  }

  // Training completions
  const allModules = await db.trainingModule.findMany()
  const completionPlan: [string, number[]][] = [
    ['Elena Petrova', [0, 1, 2, 3]],
    ['David Kim', [0, 1, 2, 3, 4]],
    ['Grace Wanjiru', [0, 1, 3]],
    ['Priya Nair', [0, 2, 3]],
    ['Marcus Chen', [0, 3]],
    ['Hannah Lee', [0, 3]],
    ['Arjun Mehta', [0, 2, 4]],
    ['Ingrid Svensson', [0, 1, 3]],
    ['Sofia Rossi', [0, 4]],
    ['Omar Farouk', [0, 3]],
  ]
  for (const [who, idxs] of completionPlan) {
    for (const i of idxs) {
      await db.trainingCompletion.create({
        data: {
          participantId: participants[who].id,
          moduleId: allModules[i].id,
          completedAt: day(20 + (i % 5), 14, 0),
        },
      })
    }
  }

  // ---------------- Audit log ----------------
  const audits: [string, string, string, number][] = [
    ['CONSENT_RECORDED', 'system', '10 participants granted informed consent for simulation participation', 58],
    ['DOMAIN_APPROVED', 'security.admin@acme-corp.test', 'Approved sender domain: mail.securelab.test', 60],
    ['DOMAIN_APPROVED', 'security.admin@acme-corp.test', 'Approved sender domain: notifications.acme-corp.test', 60],
    ['DOMAIN_APPROVED', 'security.admin@acme-corp.test', 'Approved sender domain: hr-benefits.acme-corp.test', 60],
    ['DOMAIN_APPROVED', 'security.admin@acme-corp.test', 'Approved sender domain: billing.acme-vendor.test', 45],
    ['TEMPLATE_CREATED', 'security.admin@acme-corp.test', 'Simulation template "Password Expiry Alert" created', 55],
    ['TEMPLATE_CREATED', 'security.admin@acme-corp.test', 'Simulation template "Payroll Verification Request" created', 40],
    ['CAMPAIGN_LAUNCHED', 'security.admin@acme-corp.test', 'Campaign "Q3 Password Expiry Drill" launched for 7 authorized participants', 32],
    ['CAMPAIGN_COMPLETED', 'system', 'Campaign "Q3 Password Expiry Drill" completed', 28],
    ['CAMPAIGN_LAUNCHED', 'security.admin@acme-corp.test', 'Campaign "Q4 Invoice Fraud Drill" launched for 5 authorized participants', 14],
    ['CAMPAIGN_COMPLETED', 'system', 'Campaign "Q4 Invoice Fraud Drill" completed', 10],
    ['CAMPAIGN_LAUNCHED', 'security.admin@acme-corp.test', 'Campaign "Q4 Payroll Verification Drill" launched for 6 authorized participants', 5],
    ['RETENTION_POLICY', 'compliance.officer@acme-corp.test', 'Default retention set to 90 days, auto-purge enabled', 30],
    ['CAMPAIGN_CREATED', 'security.admin@acme-corp.test', 'Draft campaign "Q1 Confidential Data Test" created (pending authorization review)', 2],
  ]
  for (const [action, actor, detail, d] of audits) {
    await db.auditLog.create({ data: { action, actor, detail, createdAt: day(d, 10, 0) } })
  }

  const counts = {
    participants: await db.participant.count(),
    templates: await db.template.count(),
    campaigns: await db.campaign.count(),
    events: await db.trackedEvent.count(),
    modules: await db.trainingModule.count(),
    domains: await db.allowedDomain.count(),
  }
  console.log('Seed complete:', JSON.stringify(counts))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
