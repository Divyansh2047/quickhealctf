# Task 2-b — PhishGuard Frontend (work record)

Agent: frontend (task id 2-b)
Status: COMPLETE — tsc clean, eslint clean on all new files, `GET /` returns 200 from dev server.

## What was built
Complete client-side "security operations console" for PhishGuard on the single `/` route.
All data access goes through relative `/api/...` fetches matching the agreed API contract
(task 2-a backend). Backend untouched; only frontend files were created/modified.

## Files created
- `src/components/phishguard/api.ts` — typed `api<T>()` fetch helper (`ApiError` with
  `error` + `violations`), `apiErrorMessage()`, `emailDomain()`, and TS types for every
  response shape in the contract (Stats, CampaignDetail, PhishTemplate, Participant,
  InboxResponse, TrackResponse, TrainingResponse, ComplianceResponse, AnalyticsReport...).
- `src/components/phishguard/hooks.ts` — `useApiData<T>(path)` (skeleton-on-first-load,
  silent refresh, stale-response generation guard) + typed endpoint hooks: useStats,
  useCampaigns, useCampaignDetail, useTemplates, useParticipants, useInbox, useTraining,
  useCompliance, useAnalyticsReport.
- `src/components/phishguard/view-keys.ts` — `ViewKey` union used by shell + views.
- `src/components/phishguard/shared.tsx` — KpiCard, StatusBadge (pulsing dot for running),
  DifficultyBadge, EmptyState, SectionTitle, ViolationsAlert, ErrorState, EventStatusCell,
  MiniProgress, SkeletonCards, EVENT_META (event icon/color/verb), relativeTime,
  shortDateTime, pct, resilienceLabel, initials.
- `src/components/phishguard/charts.tsx` — recharts wrappers styled dark/emerald:
  TrendChart (4 gradient areas), DepartmentRateChart (horizontal bars), ResilienceGauge
  (RadialBarChart semicircle + center number), FunnelBars (Delivered→Opened→Clicked→Reported
  with conversion %).
- `src/components/phishguard/views/OverviewView.tsx` — greeting strip, 5 KPI cards
  (click rate red >25, resilience w/ progress + label), 14-day trend, department chart,
  live activity feed (max-h-96 scroll), running campaigns w/ progress, score explainer.
- `src/components/phishguard/views/CampaignsView.tsx` — status filter Tabs, campaign card
  grid, detail Dialog (max-w-4xl, authorization panel, participants table with check/x +
  timestamps, launch/simulate/complete/cancel/delete with 400-violation alerts), 3-step
  New Campaign wizard (details → consent-gated participant picker w/ select-all-consented →
  review) with API violation rendering.
- `src/components/phishguard/views/TemplatesView.tsx` — template card grid, detail dialog
  (Email preview with inert links inside white box / Red flags / Teaching moment tabs),
  create+edit dialog form (dynamic red-flag list, prefilled HTML shell), delete w/ confirm
  and API error toast.
- `src/components/phishguard/views/TestInboxView.tsx` — flagship demo: controlled-test-env
  banner, "Acting as" select (active+consented), two-pane inbox (list max-h-[520px] with
  unopened bold+dot and status icons), reading pane with white body box,
  `onClickCapture` anchor interception → POST /api/track CLICK → red Teaching Moment dialog
  (red flags + landingMessage + "Browse training modules" → navigates to Training),
  Report Phish → POST REPORT with already-handling, OPEN tracked on first open + refresh.
- `src/components/phishguard/views/TrainingView.tsx` — participant select + X/Y summary
  chip, module cards (category, duration, completions, completed check), markdown dialog
  (react-markdown, emerald headings, amber tip chips), completion button (disabled until
  participant chosen), "Targeted awareness" side card (top-2 click-rate departments →
  mapped module chips that open the dialog), progress bar.
- `src/components/phishguard/views/AnalyticsView.tsx` — privacy suppression Switch
  (departments <3 hidden → "hidden for privacy" chips), gauge + funnel + trend + dept
  chart, campaign performance table (click rate red >30), printable SAMPLE AWARENESS
  REPORT card (`.print-report`: header, exec summary, metric grid, campaign/department
  tables, top red flags, recommendations, privacy block) + Print/Save PDF button that
  toggles `body.printing-report` (all non-report content wrapped in
  `.print-hide-when-printing`).
- `src/components/phishguard/views/ComplianceView.tsx` — 7 built-in safeguards card, Tabs:
  Consent (inline Switch PATCH + add-participant dialog + deactivate dropdown), Sender
  domains (allowlist list + add/revoke), Retention (days input, autoPurge switch, data
  footprint, destructive purge note), Audit log (max-h-96 scroll, color-coded action
  badges, mono actor, relative time).

## Files modified
- `src/app/page.tsx` — full app shell: sticky blurred header (logo `/logo.png`, title,
  AUTHORIZED USE ONLY amber + DEMO DATA emerald badges), desktop fixed w-60 sidebar
  (emerald left-border active indicator) hidden <lg, mobile horizontal pill nav, framer
  motion fade on view switch, main `max-w-[1400px]`, sticky-bottom footer (mt-auto +
  safe-area padding) with simulation disclaimer.
- `src/app/layout.tsx` — PhishGuard metadata (title/description/icon `/logo.png`);
  Toaster swapped to `@/components/ui/sonner` with position="bottom-right" theme="dark"
  richColors closeButton.
- `src/app/globals.css` — `.dark` token block replaced with emerald/zinc "security
  console" palette (oklch, per spec); appended thin emerald scrollbars (webkit+firefox)
  and print rules: `.no-print{display:none}`, `body.printing-report .print-hide-when-printing{display:none}`
  + `.print-report` forced white/printable colors, `.print-muted` gray.

## Notes for next agents / orchestrator
- Contract deviations handled defensively: `InboxTemplateInfo.landingMessage` is typed
  optional (`landingMessage?: string`) and rendered only when present — backend (2-a) may
  include it for teaching moments; everything else consumed exactly per contract.
- Rates/scores are assumed 0–100 percent scale (per spec examples).
- Wizard/invite flows: campaign create = POST /api/campaigns as draft; launch via PATCH
  action; violations surfaced inline (Alert) + toast.
- Print pipeline: only AnalyticsView has `.print-report`; everything chrome is `.no-print`.
- View switching unmounts views (state resets on nav) — intentional, hooks refetch.
- React hooks lint (react-hooks v6): avoided setState-in-effect everywhere; default
  participant selection uses derived state (`picked ?? actors[0]?.id`).
- Verified: `bunx tsc --noEmit` clean; `bunx eslint` on all new files clean; dev server
  serves `/` 200 and `/api/stats` 200.
