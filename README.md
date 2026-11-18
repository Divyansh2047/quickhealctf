# PhishGuard

PhishGuard is a phishing-awareness training lab. Participants review simulated messages in an internal inbox, decide whether to report or proceed, and get feedback on their decision. Organizers manage consent, run campaigns, and review learning progress. Every message and exercise stays inside the app.

[Try the hosted workspace](https://phishguard-quickhealctf.vercel.app/) · [Demo walkthrough](docs/DEMO_RUNBOOK.md) · [Deploy on Vercel](docs/VERCEL.md)

## Get started locally

Install **Node.js 20.19 or later** with npm. Node.js 22 is a good default for local development and Vercel.

**Windows:** Double-click `run.bat` or run `.\run.bat` from the project folder in PowerShell. The launcher installs missing dependencies, prompts for an admin passphrase on first setup, initializes SQLite, installs the demo, and starts the app.

**macOS or Linux:** Run these commands from the repository root:

```sh
npm ci
npm run setup
npm run db:push
npm run demo:install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) and sign in with the passphrase you chose. Setup accepts 12 to 256 characters. You can rotate it later using **Change passphrase** in the administrator bar.

### Demo data and upgrades

- **Full demo:** `npm run demo:install` adds 12 fictional participants, four sample campaigns, five core lessons, and the template library: seven original scenarios and eleven interactive scenarios.
- **Catalog only:** `npm run templates:install` installs or refreshes the built-in templates and core lessons without adding participants or campaigns.
- **Existing workspace:** Keep your `.env` and database. After the update, opening **Templates** or **Inbox** restores missing originals and upgrades recognized stock templates in place. Opening **Training** restores any missing core lessons. Campaign references and learner progress are preserved.
- **Disposable reset:** `npm run demo:reset` replaces application data in the configured database. Use it only with a disposable demo database, then run `npm run templates:install` to add the full interactive catalog.

## Run an exercise

1. Open **Compliance**, approve the sender and participant domains, create a participant, and issue an invitation. Use fictional addresses for the demo.
2. Open the invitation in a private browser window or a separate profile. The participant accepts the consent notice there. Invitations expire after 24 hours and can be used once.
3. In **Campaigns**, choose a template, select consenting participants, and launch the campaign.
4. In the participant inbox, open the message and choose its link or report it. The link inside the message opens the assigned practice screen. The preview in the template library remains read-only.
5. Review the feedback, then visit **Training** to take a three-question assessment. Use the organizer dashboard to review campaign outcomes and compare baseline and follow-up results.

Opening a message link alone leaves reporting available. Proceeding records the exercise outcome and closes the option to report that attempt. Reporting first also locks the outcome. Closing the practice screen without proceeding does not record a submission.

| Scenario | What the participant does |
| --- | --- |
| Account sign-in | Selects a fictional identity and decides whether to proceed |
| Account recovery | Types the answer shown on a fictional case card. The browser checks it locally |
| Unexpected file share or payroll attachment | Chooses whether to download a harmless plain-text `demo.txt` |
| QR notice, meeting update, or app permissions | Inspects a destination, responds to a calendar change, or reviews requested permissions |
| Supplier change, prize notice, travel booking, or coworker request | Reviews the case and decides whether to proceed or report |

The original catalog also includes scenarios such as password expiry, payroll verification, parcel redelivery, executive payment approval, and e-signing.

## Studio, training, and reporting

- **Studio** drafts exercises from the local catalog and screens pasted messages for signs such as mismatched reply domains and unexpected payment requests. Analysis does not open links or verify the sender.
- **Training** includes five lessons on phishing indicators, pressure tactics, link hygiene, reporting, and executive impersonation. Quiz choices are shuffled, and scoring uses the order shown to the participant.
- **Reporting** shows campaign activity and paired assessment results. Exports use pseudonymous participant labels and escape spreadsheet formulas. Small departments may be omitted from aggregates, and seeded activity is fictional.
- **External AI** is disabled by default. Local draft generation, analysis, and coaching do not need an API key. Review what your provider receives before enabling outbound analysis or coaching.

## Deploy on Vercel

The app uses Next.js and TypeScript with Prisma. **Local development uses SQLite. Vercel uses Neon Postgres.** The hosted database is separate from your local database.

Follow the [Vercel and Neon setup guide](docs/VERCEL.md) for database initialization, Production environment variables, and deployments from a local folder. Once your folder is linked and configured, the production deployment command is:

```powershell
npx.cmd vercel@latest --prod
```

| Variable | Local | Hosted |
| --- | --- | --- |
| `APP_ORIGIN` | `http://127.0.0.1:3000` | Exact HTTPS production origin, without a trailing slash |
| `DATABASE_URL` | `file:../db/custom.db` | Pooled Neon connection URL |
| `DIRECT_DATABASE_URL` | Unused | Direct Neon URL for `npm run db:vercel:init` only |
| `SESSION_SECRET` | Generated by setup | Fresh secret generated by setup |
| `ADMIN_PASSWORD_HASH` | Generated by setup | Fresh hash generated by setup |
| `COOKIE_SECURE` | `false` over local HTTP | `true` |
| `AI_ENABLED` | `false` by default | `false` unless intentionally configured |

Keep `.env`, database connection strings, credentials, and SQLite files out of Git. If local login rejects your origin, open the exact address in `APP_ORIGIN`. The Windows launcher restores the default local origin automatically.

## What the app records

Campaigns require participant consent and approved sender and recipient domains. The app records interaction types and timestamps, including the decision to proceed or report. It does not send outbound email or collect real passwords. The fictional recovery answer is checked in the browser, and the practice attachment is a plain-text note. Message content renders in a frame that blocks scripts and external resources.

The retention sweep removes expired enrollments and related activity. On Vercel, eligible requests trigger the sweep. The app is intended for a trusted administrator and one organization's workspace. For the trust model and known limits, see the [security review](docs/SECURITY_REVIEW.md).

## Verify changes

```sh
npm run lint
npm run typecheck
npm test
npm run verify:api
npm run build
```

The API suite starts a local server on port 3000 and uses a temporary SQLite database. Stop other development servers on that port first. For browser verification, install Chromium with `npx playwright install chromium`, then run `npm run verify:browser`. Use `npm run build:vercel` to verify the Postgres build path.

For a live smoke test, sign in, check the template editor and five lessons, open the link inside a participant's message, and verify that proceeding locks the outcome. In an attachment exercise, also check that `demo.txt` lands in Downloads.

See the [sample awareness report](docs/SAMPLE_AWARENESS_REPORT.md) for an example deliverable.
