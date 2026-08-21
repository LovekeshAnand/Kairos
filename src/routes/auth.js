require('dotenv').config();
const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const storageService = require('../services/storageService');
const gmailService = require('../services/gmailService');
const whatsappService = require('../services/whatsappService');
const notionService = require('../services/notionService');

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const PORT = process.env.PORT || 3000;

function getRedirectUri(req) {
  if (process.env.GMAIL_REDIRECT_URI) return process.env.GMAIL_REDIRECT_URI;
  const host = req.get('host') || `localhost:${PORT}`;
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}/auth/google/callback`;
}

/**
 * GET /auth/google/login
 * Redirects user to Google OAuth2 Consent Screen
 */
router.get('/google/login', (req, res) => {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    return res.status(500).send('<h3>Error: GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET is missing from .env</h3>');
  }

  const redirectUri = getRedirectUri(req);
  console.log(`🔗 [Google OAuth] Initiating consent with redirect URI: ${redirectUri}`);

  const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]
  });

  res.redirect(authUrl);
});

/**
 * GET /auth/google/callback
 * Handles Google OAuth redirect, stores token, and starts watch
 */
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/?auth_error=No_code_provided');
  }

  try {
    const redirectUri = getRedirectUri(req);
    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;

    console.log(`\n🎉 [Google OAuth] Successfully authorized Gmail account: ${userEmail}`);

    // Update .env securely (which is gitignored)
    if (tokens.refresh_token) {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(__dirname, '..', '..', '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf-8');
        if (envContent.includes('GMAIL_REFRESH_TOKEN=')) {
          envContent = envContent.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
        } else {
          envContent += `\nGMAIL_REFRESH_TOKEN=${tokens.refresh_token}`;
        }
        fs.writeFileSync(envPath, envContent, 'utf-8');
      }
      process.env.GMAIL_REFRESH_TOKEN = tokens.refresh_token;
    }

    // Store only metadata in durable JSON state (no secrets stored in git-tracked files)
    const currentData = storageService.getAllData();
    if (!currentData.connected_accounts) currentData.connected_accounts = {};
    currentData.connected_accounts[userEmail] = {
      connected: true,
      authorizedAt: new Date().toISOString(),
      name: userInfo.data.name
    };
    storageService.saveAllData(currentData);

    // Start Gmail Watch
    try {
      await gmailService.startGmailWatch();
    } catch (watchErr) {
      console.warn('⚠️ Could not immediately start watch:', watchErr.message);
    }

    // Write to Notion Run Log
    await notionService.writeRunLog({
      flow: 'reminders',
      triggerType: 'webhook',
      status: 'success',
      summary: `Google Account "${userEmail}" successfully connected via OAuth onboarding.`,
      relatedItemId: userEmail
    });

    res.redirect(`/?auth_success=true&email=${encodeURIComponent(userEmail)}`);
  } catch (err) {
    console.error('❌ Google OAuth callback error:', err.message);
    res.redirect(`/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * POST /auth/google/disconnect
 * Disconnects the active Google Account
 */
