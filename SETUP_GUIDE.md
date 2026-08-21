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

### 1. 📑 Notion Setup (1-Click Automated Setup)

You can set up your Notion workspace in **2 simple minutes** either via the Web Dashboard or CLI:

#### Method A: Via Web Dashboard (Easiest)
1. Start the engine (`npm start`) and open **`http://localhost:3000`**.
2. Under **"1-Click Notion Setup"**:
   - Paste your **Notion Integration Secret** (`ntn_...`).
   - Paste your **Parent Page URL** directly from the browser address bar.
   - Click **"⚡ Auto-Create All 5 Databases"**.
3. All 5 databases will be built inside your Notion page instantly!

---

#### Method B: Via CLI & .env
1. **Create Integration**: Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations) $\rightarrow$ Create integration **`Kairos`** $\rightarrow$ Copy Secret (`ntn_...`).
2. **Create Parent Page**: In Notion, create a blank page titled **`Kairos Operations Hub`** $\rightarrow$ Click `···` $\rightarrow$ **Connect to** $\rightarrow$ select **`Kairos`**.
3. **Set .env**:
   ```env
   NOTION_API_KEY=ntn_your_secret_key_here
   NOTION_PARENT_PAGE_ID=3c23cc964d1f80059d16f84a5264f066
   ```
4. **Run 1-Command Builder**:
   ```bash
   npm run setup:notion
   ```
   This automatically constructs all 5 databases nested in your page:
   * 📗 **`Run Log`** (Audit trail with timestamps & flows)
   * 📄 **`Invoices`** (Invoice staging, file attachments & approval gate)
   * ✅ **`Tasks`** (Meeting action item extractor)
   * 📥 **`Requests / Reminders`** (Inbound communications & Human Response overrides)
   * 📂 **`Documents`** (Central repository for files from WhatsApp & Email)

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

#### Required Google Cloud OAuth Scopes:
Ensure the following scopes are added in your Google Cloud Console (under **OAuth consent screen $\rightarrow$ Scopes**):
* `https://www.googleapis.com/auth/gmail.readonly` *(Read inbound emails)*
* `https://www.googleapis.com/auth/gmail.send` *(Dispatch approved email replies & invoices)*
* `https://www.googleapis.com/auth/userinfo.email` *(Fetch user email address)*
* `https://www.googleapis.com/auth/userinfo.profile` *(Fetch user profile details)*

> 💡 **Tip for Testing / Demos**: Keep the OAuth consent screen in **"Testing"** mode and add your test Gmail accounts under **Test Users**. No Google security review is required! Users can connect in 1 click at `http://localhost:3000`.

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
