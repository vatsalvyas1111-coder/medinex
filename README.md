# Medinex

**Never miss a dose.** Medinex is a full-stack medicine adherence and caregiver-tracking web app with three roles, real-time updates and an AI companion (*Medi*).

| Role | What they do |
|---|---|
| **Patient** | Logs doses with one tap, manages medicines, requests new ones, sees analytics, chats with Medi, invites trackers |
| **Tracker** (caregiver) | Read-only view of linked patients, live alerts, analytics, AI weekly digest, one-tap "Call" |
| **Reviewer** (doctor/pharmacist) | Approves or rejects medicine requests with interaction flags and an AI brief; sees the full audit trail |

## Quick start

```bash
npm run setup     # installs root + server + client deps and seeds the database
npm run dev       # API on :4000, web on :5173  (open http://localhost:5173)
```

Requires Node 20+. To enable live AI, put a key in `server/.env` (copy `server/.env.example`):

```
GROQ_API_KEY=gsk_...
```

Without a key Medi transparently falls back to a local, data-grounded responder (same safety rules), and the UI labels it "offline".

Production-style run (Express serves the built client on one port): `npm start` → http://localhost:4000

### Demo accounts (password `demo1234`)

| Role | Email |
|---|---|
| Patient | `ramesh@medinex.demo` (also `sushila@medinex.demo`) |
| Tracker | `vatsal@medinex.demo` (follows both patients) |
| Reviewer | `meera@medinex.demo` |

## Demo mode (`DEMO_MODE=true`)

The floating **Demo** pill (bottom-left) opens the Demo Panel:

- **Switch role** in one click (no password) – open three browser windows for a live multi-role show.
- **Time travel**: `+1h`, `+6h`, next morning, reset. Runs the same dose-check job the cron runs, so missed-dose alerts fire for real.
- **Scenarios**: mark a dose missed, create a patient request, drop a medicine to low stock.
- **Reset** re-seeds the database (30 days of history, streak, pending requests).
- **Under the hood**: live trace of API calls, DB row counts, last dose log and audit entry, to show it is not mocked.

The demo clock starts at 07:30. *All* server time goes through `services/clock.js`.

## Suggested presentation flow (~6 min)

1. **Loader → Login.** Particles converge into the wordmark. Open the Demo pill → sign in as *Ramesh*.
2. **Today.** Tap a dose: ring fills, particles burst, streak counts up. Press <kbd>Space</kbd> to take the next due dose. Tap a taken card to undo.
3. **Second window as Vatsal (tracker).** Take a dose in window 1 and watch window 2 update live (SSE). Demo → *+6h*: missed-dose alert arrives, tap **Call Ramesh**.
4. **Medicines → Add.** Type "Ibuprofen": interaction warnings appear live against Ramesh's current medicines and allergies.
5. **Requests.** "Draft with Medi" turns *"my knee hurts at night"* into a clear request (never picks a drug or dose).
6. **Third window as Dr. Meera (reviewer).** Queue shows the request with severity, AI brief, current medicines. Approve with a time: it appears in Ramesh's day immediately. Reject needs a note.
7. **Analytics** (heatmap, worst time-slot, per-medicine bars, refill forecast) and the **Audit trail**.
8. **Medi.** Ask "How am I doing this week?" – streamed answer with a real data card. Ask "Should I double my dose?" – it declines and points to the doctor.
9. Extras: <kbd>Ctrl/⌘</kbd>+<kbd>K</kbd> command palette, Emergency card with QR, dark/light theme.

## Architecture

```
medinex/
  client/   React 18 + Vite + TypeScript (strict) + Tailwind/CSS variables + Framer Motion
            TanStack Query, Zustand, React Router, Recharts, custom canvas <ParticleField>
  server/   Node + Express, SQLite (better-sqlite3), JWT in httpOnly cookie, bcrypt, zod, node-cron, SSE
    src/routes  src/middleware  src/services  src/db  src/jobs  src/ai
    data/medinex.db   (created on first run, git-ignored)
```

- **Auth**: JWT in an httpOnly, SameSite=Lax cookie; passwords hashed with bcrypt (`bcryptjs`, pure JS so setup never needs a compiler). Login/register/AI routes are rate-limited.
- **Permissions are server-side**, in middleware, on every route: `requireAuth`, `requireRole(...)`, and `access.js` (`canViewPatient`, `canEditPatient`) which checks ownership / active tracker link / reviewer-has-a-request. The UI hides buttons, but the API is what enforces (try `curl` as a tracker on `POST /api/medicines` → `403`).
- **Errors** always look like `{ "error": { "code", "message" } }`. Every body/query is validated with zod.
- **Realtime**: `GET /api/events` (SSE). Events: `dose`, `alert`, `request`, `medicine`, `clock`, `reset`. Events are filtered per user by access rules. The React Query cache is invalidated from these events.
- **Doses**: schedules generate `dose_logs` rows per day (`UNIQUE(medicine, scheduled_for)`). A dose is *due* within a 30-minute grace window, *overdue* after that, and marked *missed* by the cron job after 2 hours, creating alerts for every tracker. Late doses are recorded as such.
- **Audit**: every dose, decision, medicine change, link change and demo action writes to `audit_log`.