router.post('/google/disconnect', (req, res) => {
  try {
    const store = storageService.getAllData();
    store.connected_accounts = {};
    storageService.saveAllData(store);

    // Also remove from .env
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      envContent = envContent.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, 'GMAIL_REFRESH_TOKEN=');
      fs.writeFileSync(envPath, envContent, 'utf-8');
      delete process.env.GMAIL_REFRESH_TOKEN;
    }

    console.log('🔌 [Google OAuth] Disconnected Google account.');
    res.json({ success: true, message: 'Google account disconnected successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /auth/whatsapp/disconnect
 * Disconnects and logs out the active WhatsApp session
 */
router.post('/whatsapp/disconnect', async (req, res) => {
  try {
    const result = await whatsappService.disconnectSession();
    console.log('🔌 [WhatsApp] Session disconnect requested:', result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /auth/whatsapp/qr.png
 * Direct PNG stream of current QR code
 */
router.get('/whatsapp/qr.png', async (req, res) => {
  try {
    const status = await whatsappService.getQRCode();
    if (!status.qr) {
      return res.status(404).send('QR not ready');
    }
    if (status.qr.startsWith('data:image/png;base64,')) {
      const base64Data = status.qr.replace(/^data:image\/png;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store, no-cache');
      return res.send(imgBuffer);
    }
    return res.redirect(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(status.qr)}`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/**
 * GET /auth/whatsapp/status
 * Returns live OpenWA connection state & QR code for frontend widget
 */
router.get('/whatsapp/status', async (req, res) => {
  try {
    const status = await whatsappService.getQRCode();
    res.json(status);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /auth/system/status
 * System overview for the dashboard
 */
router.get('/system/status', async (req, res) => {
  try {
    const notionCheck = await notionService.validateNotion();
    const waCheck = await whatsappService.checkOpenWAHealth();
    const store = storageService.getAllData();

    res.json({
      notion: notionCheck.success,
      notionBot: notionCheck.bot,
      openwa: waCheck.online,
      connectedAccounts: Object.keys(store.connected_accounts || {}),
      recentIncomingCount: store.incoming_items?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/notion/setup
 * 1-Click Automated Notion Onboarding Wizard from Web UI
 */
router.post('/notion/setup', async (req, res) => {
  const { notionApiKey, parentPageInput } = req.body || {};

  if (!notionApiKey || !parentPageInput) {
    return res.status(400).json({
      success: false,
      error: 'Both "notionApiKey" and "parentPageInput" (URL or Page ID) are required.'
    });
  }

  // Extract clean 32-char hex Page ID from full Notion URL or raw ID
  const cleanKey = notionApiKey.trim();
  let cleanPageId = parentPageInput.trim();

  // Match UUID with hyphens or 32 continuous hex chars anywhere in the URL
  const uuidMatch = cleanPageId.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  const hexMatch = cleanPageId.match(/([a-f0-9]{32})/i);

  if (uuidMatch) {
    cleanPageId = uuidMatch[1].replace(/-/g, '');
  } else if (hexMatch) {
    cleanPageId = hexMatch[1];
  } else {
    cleanPageId = cleanPageId.replace(/[^a-f0-9]/gi, '').slice(-32);
  }

  console.log(`\n📑 [Notion Setup Wizard] Parsed Parent Page ID: ${cleanPageId}`);

  try {
    const notionHeaders = {
      'Authorization': `Bearer ${cleanKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    };

    // 1. Verify Page Access
    const pageCheckRes = await fetch(`https://api.notion.com/v1/pages/${cleanPageId}`, {
      method: 'GET',
      headers: notionHeaders
    });
    if (!pageCheckRes.ok) {
      const errData = await pageCheckRes.json();
      return res.status(400).json({
        success: false,
        error: `Could not access page. Make sure you shared the page with your integration ("Connect to"): ${errData.message || pageCheckRes.statusText}`
      });
    }

    const results = {
      NOTION_API_KEY: cleanKey,
      NOTION_PARENT_PAGE_ID: cleanPageId
    };

    async function createDb(title, properties) {
      const resp = await fetch('https://api.notion.com/v1/databases', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          parent: { type: 'page_id', page_id: cleanPageId },
          title: [{ type: 'text', text: { content: title } }],
          properties
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(`Failed creating ${title}: ${data.message}`);
      return data.id;
    }

    // Create 5 Databases
    results.NOTION_RUN_LOG_DB_ID = await createDb('Run Log', {
      'Summary': { title: {} },
      'Timestamp': { date: {} },
      'Flow': { select: { options: [{ name: 'invoice', color: 'blue' }, { name: 'meeting_transcript', color: 'purple' }, { name: 'reminders', color: 'green' }] } },
      'Trigger Type': { select: { options: [{ name: 'webhook', color: 'blue' }, { name: 'cron', color: 'purple' }, { name: 'notion_poll', color: 'green' }] } },
      'Status': { select: { options: [{ name: 'success', color: 'green' }, { name: 'failed', color: 'red' }, { name: 'pending_approval', color: 'yellow' }, { name: 'rejected', color: 'gray' }, { name: 'ignored', color: 'brown' }] } },
      'Related Item': { rich_text: {} },
      'Error': { rich_text: {} }
    });

    results.NOTION_INVOICES_DB_ID = await createDb('Invoices', {
      'Invoice Name': { title: {} },
      'Recipient Name': { rich_text: {} },
      'Phone Number': { phone_number: {} },
      'Amount': { number: { format: 'dollar' } },
      'Due Date': { date: {} },
      'Status': { select: { options: [{ name: 'New', color: 'blue' }, { name: 'Awaiting Approval', color: 'yellow' }, { name: 'Approved', color: 'green' }, { name: 'Sent', color: 'purple' }, { name: 'Send Failed', color: 'red' }] } },
      'File': { files: {} }
    });

    results.NOTION_TASKS_DB_ID = await createDb('Tasks', {
      'Task': { title: {} },
      'Source Meeting': { rich_text: {} },
      'Owner': { rich_text: {} },
      'Due Date': { date: {} },
      'Status': { select: { options: [{ name: 'Pending Review', color: 'yellow' }, { name: 'Active', color: 'green' }, { name: 'Done', color: 'blue' }, { name: 'Rejected', color: 'gray' }] } },
      'AI Reasoning': { rich_text: {} }
    });

    results.NOTION_REQUESTS_DB_ID = await createDb('Requests / Reminders', {
      'Item': { title: {} },
      'Source': { select: { options: [{ name: 'email', color: 'red' }, { name: 'whatsapp', color: 'green' }] } },
      'Sender': { rich_text: {} },
      'Category': { select: { options: [{ name: 'Support', color: 'orange' }, { name: 'Billing', color: 'blue' }, { name: 'Meeting', color: 'purple' }, { name: 'General', color: 'default' }, { name: 'Urgent', color: 'red' }] } },
      'Priority': { select: { options: [{ name: 'Low', color: 'gray' }, { name: 'Medium', color: 'yellow' }, { name: 'High', color: 'red' }] } },
      'Status': { select: { options: [{ name: 'Awaiting Approval', color: 'yellow' }, { name: 'Approved', color: 'green' }, { name: 'Rejected', color: 'gray' }, { name: 'Ignored', color: 'brown' }, { name: 'Needs Manual Review', color: 'pink' }] } },
      'Summary': { rich_text: {} },
      'Human Response': { rich_text: {} }
    });

    results.NOTION_DOCUMENTS_DB_ID = await createDb('Documents', {
      'Document Name': { title: {} },
      'File': { files: {} },
      'Source': { select: { options: [{ name: 'whatsapp', color: 'green' }, { name: 'email', color: 'blue' }, { name: 'manual', color: 'orange' }] } },
      'Sender': { rich_text: {} },
      'Sender Name': { rich_text: {} },
      'Category': { select: { options: [{ name: 'Invoice', color: 'purple' }, { name: 'Contract', color: 'blue' }, { name: 'Receipt', color: 'green' }, { name: 'Resume', color: 'orange' }, { name: 'Identity', color: 'red' }, { name: 'General', color: 'default' }] } },
      'File Type': { select: { options: [{ name: 'PDF', color: 'red' }, { name: 'Image', color: 'green' }, { name: 'Document', color: 'blue' }, { name: 'Audio', color: 'yellow' }, { name: 'Other', color: 'gray' }] } },
      'AI Summary': { rich_text: {} },
      'Received Date': { date: {} }
    });

    // Update .env file automatically
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      Object.entries(results).forEach(([key, val]) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${val}`);
        } else {
          envContent += `\n${key}=${val}`;
        }
      });
      fs.writeFileSync(envPath, envContent, 'utf-8');
    }

    res.json({
      success: true,
      message: 'All 5 Notion databases initialized successfully!',
      databases: results
    });
  } catch (err) {
    console.error('❌ Notion Web Wizard error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

