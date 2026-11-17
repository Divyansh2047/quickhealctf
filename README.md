# PhishGuard — Phishing Simulation & Awareness Platform

A governance-first platform for running **authorized** phishing awareness drills: launch controlled campaigns against a consented roster, track the full behavioral funnel (delivered → opened → clicked → landed → submitted → reported), teach in the moment with AI-powered landing pages and micro-trainings, and report on program health with privacy-preserving analytics. **No real credentials are ever collected** — the simulated form discards every typed value server-side; only behavioral signals are recorded.

> **Authorized use only.** PhishGuard is a defensive security-awareness tool for demonstration and authorized training. It never sends real email — every simulation lives inside the platform's sandboxed Test Inbox.

---

## Features

| View | What it does |
|---|---|
| **Overview** | Security Awareness Command Center: resilience score, funnel KPIs, live activity feed (socket.io), recent alerts |
| **Campaigns** | Full campaign lifecycle — draft, launch (consent + domain gates enforced server-side), complete, per-campaign analytics |
| **Templates** | Built-in library (credential harvest, BEC, invoice fraud, delivery scam…) + **AI Studio** generation with risk scoring and coach feedback |
| **AI Studio** | Generate templates from scenarios, analyze phish traits, AI report summaries — powered by an integrated LLM service |
| **Test Inbox** | Sandboxed inbox that renders simulations end-to-end: open tracking, link tracking, simulated credential landing (zero-capture), report button |
| **Training** | Micro-training modules (phishing basics, BEC, password hygiene, social engineering) with completion tracking |
| **Leaderboard** | Department-level awareness standings, report-rate champions |
| **Analytics** | Program trend, technique susceptibility, department heatmap, funnel conversion |
| **Compliance** | Consent ledger, allowed-domain governance, data-retention rules, immutable audit log, export |

---

## Tech stack

- **Next.js 16** (App Router) + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (New York) + **Framer Motion**
- **Prisma ORM + SQLite** — zero external database needed
- **Recharts** — analytics
- **socket.io** — live activity feed via a dedicated mini-service (`mini-services/live-feed`, port 3003; ingest API on 3004)
- **z-ai-web-dev-sdk** — AI features (works out of the box in the sandbox; locally the app degrades gracefully if unreachable)

---

## Run it locally (5 minutes)

### Prerequisites

- **Node.js 20+** with npm, **or** **Bun 1.1+** — pick one
- No database install, no API keys required to boot the demo

### 1. Unzip & enter

```bash
cd phishguard            # folder containing package.json
```

The zip ships with:
- `.env` — portable config (`DATABASE_URL="file:../db/custom.db"`), works on any machine
- `db/custom.db` — **pre-seeded demo dataset** (12 participants, 4 campaigns, templates, events, audit history)

### 2. Install dependencies

```bash
npm install          # or: bun install
```

### 3. (Only if `db/` was not included) create the database

```bash
mkdir -p db
npx prisma db push   # bun: bunx prisma db push
```

To force a pristine database at any time:

```bash
rm db/custom.db && npx prisma db push
```

### 4. Start the live-feed mini-service (terminal 1)

```bash
cd mini-services/live-feed
npm install          # first time only (or: bun install)
npm run dev          # or: bun run dev  → ports 3003 (socket.io) + 3004 (ingest)
```

> Skipping this step is fine — everything else works; only the live activity feed on the Overview page shows "connecting".

### 5. Start the platform (terminal 2)

```bash
cd ..                # back to the project root
npm run dev          # or: bun run dev  → http://localhost:3000
```

### 6. Open **http://localhost:3000**

The demo dataset is already loaded — explore every view immediately. The health endpoint confirms the stack: `GET /api/health` → `{ ok: true, checks: { database, liveFeed, ai } }`.

### Local socket note

Behind a reverse-proxy/gateway deployment, the browser reaches the feed via the default `/?XTransformPort=3003`. For a plain local run without a gateway, add one line to `.env`:

```bash
NEXT_PUBLIC_SOCKET_URL="http://localhost:3003"
```

then restart `npm run dev`. (The backend→feed ingest URL `LIVE_FEED_URL` already defaults to `http://127.0.0.1:3004/emit`.)

### Production build (optional)

```bash
npm run build && npm run start
```

---

## Demo walkthrough (2 minutes, judge-ready)

1. **Overview** — Command Center with resilience score, conversion funnel, and the **live activity feed** streaming real-time events.
2. **Campaigns** — open a running campaign; inspect per-campaign analytics and the consent/domain launch gates.
3. **Test Inbox** — pick the live campaign email → **open** it → **click the link** → the simulated credential page loads → type anything and **submit**: the teachable-moment page fires ("nothing you typed was stored") → hit **Report phish**. Watch the funnel and leaderboard update, and the event appear in the live feed.
4. **AI Studio** — generate a new template from a scenario; check the AI risk analysis and coaching tips.
5. **Analytics / Leaderboard** — program trend, technique susceptibility radar, department standings.
6. **Compliance** — consent ledger, allowed domains, retention policy, immutable audit trail of every action you just performed.

---

## Architecture

```
├── src/
│   ├── app/page.tsx                 # App shell: sidebar nav + 9 views
│   ├── app/api/
│   │   ├── campaigns/  participants/  templates/  inbox/  training/
│   │   ├── analytics/  stats/  leaderboard/  compliance/  export/
│   │   ├── track/                   # open / click / landing / credential / report
│   │   ├── ai/                      # analyze / coach / report-summary / template
│   │   └── health/                  # database + liveFeed + AI checks
│   ├── components/phishguard/       # views, shared components, hooks (socket)
│   └── lib/                         # db, events (feed ingest), authz, audit, ai, rate-limit
├── mini-services/live-feed/         # socket.io feed: 3003 (browser) + 3004 (ingest)
├── prisma/schema.prisma             # 10 models
└── db/custom.db                     # pre-seeded SQLite demo data
```

### Safety architecture (defensible by design)

- **Zero-credential capture** — the credential endpoint discards all POST values before any persistence layer; the schema has no field that could hold a secret.
- **Consent + domain gates** — launches fail closed unless every participant is consented and the sender domain is on the allowed list.
- **Privacy-preserving analytics** — no IPs, coarse device metadata only, retention windows, anonymized exports.
- **Immutable audit log** — every governance-relevant action is appended.
- **In-platform only** — nothing ever leaves the sandbox: no real email delivery.

---

## Scripts (project root)

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply Prisma schema |
| `npm run db:reset` | Reset the database |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Environment variable not found: DATABASE_URL` | Ensure `.env` exists (copy from `.env.example`) |
| Empty dashboard | You deleted the DB — `npx prisma db push` then re-run the seed flow or contact the team copy in `db/` |
| Live feed shows "connecting" | Start `mini-services/live-feed` (step 4); locally also set `NEXT_PUBLIC_SOCKET_URL=http://localhost:3003` |
| Port 3000 busy | `npm run dev -- -p 3001` |
| AI Studio errors locally | The AI service needs sandbox connectivity; all other views work offline |
| Prisma client out of sync | `npx prisma generate && npx prisma db push` |

---

**PhishGuard v1.0 — Authorized security awareness, simulated safely.**
