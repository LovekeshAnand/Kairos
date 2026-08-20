# Kairos — Project Structure & Architecture

> **Kairos** is an Autonomous AI Operations Engine built for the Notion Track.
> Notion is the human-facing control hub. Kairos is the code engine running underneath.

---

## 📁 Directory Structure

```
d:\Kairos\
│
├── 📄 .env                         # Live credentials (never committed)
├── 📄 .env.example                 # Safe credential template for new developers
├── 📄 .gitignore                   # Ignores .env, node_modules, data/, openwa sessions
├── 📄 package.json                 # Node.js project manifest with npm scripts
├── 📄 setup.sh                     # One-command automated setup & runner for Linux / macOS / Git Bash
├── 📄 setup.ps1                    # One-command automated setup & runner for Windows PowerShell
├── 📄 README.md                    # High-level project overview and setup guide
├── 📄 STRUCTURE.md                 # Full project directory map & milestones
├── 📄 SETUP_GUIDE.md               # Step-by-step developer onboarding & Notion setup guide
├── 📄 PROGRESS_AND_GMAIL_GUIDE.md  # Current project status & multi-user Gmail roadmap
│
├── 📂 src/                         # Core Application Engine
│   ├── 📄 server.js                # Express server — startup, routes, health, watch renewal
│   │
│   ├── 📂 routes/
│   │   └── 📄 webhooks.js          # All inbound webhook endpoints (Gmail, WhatsApp, Transcript, Simulate)
│   │
│   └── 📂 services/
│       ├── 📄 notionService.js     # All 4 Notion database R/W operations + Run Log writer
│       ├── 📄 aiService.js         # OpenRouter multi-key AI engine + heuristic fallback
│       ├── 📄 whatsappService.js   # OpenWA gateway client (send text, send media, parse webhooks)
│       ├── 📄 gmailService.js      # Gmail OAuth2 + Pub/Sub history tracking + send email
│       ├── 📄 pipelineService.js   # Flow A, B, C orchestration + background state poller
│       └── 📄 storageService.js    # Durable local JSON store + idempotency cache
│
├── 📂 tests/                       # All verification and simulation tests
│   ├── 📄 test-pipeline.js         # Full 5-step system validation test (Notion, AI, Flows B & C)
│   ├── 📄 test-flow-a.js           # Flow A end-to-end: Invoice create → approval → WhatsApp dispatch
│   ├── 📄 test-notion.js           # Standalone Notion connectivity + Run Log write test
│   └── 📄 test-webhooks.js         # Live webhook endpoint simulation tests (requires server running)
│
├── 📂 scripts/                     # Setup and utility scripts
│   └── 📄 init-notion-databases.js # Creates all 4 Notion databases under the parent page
│
├── 📂 docs/                        # Project documentation and specifications
│   ├── 📄 project-guide.md         # Full hackathon project blueprint (Phases, Schemas, Flows)
│   ├── 📄 notion_track.md          # Notion Track judging criteria and requirements
│   ├── 📄 gmail-webhook-setup.md   # Step-by-step Gmail Pub/Sub push subscription guide
│   └── 🖼️  architecture.png         # Hand-drawn system architecture diagram
│
├── 📂 openwa/                      # Local WhatsApp Gateway (submodule — rmyndharis/OpenWA)
│   ├── 📄 .env                     # OpenWA environment config (Chrome path, port, dashboard)
│   └── ...                         # Full OpenWA gateway source (NestJS + whatsapp-web.js)
│
└── 📂 data/                        # Runtime data storage (gitignored)
    ├── 📄 kairos-store.json        # Central durable store: events, idempotency keys, Gmail watch state
    └── 📂 sessions/                # OpenWA encrypted WhatsApp session (no re-scan needed)
```

---

## ⚡ The Three Automated Flows

### Flow A — Invoice Dispatch via WhatsApp
```
Notion Invoices DB
  [Status: New]
       │
       ▼ (Poller: every 15s)
  AI Validation / Flag Missing Phone
       │
       ▼
  [Status: Awaiting Approval]
  ← Human reviews in Notion →
       │
       ▼ (Poller detects "Approved")
  OpenWA WhatsApp Gateway
  Send invoice text / PDF to recipient
       │
       ▼
  [Status: Sent]
  📗 Run Log: "Invoice sent via WhatsApp"
```

### Flow B — Meeting Transcript → Action Items
```
POST /webhooks/transcript
  { transcript, meetingTitle }
       │
       ▼
  OpenRouter AI (google/gemma-4-31b-it:free)
  Extract discrete tasks, owners, due dates
       │
       ▼
  Notion Tasks DB
  [Status: Pending Review] for each task
       │
       ▼
  📗 Run Log: "X tasks extracted from meeting"
```

