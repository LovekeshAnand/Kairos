const { google } = require('googleapis');
const storageService = require('./storageService');
require('dotenv').config();

function getOAuth2Client() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: GMAIL_REFRESH_TOKEN
  });

  return oauth2Client;
}

function getGmailClient() {
  const auth = getOAuth2Client();
  if (!auth) return null;
  return google.gmail({ version: 'v1', auth });
}

/**
 * Initiates or renews the users.watch() Pub/Sub subscription on Gmail
 */
async function startGmailWatch() {
  const gmail = getGmailClient();
  if (!gmail) {
    console.warn('⚠️ Gmail credentials not fully configured in .env. Skipping watch registration.');
    return { success: false, reason: 'Missing credentials' };
  }

  const topicName = process.env.GMAIL_PUB_SUB_TOPIC;
  if (!topicName) {
    console.warn('⚠️ GMAIL_PUB_SUB_TOPIC is not defined in .env.');
    return { success: false, reason: 'Missing GMAIL_PUB_SUB_TOPIC' };
  }

  try {
    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
        labelFilterAction: 'include'
      }
    });

    storageService.updateWatchState({
      lastHistoryId: res.data.historyId,
      watchExpiration: res.data.expiration,
      lastRenewed: new Date().toISOString()
    });

    console.log(`✅ [Gmail] users.watch() active! Starting historyId: ${res.data.historyId}, Expires: ${new Date(Number(res.data.expiration)).toLocaleString()}`);
    return { success: true, historyId: res.data.historyId, expiration: res.data.expiration };
  } catch (error) {
    console.error('❌ [Gmail] Failed to register users.watch():', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches and parses an email message by ID
 */
async function fetchMessage(messageId) {
  const gmail = getGmailClient();
  if (!gmail) return null;

  try {
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const headers = res.data.payload?.headers || [];
    const getHeader = name => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject');
    const sender = getHeader('From');
    const date = getHeader('Date');

    // Extract text body
    let body = '';
    const parts = res.data.payload?.parts || [];
    if (res.data.payload?.body?.data) {
      body = Buffer.from(res.data.payload.body.data, 'base64').toString('utf-8');
    } else if (parts.length > 0) {
      const textPart = parts.find(p => p.mimeType === 'text/plain') || parts[0];
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    }

    return {
      id: res.data.id,
      threadId: res.data.threadId,
      sender,
      subject,
      date,
      body: body.trim() || res.data.snippet || ''
    };
  } catch (error) {
    console.error(`❌ [Gmail] Failed fetching message ${messageId}:`, error.message);
    return null;
  }
}

/**
 * Handles incoming history updates from Pub/Sub push payloads
 */
async function processHistoryUpdate(newHistoryId, onNewEmailCallback) {
  const gmail = getGmailClient();
  if (!gmail) return [];

  const watchState = storageService.getWatchState();
  const lastStoredHistoryId = watchState.lastHistoryId;

  if (!lastStoredHistoryId) {
    storageService.updateWatchState({ lastHistoryId: newHistoryId });
    console.log(`ℹ️ Baseline Gmail historyId initialized to: ${newHistoryId}`);
    return [];
  }

  try {
    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastStoredHistoryId,
      historyTypes: ['messageAdded']
    });

    const histories = res.data.history || [];
    const newMessages = [];

    for (const h of histories) {
      const added = h.messagesAdded || [];
      for (const m of added) {
        if (m.message?.id) {
          // Idempotency check
          if (!storageService.isProcessed(`gmail_${m.message.id}`)) {
            const emailData = await fetchMessage(m.message.id);
            if (emailData) {
              storageService.markProcessed(`gmail_${m.message.id}`, { subject: emailData.subject });
              if (onNewEmailCallback) {
                await onNewEmailCallback(emailData);
              }
              newMessages.push(emailData);
            }
          }
        }
      }
    }

    storageService.updateWatchState({ lastHistoryId: newHistoryId });
    return newMessages;
  } catch (error) {
    if (error.code === 404 || error.message?.includes('historyId')) {
      console.warn('⚠️ Stored Gmail historyId expired. Re-registering watch...');
      await startGmailWatch();
    } else {
      console.error('❌ [Gmail] Error processing history update:', error.message);
    }
    return [];
  }
}

/**
 * Sends an email via Gmail API
 */
async function sendEmail({ to, subject, body, threadId = null }) {
  const gmail = getGmailClient();
  if (!gmail) {
    console.warn('⚠️ Gmail client not configured. Simulating email dispatch.');
    return { simulated: true, to, subject };
  }

  const rawMessage = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body
  ].join('\r\n');

  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const requestBody = { raw: encodedMessage };
  if (threadId) requestBody.threadId = threadId;

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody
  });

  console.log(`✉️ [Gmail] Email successfully sent to ${to}: "${subject}"`);
  return res.data;
}

module.exports = {
  startGmailWatch,
  fetchMessage,
  processHistoryUpdate,
  sendEmail
};
