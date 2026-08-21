require('dotenv').config();
const { google } = require('googleapis');
const gmailService = require('../src/services/gmailService');
const pipelineService = require('../src/services/pipelineService');

async function syncGmailInbox() {
  console.log('🔄 Checking for new emails in Gmail inbox...');
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  const auth = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth });

  const profile = await gmail.users.getProfile({ userId: 'me' });
  console.log(`📌 Current Gmail Profile History ID: ${profile.data.historyId}`);

  // Fetch latest messages from INBOX
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 5,
    q: 'label:INBOX'
  });

  const messages = listRes.data.messages || [];
  console.log(`Found ${messages.length} recent message(s) in INBOX.`);

  for (const m of messages) {
    const emailData = await gmailService.fetchMessage(m.id);
    if (emailData) {
      console.log(`\n📬 Processing: "${emailData.subject}" from ${emailData.sender}`);
      const res = await pipelineService.processInboundCommunication({
        source: 'email',
        sender: emailData.sender,
        subject: emailData.subject,
        body: emailData.body,
        sourceId: `gmail_${emailData.id}`
      });
      console.log('✅ Staged in Notion:', res.notionPageId || 'staged');
    }
  }
}

syncGmailInbox().catch(console.error);