### Flow C — Inbound Email / WhatsApp → Reminders
```
Gmail Pub/Sub Push → POST /webhooks/gmail
WhatsApp Event    → POST /webhooks/whatsapp
       │
       ▼
  Idempotency Check (storageService)
       │
       ▼
  OpenRouter AI: Categorize, Prioritize, Draft Reply
       │
       ▼ (if noise → log as "ignored")
  Notion Requests DB
  [Status: Awaiting Approval]
  ← Human reads summary + draft in Notion →
       │
       ▼ (Poller detects "Approved")
  Gmail sendEmail() or OpenWA sendWhatsAppMessage()
       │
       ▼
  📗 Run Log: "Approved reply dispatched"
```

---

## 🗄️ Notion Databases

| Database | ID | Purpose |
|---|---|---|
| 📗 **Run Log** | `3c23cc96-4d1f-813c-8e6f-e56c60d03d8f` | Immutable audit trail — every single execution is logged here |
| 📄 **Invoices** | `3c23cc96-4d1f-8170-baeb-ff6b6b3594d2` | Invoice staging, human approval gate, and dispatch tracking |
| ✅ **Tasks** | `3c23cc96-4d1f-818e-86db-da26b1691a56` | AI-extracted action items from Google Meet transcripts |
| 📥 **Requests** | `3c23cc96-4d1f-81c1-addb-faba587f6ed6` | Inbound email/WhatsApp messages with AI-drafted replies |

---

## 🤖 AI Layer (OpenRouter)

- **Model**: `google/gemma-4-31b-it:free` (active free model)
- **Fallback Chain**: 4 API keys auto-failover → heuristic engine → zero crash guarantee
- **Prompts by source**:
  - `structureEmail()` — categorize email, draft professional reply
  - `structureWhatsApp()` — parse WhatsApp intent, detect noise
  - `structureTranscript()` — extract tasks, owners, due dates from meeting transcripts

---

## 💬 WhatsApp Gateway (OpenWA)

- **Source**: [github.com/rmyndharis/OpenWA](https://github.com/rmyndharis/OpenWA)
- **Engine**: `whatsapp-web.js` + Puppeteer (system Chrome, anti-ban)
- **Port**: `2785` (REST API) + `2886` (Dashboard)
- **Session**: `9337cc9c-8643-4137-8fae-91302bb86593` (Lovekesh Anand +91 89297 50553 — paired)
- **Anti-ban safeguards**: Human-delay before sends, encrypted session persistence, no broadcasting

---

## ✉️ Gmail Integration

- **Method**: OAuth2 Refresh Token (no re-login needed)
- **Inbound**: Google Cloud Pub/Sub push subscription → `POST /webhooks/gmail`
- **Processing**: `history.list()` incremental delta fetching (avoids full inbox scan)
- **Watch Renewal**: Auto-renews every 5 days (Gmail push subscriptions expire in 7 days)
- **Outbound**: `gmail.users.messages.send()` with base64-encoded RFC-2822 message

---

## 🚀 NPM Scripts

| Command | Description |
|---|---|
| `npm start` | Start Kairos production server |
| `npm run dev` | Start with auto-reload (node --watch) |
| `npm run test:all` | Run full 5-step end-to-end system validation |
| `npm run test:notion` | Standalone Notion connectivity test |
| `npm run test:flow-a` | Flow A end-to-end: Invoice → Approval → WhatsApp |
| `npm run test:webhooks` | Simulate all 3 flows via HTTP (server must be running) |
| `npm run setup:notion` | Initialize all 4 Notion databases |

---

## 🔑 Services & Credentials

| Service | Configuration Key(s) |
|---|---|
| Notion API | `NOTION_API_KEY`, `NOTION_PARENT_PAGE_ID`, 4 DB IDs |
| OpenRouter AI | `OPENROUTER_API_KEY` through `_FOUR`, `OPENROUTER_MODEL` |
| Gmail | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_PUB_SUB_TOPIC` |
| OpenWA Gateway | `OPENWA_API_URL`, `OPENWA_API_KEY`, `OPENWA_SESSION_ID` |

---

## 📅 Milestones Completed

- [x] Notion 4-database infrastructure created and validated
- [x] OpenWA local gateway cloned, configured, and WhatsApp paired
- [x] OpenRouter multi-key AI engine with auto-failover implemented
- [x] Flow A: Invoice lifecycle (New → Awaiting Approval → Approved → WhatsApp → Sent)
- [x] Flow B: Meeting transcript → task extraction → Tasks DB
- [x] Flow C: Inbound email/WhatsApp → AI categorization → Requests DB → reply dispatch
- [x] Gmail Pub/Sub watch subscription with auto-renewal
- [x] Idempotency cache to prevent duplicate event processing
- [x] Authentic immutable Run Log written by code to Notion
- [x] Full project restructure: `src/`, `tests/`, `scripts/`, `docs/`