### Data model
`users`, `patient_profiles`, `tracker_links`, `medicines`, `schedules`, `dose_logs`, `medicine_requests`, `alerts`, `audit_log`, `ai_conversations`, `ai_messages`, `app_settings`, `interaction_rules`, with indexes on `dose_logs(patient_id, scheduled_for)`, `medicines(patient_id)`, `alerts(tracker_id, read)`.

### API surface (all under `/api`)

| Area | Routes |
|---|---|
| Auth | `POST /auth/register · /auth/login · /auth/logout`, `GET /auth/me` |
| Medicines | `GET/POST /medicines`, `PATCH/DELETE /medicines/:id`, `POST /medicines/check` |
| Doses | `GET /doses/today · /doses/history`, `POST /doses/:id/take · /undo`, `PATCH /doses/:id/note` |
| Requests | `GET/POST /requests`, `GET /requests/:id`, `PATCH /requests/:id/decide` |
| Links | `GET /links`, `POST /links/invite · /links/accept`, `DELETE /links/:id` |
| Tracker | `GET /trackers/patients`, `GET /patients/:id/summary`, `PATCH /patients/me/profile` |
| Analytics | `GET /analytics/adherence · /analytics/compare` |
| Alerts | `GET /alerts`, `PATCH /alerts/:id/read`, `POST /alerts/read-all` |
| Audit | `GET /audit` (reviewer only) |
| AI | `POST /ai/chat` (SSE stream), `GET /ai/insight`, `GET /ai/brief/:requestId`, `POST /ai/draft-request`, `GET/DELETE /ai/history` |
| Live | `GET /events` (SSE) |
| Demo | `GET /demo/state · /demo/trace`, `POST /demo/switch-role · /time-travel · /scenario · /reset` (404 when `DEMO_MODE` is off) |

## The AI pipeline

All Groq calls go through the server; the key exists only in `server/.env` and is never sent to or bundled into the client (`grep -r gsk_ client/dist` finds nothing).

1. **Role-scoped context is built server-side** (`ai/prompt.js`): a patient gets their own schedule/adherence, a tracker gets only linked patients, a reviewer gets only the request and that patient's medicines/allergies. The client never sends context.
2. **System prompt** = the Medi safety prompt with the user's role, name and context filled in. Medi refuses diagnosis, dose changes and emergencies (points to a doctor / local emergency number).
3. **Streaming**: tokens stream to the browser via SSE. A `StreamFilter` strips hidden reasoning and `<card>` tags on the fly.
4. **Cards**: the model only *chooses* a card type (`dose_summary`, `adherence`, `refill`, `request_summary`). The server fills it with real numbers from SQLite, so cards can never hallucinate data.
5. **Resilience**: model fallback chain (`GROQ_MODEL`, then `GROQ_FALLBACK_MODELS`) then the local responder. History is limited to the last 12 messages and 20 requests/min per user.

## Design system

Warm and premium: dark base `#0B1020`, light base `#FAF7F2`, teal→mint gradient, coral = missed, amber = warning, green = taken. Fraunces (display) + Plus Jakarta Sans (UI). Radii 12/20/28. Everything visual (logo, pills, illustrations, avatars, QR) is inline SVG or procedural canvas – no external images. Skeletons instead of spinners, ≥48 px tap targets, visible focus rings, `prefers-reduced-motion` respected (particles and springs are reduced), responsive down to phones (bottom nav on small screens).

## Extras included

Interaction & allergy warnings (patient add flow, request form, reviewer queue) · Emergency card with QR and print · Refill forecast · Dose notes · Weekly AI digest (also a printable report) · Notification centre · Command palette (<kbd>Ctrl/⌘</kbd>+<kbd>K</kbd>) · <kbd>Space</kbd> to take the next dose · Dark/light theme.

## Configuration (`server/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 4000) |
| `APP_TZ` | Time zone for schedules and the demo clock (default `Asia/Kolkata`) |
| `JWT_SECRET` | Signs auth cookies – **change it** |
| `DEMO_MODE` | Enables the Demo Panel and its endpoints |
| `SEED_CLOCK_START` | Demo clock start on seed (`HH:MM`, or `real`) |
| `GROQ_API_KEY` | Server-side Groq key (optional; local fallback if empty) |
| `GROQ_MODEL`, `GROQ_FALLBACK_MODELS` | Primary and fallback Groq model ids |

## Scripts

`npm run setup` · `npm run seed` (reset DB) · `npm run dev` · `npm run build` · `npm start`

## Notes and honest limitations

- Interaction data is a small curated rule table (`interaction_rules`) for demonstration, **not** a clinical database. Medi and the UI always defer to a doctor or pharmacist.
- Medicines are never hard-deleted: stopping one keeps its history for audit and analytics.
- Push/SMS notifications are out of scope; alerts are in-app and live via SSE. "Call" uses the `tel:` link.
