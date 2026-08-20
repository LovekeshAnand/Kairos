const { google } = require('googleapis');
require('dotenv').config();

let lastStoredHistoryId = null;

function getOAuth2Client() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
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
 * Initiates the users.watch() Pub/Sub subscription on the Gmail inbox
 */
async function startGmailWatch() {
  const gmail = getGmailClient();
  if (!gmail) {
    console.warn('⚠️ Gmail credentials not configured. Watch cannot be started.');
    return { success: false, reason: 'Missing credentials' };
  }

  try {
    const topicName = process.env.GMAIL_PUB_SUB_TOPIC;
    if (!topicName) {
      throw new Error('GMAIL_PUB_SUB_TOPIC is not defined in .env');
    }

    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
        labelFilterAction: 'include'
      }
    });

    lastStoredHistoryId = res.data.historyId;
    console.log(`✅ Gmail Watch successfully started! History ID: ${res.data.historyId}, Expiration: ${res.data.expiration}`);
    return { success: true, historyId: res.data.historyId, expiration: res.data.expiration };
  } catch (error) {
    console.error('❌ Failed to start Gmail watch:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches and parses full email details for a given message ID
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
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject');
    const sender = getHeader('From');
    const date = getHeader('Date');

    // Extract body
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
    console.error(`❌ Failed to fetch message ${messageId}:`, error.message);
    return null;
  }
}

/**
 * Handles incoming history updates from Pub/Sub push payloads
 */
async function processHistoryUpdate(newHistoryId, onNewEmailCallback) {
  const gmail = getGmailClient();
  if (!gmail) {
    console.warn('⚠️ Gmail client not ready for history processing.');
    return [];
  }

  if (!lastStoredHistoryId) {
    lastStoredHistoryId = newHistoryId;
    console.log(`ℹ️ Initialized baseline historyId to: ${newHistoryId}`);
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
          const emailData = await fetchMessage(m.message.id);
          if (emailData && onNewEmailCallback) {
            await onNewEmailCallback(emailData);
          }
          newMessages.push(emailData);
        }
      }
    }

    lastStoredHistoryId = newHistoryId;
    return newMessages;
  } catch (error) {
    // If historyId is too old (404/400), resync
    if (error.code === 404 || error.message?.includes('historyId')) {
      console.warn('⚠️ Stored historyId expired. Resyncing watch...');
      await startGmailWatch();
    } else {
      console.error('❌ Error processing Gmail history update:', error.message);
    }
    return [];
  }
}

/**
 * Sends a live email via Gmail API
 */
async function sendEmail({ to, subject, body, threadId = null }) {
  const gmail = getGmailClient();
  if (!gmail) {
    console.warn('⚠️ Gmail client not available. Simulating email send.');
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

  return res.data;
}

module.exports = {
  startGmailWatch,
  fetchMessage,
  processHistoryUpdate,
  sendEmail
};
