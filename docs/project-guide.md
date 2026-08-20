# Project Build Guide — Agency Automation System (Notion Track)

This is the complete, self-contained reference for building this project end to
end. It covers what we're building, why every piece exists, how to build each
piece, in what order, and how it all gets judged. Read this once fully before
writing any code — the order matters.

---

## Table of Contents

1. [What We Are Actually Building](#1-what-we-are-actually-building)
2. [Why This Design, Piece by Piece](#2-why-this-design-piece-by-piece)
3. [System Architecture](#3-system-architecture)
4. [Build Order (Do Not Skip Around)](#4-build-order-do-not-skip-around)
5. [Phase 1 — Shared Core](#5-phase-1--shared-core)
6. [Phase 2 — Flow A: Invoice Approval & Send](#6-phase-2--flow-a-invoice-approval--send)
7. [Phase 2 — Flow B: Meeting Transcript → Tasks](#7-phase-2--flow-b-meeting-transcript--tasks)
8. [Phase 2 — Flow C: Email/WhatsApp → Reminders](#8-phase-2--flow-c-emailwhatsapp--reminders)
9. [Notion Workspace Design](#9-notion-workspace-design)
10. [The Run Log — Why It's Not Optional](#10-the-run-log--why-its-not-optional)
11. [Human Approval Mechanics](#11-human-approval-mechanics)
12. [AI Layer — OpenRouter Integration](#12-ai-layer--openrouter-integration)
13. [Deployment](#13-deployment)
14. [Testing & Hardening Against Bad Input](#14-testing--hardening-against-bad-input)
15. [Timeline / Day-by-Day Plan](#15-timeline--day-by-day-plan)
16. [What Goes on the PPT](#16-what-goes-on-the-ppt)
17. [Judging Checklist — Self-Audit Before Demo](#17-judging-checklist--self-audit-before-demo)
18. [Common Pitfalls](#18-common-pitfalls)

---

## 1. What We Are Actually Building

A backend service (our code, our repo, our host) that:

- **Listens** for events from three sources: Gmail, WhatsApp (via OpenWA), and
  Google Meet transcripts (via Notion's native transcription).
- **Normalizes** everything into one central data store.
- **Uses AI** (via OpenRouter, free model) to read messy input and turn it into
  structured, prioritized, categorized data.
- **Writes** that structured data into Notion — Notion is the interface, not
  the engine.
- **Pauses for a human** at the point where a real-world action would happen
  (sending a message, sending an invoice, confirming a task) — that human
  approves, rejects, or overrides from inside Notion.
- **Acts** in the real world once approved — sends a WhatsApp message, creates
  a task, sends an invoice file.
- **Logs** every single run to a Run Log in Notion, written by our code, with
  a real timestamp, not typed by a human.

Three concrete flows sit on top of this shared pipeline:

| Flow | Trigger | Real-world action |
|---|---|---|
| **A — Invoice** | Invoice file uploaded to Notion | WhatsApp message with invoice sent to a number, after approval |
| **B — Meeting transcript** | Google Meet transcript lands in Notion | Structured tasks created from the transcript |
| **C — Reminders/Schedule** | New WhatsApp message or email arrives | Structured reminder/schedule item created, optionally a reply sent, after approval |

We are building the shared core once, then all three flows in parallel, then
picking whichever is most stable as the flow we lead the demo with.

---

## 2. Why This Design, Piece by Piece

Every choice here maps directly to something the brief judges on. Understanding
*why* matters as much as *how*, because if a judge asks "why does it work this
way," the answer should never be "because that's just how we built it."

- **Central data storage exists** so that AI sorting logic, Notion-writing
  logic, and Run Log logic are written **once** and reused by all three flows.
  Without this, we'd be writing the same plumbing three times, and any one flow
  breaking wouldn't teach us anything about the others.
- **AI only touches the sorting/structuring step**, never the trigger, never
  the final send. This matches the brief's rule: *"if an if statement could
  have done it, an if statement should have done it."* Deciding "is this a new
  request" is a rule. Deciding "what priority and category does this messy
  paragraph deserve" is where AI earns its place.
- **Notion never initiates anything.** It only displays, logs, and gates. If
  Notion goes down, nothing should be actively producing wrong behavior — it
  should just mean nothing gets approved until it's back up. This is what
  "Notion is the interface, not the middleware" means in practice.
- **The human approval gate is a status property, not a chat message or a
  button in our own UI.** It has to be inside Notion, because a stranger who's
  never seen our code needs to be able to operate the job from there alone.
- **The Run Log is a separate write path from the Notion result — no** a
  written table is not the same as a task or database row. The Run Log
  specifically answers "did the system run, when, and what happened" —
  independent of whether that particular run produced anything user-facing.

---

## 3. System Architecture

```
                    ┌─────────────┐
      Email ──────► │             │
                    │             │
    WhatsApp ──────►│  Central     │
                    │  Data        │
Google Meet ───────►│  Storage     │
(via Notion          │             │
 transcription)      └──────┬──────┘
                             │
                             ▼
                   ┌───────────────────┐
                   │  AI Sort/Structure │
                   │  (OpenRouter)      │
                   └─────────┬──────────┘
                             │
                             ▼
                   ┌───────────────────┐
                   │   Notion (write)   │◄──── Notion MCP / API
                   │   = Interface      │      (also reads back
                   └─────────┬──────────┘       manual edits)
                             │
                             ▼
                  ┌────────────────────┐
                  │  Human Approval     │
                  │  (status property)  │
                  └─────────┬──────────┘
                             │ approved
                             ▼
                  ┌────────────────────┐
                  │   Real Action       │
                  │  (WhatsApp send,    │
                  │   task created,     │
                  │   reminder sent)    │
                  └─────────┬──────────┘
                             │
                             ▼
                  ┌────────────────────┐
                  │     Run Log         │
                  │  (written by code,  │
                  │   every run,        │
                  │   real timestamp)   │
                  └────────────────────┘
```

**Key rule:** the Run Log gets written on **every run**, not only successful
ones. A run that fails, gets rejected by a human, or hits bad input still
produces a Run Log row saying so. This is what "leaves proof" and "nothing
silently lost" mean together.

---

## 4. Build Order (Do Not Skip Around)

Build in this exact order. Each phase depends on the one before it, and
building out of order means redoing work.

1. **Notion workspace schema** — databases, properties, statuses (Section 9).
   Do this on day one, not last. The brief explicitly calls out "building the
   Notion layer in the last two hours" as a mistake.
2. **Run Log writer function** — build and test this before any real flow
   exists. Fire it manually with fake data first.
3. **Central data storage schema** — one shape that fits email, WhatsApp, and
   transcripts.
4. **AI sort/structure function** — wrap OpenRouter, test with sample messy
   input from all three sources.
5. **Notion write function** — takes structured data, creates/updates the
   right Notion row.
6. **Human approval detection** — poll or webhook for status changes in
   Notion.
7. **Flow A (Invoice)** end to end.
8. **Flow B (Meeting transcript)** end to end.
9. **Flow C (Email/WhatsApp reminders)** end to end.
10. **Hardening pass** — bad input, duplicates, crash recovery (Section 14).
11. **PPT + demo script.**

---

## 5. Phase 1 — Shared Core

### 5.1 Central Data Storage

Use a single table/collection with this shape, regardless of source:

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Generated by our code |
| `source` | enum | `email`, `whatsapp`, `meeting_transcript` |
| `raw_content` | text | Unprocessed original content |
| `sender` | string | Email address, phone number, or meeting participant |
| `received_at` | timestamp | When it actually arrived, not when we processed it |
| `status` | enum | `new`, `processing`, `structured`, `pushed_to_notion`, `approved`, `rejected`, `actioned`, `failed` |
| `structured_data` | JSON | Filled in after AI processing |
| `notion_page_id` | string | Filled in after Notion write, used to detect approval later |
| `error` | text (nullable) | If something failed, why |

This can live in Postgres, SQLite, or even a simple JSON file store for a
hackathon timeline — what matters is that it's queryable and durable across
restarts, not that it's fancy.

### 5.2 Run Log Writer

Build this as a single reusable function that every flow calls:

```javascript
async function writeRunLog({
  flow,           // "invoice" | "meeting_transcript" | "reminders"
  triggerType,    // "webhook" | "cron" | "notion_poll"
  status,         // "success" | "failed" | "pending_approval" | "rejected"
  summary,        // one-line human-readable description
  relatedItemId,  // id from central storage, if applicable
  error = null
}) {
  await notion.pages.create({
    parent: { database_id: RUN_LOG_DATABASE_ID },
    properties: {
      "Timestamp": { date: { start: new Date().toISOString() } },
      "Flow": { select: { name: flow } },
      "Trigger Type": { select: { name: triggerType } },
      "Status": { select: { name: status } },
      "Summary": { title: [{ text: { content: summary } }] },
      "Related Item": { rich_text: [{ text: { content: relatedItemId || "" } }] },
      "Error": { rich_text: [{ text: { content: error || "" } }] }
    }
  });
}
```

Call this:
- The moment a trigger fires (status: `pending_approval` or in-progress)
- The moment an action completes (status: `success`)
- The moment anything fails (status: `failed`, with the actual error message)
- The moment a human rejects something (status: `rejected`)

### 5.3 AI Sort/Structure Function

One function, reused everywhere:

```javascript
async function sortAndStructure(rawItem) {
  const prompt = buildPromptForSource(rawItem.source, rawItem.raw_content);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.1-8b-instruct:free", // pick a free model
      messages: [
        { role: "system", content: "You are a strict JSON extraction engine. Respond ONLY with valid JSON, no preamble, no markdown fences." },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await response.json();
  const text = data.choices[0].message.content;

  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    // AI returned garbage — this must not crash the pipeline
    return { error: "unparseable_ai_response", raw: text };
  }
}
```

`buildPromptForSource` varies per source — email needs sender/subject/body
extraction, WhatsApp needs language detection and category, transcripts need
action-item extraction. Keep each prompt in its own small file.

### 5.4 Notion Write Function

One function per target database (Requests DB, Tasks DB, Invoices DB), but
all following the same pattern: take structured data in, create or update a
Notion page, return the `page_id`, store that `page_id` back in central
storage so we can later detect approval.

### 5.5 Human Approval Detection

Two viable approaches:

**Option 1 — Polling (simpler, recommended for hackathon timeline)**
A cron job every 1–2 minutes queries each relevant Notion database for pages
where `Status` changed to `Approved` or `Rejected` since the last check, and
triggers the corresponding action function.

**Option 2 — Notion webhook (if available for your Notion plan)**
Notion automations can call an external URL on a property change. Check
current availability on the plan you're using — automations became easier to
set up but availability can vary by plan and page/database configuration, so
verify before committing your whole approval flow to it.

**Recommendation:** start with polling. It's reliable, boring, and fast to
build — it still satisfies the brief's "a cron... fires it" requirement. Only
move to Notion automations if you have spare time and want it faster.

---

## 6. Phase 2 — Flow A: Invoice Approval & Send

### Trigger
A file (the invoice) is uploaded into a Notion database (the "Invoices" DB),
or a scheduled cron checks for new invoice entries with `Status = New`.

### Flow
1. Human (or an automated process) uploads invoice PDF + fills in `Recipient
   Name`, `Phone Number`, `Amount`, `Due Date` in the Invoices DB.
2. Our polling job detects a new row with `Status = New`.
3. Run Log: write a `pending_approval` row.
4. Status auto-updates to `Awaiting Approval`.
5. Human reviews it in Notion, changes `Status` to `Approved` (or
   `Rejected`).
6. Our polling job detects the status change.
7. If `Approved`: our code fetches the file from Notion, sends it via OpenWA
   to the given `Phone Number` with a templated message.
8. Run Log: write a `success` or `failed` row with the outcome.
9. Notion row `Status` updates to `Sent` or `Send Failed`.

### Why this is the strongest single demo flow
Every brief requirement is visibly satisfied in under two minutes of demo
time: a real trigger (file upload), a real human gate, a real outbound action
(WhatsApp message with attachment), and a Run Log row appearing live.

### Edge cases to handle
- Invoice uploaded with missing phone number → don't crash, flag it, write a
  `failed` Run Log row with a clear reason, and put the Notion row into a
  `Needs Info` status instead of leaving it stuck silently.
- WhatsApp send fails (number invalid, session disconnected) → catch it,
  log it, surface the failure in Notion so a human sees it, don't retry
  silently forever.
- Same invoice approved twice (double-click) → check `Status` transitioned
  from `Awaiting Approval` specifically, not just `= Approved`, to avoid
  double-sends.

---

## 7. Phase 2 — Flow B: Meeting Transcript → Tasks

### Trigger
Google Meet transcript is generated and lands in Notion (via Notion's native
meeting transcription feature) — this creates or updates a page.

### Flow
1. A cron polls the relevant Notion page/database for new or updated
   transcript entries.
2. Run Log: write a `processing` row.
3. Raw transcript text goes into central storage with `source =
   meeting_transcript`.
4. AI sort/structure function extracts: action items, owners (if named),
   due dates (if mentioned), and a short summary.
5. Structured tasks get written into a "Tasks" Notion database, each with
   `Status = Pending Review`.
6. Human reviews each generated task in Notion, can edit, approve, or
   delete.
7. On approval, `Status` becomes `Active` — this is the point where the
   task becomes real and actionable.
8. Run Log: write a `success` row noting how many tasks were extracted.

### Edge cases to handle
- Transcript with no clear action items → AI should return an empty task
  list, not hallucinate ones. Prompt this explicitly: "If no clear action
  item exists, return an empty array — never invent one."
- Very long transcript exceeding context comfortably → chunk it, or extract
  in sections, but keep a single Run Log row for the whole meeting, not one
  per chunk.
- Duplicate processing if the same transcript triggers twice → track a
  `last_processed_transcript_id` and skip if already handled.

---

## 8. Phase 2 — Flow C: Email/WhatsApp → Reminders & Schedule

### Trigger
A new email arrives (Gmail push via Pub/Sub — see the separate Gmail webhook
guide) or a new WhatsApp message arrives (OpenWA webhook).

### Flow
1. Webhook fires, payload lands in our service.
2. Run Log: write a `processing` row.
3. Content normalized into central storage with the correct `source`.
4. AI sort/structure function reads the message, determines: is this a
   request, a reminder-worthy item, a scheduling item, or noise? Extracts
   relevant fields (what, who, when).
5. If it's noise (spam, irrelevant chatter) → logged as `ignored` in Run Log,
   nothing further happens. This matters for "survives bad input."
6. If it's actionable → structured item written into a "Requests /
   Reminders" Notion database with `Status = Awaiting Approval`.
7. Human reviews, approves or edits in Notion.
8. On approval, our code can (depending on scope) send a confirmation reply,
   or simply mark the reminder as active — decide this scope explicitly and
   keep it consistent.
9. Run Log: write the final outcome row.

### Edge cases to handle
- Message in a language the AI model handles poorly → don't crash; if AI
  returns unparseable output, fall back to storing the raw message with
  `Status = Needs Manual Review` rather than losing it.
- Multiple messages arriving in a burst → make sure the webhook handler
  responds fast (200 OK immediately) and processes asynchronously, or you'll
  get retries and duplicate entries.

---

## 9. Notion Workspace Design

Build these databases. Design them to be genuinely readable by a stranger —
clear property names, sensible statuses, no raw JSON dumped into a text
field.

### 9.1 `Run Log` Database
| Property | Type |
|---|---|
| Summary | Title |
| Timestamp | Date (with time) |
| Flow | Select (`invoice`, `meeting_transcript`, `reminders`) |
| Trigger Type | Select (`webhook`, `cron`, `notion_poll`) |
| Status | Select (`success`, `failed`, `pending_approval`, `rejected`, `ignored`) |
| Related Item | Text (link back to the source item) |
| Error | Text |

### 9.2 `Invoices` Database
| Property | Type |
|---|---|
| Invoice Name | Title |
| File | Files & Media |
| Recipient Name | Text |
| Phone Number | Phone |
| Amount | Number |
| Due Date | Date |
| Status | Select (`New`, `Awaiting Approval`, `Approved`, `Rejected`, `Sent`, `Send Failed`, `Needs Info`) |

### 9.3 `Tasks` Database
| Property | Type |
|---|---|
| Task | Title |
| Source Meeting | Relation (to a Meetings DB, or Text) |
| Owner | Text or Person |
| Due Date | Date |
| Status | Select (`Pending Review`, `Active`, `Done`, `Rejected`) |
| AI Reasoning | Text (short — why AI extracted this) |

### 9.4 `Requests / Reminders` Database
| Property | Type |
|---|---|
| Item | Title |
| Source | Select (`email`, `whatsapp`) |
| Sender | Text |
| Category | Select (AI-assigned) |
| Priority | Select (`Low`, `Medium`, `High`) |
| Status | Select (`Awaiting Approval`, `Approved`, `Rejected`, `Ignored`) |
| Summary | Text |

### Formatting rules (apply to all databases)
- Never write raw model output directly into a property. Always pass it
  through a formatting step: short title, clean summary sentence, proper
  status.
- Use Select/Status properties instead of free text wherever the value is
  from a fixed set — this is what makes the workspace scannable at a glance.
- Add a short "AI Reasoning" or "Why" field where useful, so a human
  approving something can see *why* the AI categorized it that way without
  needing to read raw output.

---

## 10. The Run Log — Why It's Not Optional

This is graded explicitly and checked for authenticity. Two failure modes to
avoid entirely:

1. **Faking it** — creating Run Log rows by hand the night before the demo.
   The brief states plainly that rows written by an integration are
   attributed differently from rows typed by a person, and this gets
   checked. Every single row must come from your code calling the Notion API
   with your integration token.
2. **Sparse or clustered rows** — sixty rows all created in one evening looks
   exactly like a rows-by-hand fake, even if it technically wasn't. Run the
   system repeatedly across multiple days of the build period, with real or
   realistic test data, so the Run Log timestamps naturally spread out.

**Practical habit:** once Phase 1 is done, run a test trigger (a fake email,
a fake WhatsApp message) at least once a day for the rest of the build
period, purely to keep the Run Log populated with a real, spread-out history.

---

## 11. Human Approval Mechanics

The approval gate must be:
- **Inside Notion** — a `Status` property with select options, not a Slack
  message, not a custom UI.
- **Detectable by our code** — either polling for status changes or (if
  available and time permits) a Notion automation calling our webhook.
- **Idempotent** — approving something twice, or the poll picking up the
  same change twice, must not trigger the real-world action twice. Guard
  this with an explicit state transition check (only act if status changed
  *from* `Awaiting Approval` *to* `Approved`, and immediately flip it to an
  in-progress state before doing the action).
- **Visible in its "pending" state** — before approval, the item should be
  clearly distinguishable in Notion (a saved view filtered to `Status =
  Awaiting Approval` is enough) so a human doesn't need to hunt for what
  needs their attention.

---

## 12. AI Layer — OpenRouter Integration

- Sign up at openrouter.ai, generate an API key.
- Pick a free-tier model (check current free model list on OpenRouter — this
  changes over time, verify before committing).
- Keep every prompt strict: instruct the model to return **only** valid
  JSON, specify the exact schema expected, and always defensively parse the
  response (strip markdown fences, try/catch the JSON.parse, and fall back
  to a "needs manual review" state rather than crashing).
- Keep prompts source-specific but the calling function generic — this
  keeps the core reusable across all three flows as described in Section
  5.3.
- Log AI failures (unparseable output, timeout, rate limit) to the Run Log
  as `failed` with the raw error, not silently swallowed.

---

## 13. Deployment

- Deploy the service somewhere reachable over HTTPS with a stable public
  URL — Render, Railway, Fly.io, or a small VPS all work on free tiers.
- Environment variables to configure on the host: Notion integration token,
  Notion database IDs, OpenRouter API key, Gmail OAuth credentials/refresh
  token, WhatsApp session details for OpenWA.
- Keep secrets out of the repo — use the host's environment variable
  settings, not a committed `.env` file.
- Set up basic uptime monitoring (even a free service like UptimeRobot
  pinging a health-check endpoint) so a dead deploy doesn't go unnoticed
  mid-build.

---

## 14. Testing & Hardening Against Bad Input

The brief explicitly requires: no crash, no duplicates, nothing silently
lost, anything unhandled goes to a human instead of disappearing. Test each
of these deliberately:

| Test case | Expected behavior |
|---|---|
| Empty/blank message arrives | Logged as `ignored`, no crash |
| Malformed webhook payload | Caught, logged as `failed` with reason, service stays up |
| AI returns non-JSON garbage | Falls back to `Needs Manual Review`, not lost |
| Same webhook event delivered twice | Deduplicated (check an idempotency key/message ID before processing) |
| Notion API temporarily down | Retry with backoff, or queue and retry later — don't drop the item |
| WhatsApp session disconnected | Detected, logged, surfaced in Notion, doesn't silently fail forever |
| Extremely long input (huge email thread, long transcript) | Truncated/chunked sensibly, doesn't crash the AI call |
| Approval status changed rapidly (double-click) | Only one real-world action fires |

Write a short internal test log of when you ran each of these — useful both
for your own confidence and as a talking point in the demo ("we tested X and
here's what happens").

---

## 15. Timeline / Day-by-Day Plan

| Day | Focus |
|---|---|
| Day 1 | Notion workspace schema fully built (Section 9). Run Log writer built and tested with fake data. Repo scaffolding + deployment pipeline working (even with a "hello world" endpoint deployed). |
| Day 2 | Central data storage schema. Gmail webhook working end-to-end (payload arrives, gets parsed). OpenWA set up on a test number, webhook receiving messages. |
| Day 3 | AI sort/structure function built and tested against real sample messages from all three sources. Notion write functions built. |
| Day 4 | Flow A (Invoice) built fully end-to-end, including human approval detection and WhatsApp send. |
| Day 5 | Flow B (Meeting transcript) built end-to-end. Flow C (Reminders) built end-to-end. |
| Day 6 | Hardening pass — run through every case in Section 14. Fix crashes/edge cases found. |
| Day 7 | PPT built, demo script rehearsed, final Run Log check (spread of rows, no gaps, no fake-looking clusters). |

Adjust to your actual event length, but keep the ordering — Notion and Run
Log first, hardening before polish, never the reverse.

---

## 16. What Goes on the PPT

Structure the deck to mirror how judges will evaluate the project:

1. **The problem** — the specific "boring job" this kills, told concretely
   (e.g. "an agency's ops person spends 3 hours a week manually chasing
   invoice approvals and retyping WhatsApp requests into a sheet").
2. **The architecture diagram** — the flowchart from Section 3, labeled
   clearly: trigger, engine, AI, Notion, human, action, Run Log.
3. **The three flows**, each with a one-line description and a screenshot
   of the actual Notion database in use.
4. **A live/recorded Run Log screenshot** showing rows spread across
   multiple days with real timestamps — this is a direct answer to a
   judging criterion, make it visible.
5. **The human approval moment** — screenshot of the Notion status property
   before and after approval, showing what changed and why it matters.
6. **What happens on bad input** — briefly show one hardening case (e.g. a
   malformed message getting flagged instead of crashing the system).
7. **"Turn the service off" test** — explicitly state that the Notion
   workspace remains a usable operations hub even with the backend off,
   because it stores real state, not just a live view.
8. **What's next / what we'd build with more time** — shows awareness of
   scope, without pretending the demoed system does more than it does.

---

## 17. Judging Checklist — Self-Audit Before Demo

Go through this exact list before presenting:

- [ ] Can we point to a Run Log row and say exactly which code path wrote
      it, with a real timestamp?
- [ ] Are Run Log timestamps spread across multiple days, not clustered the
      night before?
- [ ] Does at least one flow pause and wait for real human approval inside
      Notion, not in our own UI?
- [ ] Does a real-world action happen outside Notion when approved (message
      sent, file sent, task created)?
- [ ] If we delete the repo/stop the server, does the Notion workspace
      still make sense to a stranger — showing what happened, what's
      pending, what needs attention?
- [ ] If we feed the system garbage input (blank message, malformed
      payload, gibberish), does it survive without crashing or losing the
      item silently?
- [ ] Is AI only used where a plain `if` statement genuinely couldn't do
      the job?
- [ ] Are commits spread across the build period, not one large commit at
      the end?

---

## 18. Common Pitfalls

- **Building the Notion workspace last.** It's a judging pillar — treat it
  with the same priority as the backend, from day one.
- **Faking Run Log entries.** Always write them through the actual
  integration, never typed manually, even for testing — build a
  `writeRunLog` call into your test scripts instead.
- **Routing every intermediate step through Notion.** Only the interface
  layer (data for humans to see/approve) belongs in Notion. Intermediate
  processing state belongs in your central data storage.
- **Letting AI make the final call.** AI structures and suggests; a human
  or an explicit rule decides what happens next. An AI-filled Notion
  property is not the same as an engine making a decision.
- **Silent duplicate actions.** Any flow that can be triggered twice (a
  retried webhook, a re-polled status) needs an idempotency check before it
  performs the real-world action.
- **Testing only the happy path.** The brief specifically rewards
  surviving bad input — dedicate real time to Section 14 before the demo,
  not as an afterthought.
- **Treating WhatsApp automation as risk-free.** OpenWA uses unofficial
  clients under the hood — use a dedicated test number, warm it up before
  demo day, and don't cold-message numbers that haven't messaged you first.
- **Losing track of the Gmail watch() expiry.** It expires after 7 days —
  make sure the renewal cron is running well before the demo, or the
  trigger dies silently mid-build.

---

## Quick Reference — Where Things Live

| Concern | Lives in |
|---|---|
| Raw incoming data | Central data storage (your DB) |
| Structured/sorted data | Central data storage, then pushed to Notion |
| Human-facing state | Notion (databases per flow) |
| Proof of execution | Notion `Run Log` database |
| Decision logic (rules) | Your code |
| Messy input interpretation | OpenRouter AI call, wrapped by your code |
| Real-world actions | Your code (WhatsApp send via OpenWA, task creation, etc.) |
