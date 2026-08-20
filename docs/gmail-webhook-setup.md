# Gmail Webhook Setup Guide (Gmail API + Cloud Pub/Sub)

Gmail has no direct webhook system. Instead, Gmail publishes mailbox change
events to a **Google Cloud Pub/Sub topic**, and Pub/Sub pushes those events
to your server as an HTTP POST. This gives you a real, event-driven trigger
instead of polling.

```
New email arrives → Gmail → Pub/Sub topic → Pub/Sub push subscription
    → POST to your webhook URL → your code fetches the actual message
```

---

## Prerequisites

- A Google Cloud account (free tier is enough)
- The Gmail inbox you want to monitor
- Your service already deployed somewhere reachable over HTTPS
  (Render, Railway, Fly.io, a VPS, etc. — localhost will not work unless
  tunneled with something like ngrok for testing)

---

## Step 1 — Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or reuse one)
3. Note the **Project ID** — you'll need it later

---

## Step 2 — Enable the required APIs

In **APIs & Services → Library**, enable:

- **Gmail API**
- **Cloud Pub/Sub API**

---

## Step 3 — Create a Pub/Sub Topic

1. Go to **Pub/Sub → Topics → Create Topic**
2. Name it, e.g. `gmail-notifications`
3. Create it

### Grant Gmail permission to publish to this topic

Gmail publishes to your topic as a special Google-managed service account.
You must explicitly grant it access, or `watch()` will fail.

1. Open your topic → **Permissions** → **Add Principal**
2. Principal: `gmail-api-push@system.gserviceaccount.com`
3. Role: **Pub/Sub Publisher**
4. Save

---

## Step 4 — Create a Push Subscription

1. Inside your topic, go to **Subscriptions → Create Subscription**
2. Delivery type: **Push**
3. Endpoint URL: your deployed webhook route, e.g.
   `https://your-service.onrender.com/webhooks/gmail`
4. Create the subscription

Pub/Sub will now POST a JSON payload to this URL every time Gmail
publishes a change event to the topic.

> Optional but recommended: enable **authentication** on the push
> subscription (OIDC token) so your endpoint can verify the request
> actually came from Pub/Sub and not from a random POST.

---

## Step 5 — Set Up OAuth2 for the Gmail Account

You need OAuth2 credentials to call the Gmail API on behalf of the inbox
you're watching.

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Add your redirect URI (wherever your app handles the OAuth callback)
4. Complete the consent screen setup (can stay in "Testing" mode for a
   hackathon — just add the Gmail account as a test user)
5. Run the OAuth consent flow once for the target inbox and store the
   resulting **refresh token** securely — your service will use it to
   get fresh access tokens going forward

Required scope:
```
https://www.googleapis.com/auth/gmail.readonly
```
(or `gmail.modify` if you need to mark messages as read/archive, etc.)

---

## Step 6 — Call `users.watch()` to Start the Subscription

Using the Gmail API client (Node.js example):

```javascript
const { google } = require('googleapis');

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

async function startWatch() {
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: 'projects/YOUR_PROJECT_ID/topics/gmail-notifications',
      labelIds: ['INBOX'],       // optional filter
      labelFilterAction: 'include'
    }
  });

  console.log(res.data);
  // { historyId: '1234567', expiration: '1699999999999' }
}
```

Save the returned `historyId` — you'll need it as your starting point.

> **Important:** `watch()` subscriptions expire after **7 days maximum**.
> You must re-call `watch()` periodically (see Step 9) or the trigger goes
> silently dead.

---

## Step 7 — Handle the Incoming Push Payload

The payload Pub/Sub sends to your webhook does **not** contain the email.
It only tells you that *something* changed:

```json
{
  "message": {
    "data": "eyJlbWFpbEFkZHJlc3MiOiAidXNlckBleGFtcGxlLmNvbSIsICJoaXN0b3J5SWQiOiAiMTIzNDU2NyJ9",
    "messageId": "...",
    "publishTime": "..."
  },
  "subscription": "..."
}
```

- `data` is base64-encoded JSON: `{ emailAddress, historyId }`
- Decode it to get the new `historyId`

```javascript
app.post('/webhooks/gmail', (req, res) => {
  const payload = JSON.parse(
    Buffer.from(req.body.message.data, 'base64').toString('utf-8')
  );
  console.log(payload); // { emailAddress, historyId }

  // Acknowledge immediately — Pub/Sub expects a fast 200
  res.sendStatus(200);

  // Process asynchronously
  processHistoryUpdate(payload.historyId);
});
```

---

## Step 8 — Fetch What Actually Changed

The `historyId` tells you where to look, not what happened. Call
`history.list()` from your **last known historyId** to the new one:

```javascript
async function processHistoryUpdate(newHistoryId) {
  const res = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: lastStoredHistoryId, // from your DB
    historyTypes: ['messageAdded']
  });

  const messages = res.data.history?.flatMap(h => h.messagesAdded || []) || [];

  for (const m of messages) {
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: m.message.id,
      format: 'full'
    });
    // full.data now has the actual email content, headers, etc.
    handleNewEmail(full.data);
  }

  // Update your stored historyId for next time
  lastStoredHistoryId = newHistoryId;
}
```

> If `history.list()` returns a 404 (historyId too old / expired), you've
> missed the window — call `watch()` again to resync from scratch instead
> of crashing.

---

## Step 9 — Renew the Watch Before It Expires

Set up a small scheduled job (cron, or any free scheduler like
cron-job.org, GitHub Actions on a schedule, etc.) that re-calls
`users.watch()` every 5–6 days, well before the 7-day expiry.

```javascript
// Run this on a schedule, e.g. every 5 days
async function renewWatch() {
  await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: 'projects/YOUR_PROJECT_ID/topics/gmail-notifications',
      labelIds: ['INBOX']
    }
  });
}
```

---

## Step 10 — Feed Into Your Central Data Storage

Once you have the parsed email (`full.data`), push it into the same
intermediate storage layer that your WhatsApp webhook writes to, so both
sources feed the same downstream "sorted and prioritized by AI" step.

---

## Common Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| `watch()` fails with permission error | Gmail's service account not granted publisher role | Re-check Step 3 permissions |
| No pushes ever arrive | Subscription endpoint unreachable / not HTTPS | Confirm deployed URL is public and HTTPS |
| `history.list()` returns 404 | `historyId` too old (expired or service was down) | Catch this and call `watch()` again to resync |
| Trigger silently stops after a week | Forgot to renew `watch()` | Add the Step 9 cron job from day one |
| Duplicate processing | Not tracking last processed `historyId` | Persist `historyId` in your DB, not in memory |

---

## Scopes Reference

| Scope | Use |
|---|---|
| `gmail.readonly` | Read-only access — enough if you only need to read and route emails |
| `gmail.modify` | Read + label/archive/mark-as-read — use if your workflow needs to update the source email after processing |

---

## Alternative: If This Is Too Heavy for the Timeline

If Pub/Sub setup eats too much time, a fallback that still counts as
"runs without you" per the brief is a **cron-based poll** using
`gmail.users.messages.list()` with a `q=is:unread` filter every 1–2
minutes. It's not a true push webhook, but it still satisfies "a cron... fires
it, on something you deployed" — just be upfront that it's polling, not
push, if judges ask about the architecture.
