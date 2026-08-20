# 🚀 Kairos — Complete Developer Setup & Onboarding Guide

> **Welcome to Kairos!** This guide contains step-by-step instructions for any developer to set up, configure, and run Kairos from scratch on a new machine.

---

## 📋 System Prerequisites

Before starting, ensure your machine has:
1. **Node.js (v18.0.0 or higher)**: [Download Node.js](https://nodejs.org/)
2. **npm (v9.0.0 or higher)** (comes bundled with Node.js)
3. **Google Chrome** (required by OpenWA for headless browser WhatsApp emulation)
4. **Git**: [Download Git](https://git-scm.com/)

---

## ⚡ Quickstart (1-Command Automated Setup)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/LovekeshAnand/Kairos.git
   cd Kairos
   ```

2. **Run the Automated Setup Script**:
   * **On Linux / macOS / Git Bash**:
     ```bash
     chmod +x setup.sh
     ./setup.sh
     ```
   * **On Windows PowerShell**:
     ```powershell
     .\setup.ps1
     ```

The script automatically installs all root and OpenWA dependencies, applies compatibility patches, checks your environment files, and launches the services.

---

## 🔑 Detailed Step-by-Step Service Configuration

To run live integrations with Notion, OpenRouter AI, WhatsApp, and Gmail, follow the setup steps below.

---

### 1. 📑 Notion Setup (Integration Token & 4 Databases)

#### Step 1.1: Create a Notion Integration
1. Go to the [Notion Developers Integrations Portal](https://www.notion.so/profile/integrations).
2. Click **"+ New integration"**.
3. Set the Name to **`Kairos`** and associate it with your Notion workspace.
4. Under Capabilities, ensure **Read content**, **Update content**, and **Insert content** are checked.
5. Click **Submit** and copy your **Internal Integration Secret** (starts with `ntn_...`).
6. Paste it into your `.env` file:
   ```env
   NOTION_API_KEY=ntn_your_secret_key_here
   ```

#### Step 1.2: Create a Parent Page in Notion
1. Open your Notion workspace.
2. Create a new blank page and title it: **`Kairos Operation Hub`**.
3. In the top-right corner of this page, click the **three dots (`...`)** menu.
4. Scroll down to **Connections** $\rightarrow$ click **"+ Add connections"**.
5. Search for and select your **`Kairos`** integration, then click **Confirm**.
   *(⚠️ Critical: If you skip this step, the integration will return a 404 Permission Denied error).*

#### Step 1.3: Copy the Parent Page ID
Look at the URL of your new Notion page in the browser address bar:
```
https://www.notion.so/myworkspace/Kairos-Operation-Hub-3c23cc964d1f80059d16f84a5264f066
```
The **32-character hexadecimal string** at the end (`3c23cc964d1f80059d16f84a5264f066`) is your `NOTION_PARENT_PAGE_ID`.
Add it to your `.env` file:
```env
NOTION_PARENT_PAGE_ID=3c23cc964d1f80059d16f84a5264f066
```

#### Step 1.4: Auto-Generate All 4 Notion Databases
Run the database creator script from the repository root:
```bash
npm run setup:notion
```
This script calls the Notion API and automatically creates the 4 required databases under your parent page with their exact schemas and property types:
* 📗 **`Run Log`** (Audit trail)
* 📄 **`Invoices`** (Invoice staging & approval)
* ✅ **`Tasks`** (Meeting action item extractor)
* 📥 **`Requests / Reminders`** (Inbound communications & AI drafting)

The script will output the 4 database IDs and automatically save them into your `.env` file.

---

### 2. 🤖 OpenRouter AI Configuration

1. Go to [OpenRouter](https://openrouter.ai/) and create a free account.
2. Navigate to [API Keys](https://openrouter.ai/keys) and generate an API key.
3. Open `.env` and configure your API key and preferred model:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   OPENROUTER_MODEL=google/gemma-4-31b-it:free
   ```
   *(Kairos supports up to 4 keys for auto-failover: `OPENROUTER_API_KEY_TWO`, `_THREE`, `_FOUR`).*

---

### 3. 💬 OpenWA WhatsApp Gateway Setup

Kairos uses a local, self-hosted [OpenWA](https://github.com/rmyndharis/OpenWA) gateway powered by `whatsapp-web.js` running in your local Chrome browser for maximum anti-ban safety.

1. **Start the OpenWA Server**:
   ```bash
   cd openwa
   npm run start:dev
   ```
2. **Open the OpenWA Dashboard**:
   Open your browser to [http://localhost:2785](http://localhost:2785) (or `http://localhost:2886`).
3. **Link Your WhatsApp Account**:
   * If a session named `kairos-session` does not exist, create a new session.
   * A QR code will appear on screen.
   * Open WhatsApp on your phone $\rightarrow$ **Settings** (or 3 dots) $\rightarrow$ **Linked Devices** $\rightarrow$ **Link a Device** $\rightarrow$ Scan the QR code.
   * The status will update to **`ready` / `authenticated`**.
4. **Copy the Session ID & API Key**:
   * Add your session ID and API key to root `.env`:
     ```env
     OPENWA_API_URL=http://localhost:2785
     OPENWA_API_KEY=owa_k1_your_api_key
     OPENWA_SESSION_ID=your_session_uuid
     ```
   * *Note: The session is saved on disk under `openwa/data/sessions`, so you will not need to re-scan every time.*

---

### 4. ✉️ Gmail OAuth2 & Pub/Sub Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Gmail API** and **Cloud Pub/Sub API**.
3. Create an **OAuth 2.0 Client ID** (Web application).
4. Create a Pub/Sub topic named `gmail-notifications` and grant publisher permissions to `gmail-api-push@system.gserviceaccount.com`.
5. Add your credentials to `.env`:
   ```env
   GOOGLE_CLOUD_PROJECT_ID=your_project_id
   GMAIL_PUB_SUB_TOPIC=projects/your_project_id/topics/gmail-notifications
   GMAIL_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=GOCSPX-your_client_secret
   GMAIL_REFRESH_TOKEN=1//your_oauth_refresh_token
   ```

---

## 🏃‍♂️ Running the Server

Start the Kairos engine with live hot-reloading:
```bash
npm run dev
```

You should see:
```
================================================================
⏳ KAIROS AUTONOMOUS OPERATIONS ENGINE (NOTION TRACK)
================================================================
🚀 Engine running at:  http://127.0.0.1:3000
🏥 Health Check:       http://127.0.0.1:3000/health
📌 Webhook Endpoints:
   - Gmail Pub/Sub:    POST http://127.0.0.1:3000/webhooks/gmail
   - WhatsApp Inbound: POST http://127.0.0.1:3000/webhooks/whatsapp
   - Transcripts:      POST http://127.0.0.1:3000/webhooks/transcript
   - Multi-Simulator:  POST http://127.0.0.1:3000/webhooks/simulate
================================================================

✅ Connected to Notion as bot: "Kairos"
✅ OpenWA Gateway is online on port 2785
✅ [Gmail] users.watch() active!
🔄 [State Engine] Background poller started (polling Notion every 15s)...
```

---

## 🧪 Validating with Automated Tests

Run the built-in test suite to verify all integrations:

1. **Full System Pipeline Test**:
   ```bash
   npm run test:all
   ```
   *Verifies Notion connectivity, Run Log creation, AI structuring, Flow B transcript extraction, and Flow C request staging.*

2. **Flow A Invoice Dispatch Test**:
   ```bash
   npm run test:flow-a
   ```
   *Simulates staging an invoice, human approval in Notion, and automated WhatsApp dispatch.*

3. **Standalone Notion Database Test**:
   ```bash
   npm run test:notion
   ```

---

## 📱 Live End-to-End Test (WhatsApp Case 1)

1. Keep `npm run dev` running.
2. Have a contact send a WhatsApp message to your paired number (e.g. *"Can we schedule a meeting tomorrow at 4 PM?"* or in Hinglish *"bhai kal 4 baje meeting rakh le"*).
3. Check your Notion **Requests / Reminders** database — the message will appear within seconds with AI categorization and a drafted reply!
4. Change the status property from `Awaiting Approval` to **`Approved`**.
5. Within 15 seconds, Kairos detects the approval, dispatches the WhatsApp reply directly to the sender, and logs the execution in the Notion **Run Log**!
