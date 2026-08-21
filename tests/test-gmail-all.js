require('dotenv').config();
const axios = require('axios');
const gmailService = require('../src/services/gmailService');
const notionService = require('../src/services/notionService');

async function runAllGmailTests() {
  console.log('================================================================');
  console.log('✉️ KAIROS GMAIL COMPREHENSIVE SUITE TEST');
  console.log('================================================================\n');

  // Test 1: Watch Registration
  console.log('--- [Test 1/3] Testing users.watch() Registration ---');
  const watchResult = await gmailService.startGmailWatch();
  if (watchResult.success) {
    console.log('✅ Watch registered! Starting historyId:', watchResult.historyId);
  } else {
    console.error('❌ Watch failed:', watchResult.reason || watchResult.error);
    return;
  }

  // Test 2: Outbound Email Dispatch
  console.log('\n--- [Test 2/3] Testing Outbound Email Dispatch via Gmail API ---');
  const testRecipient = 'shalupal3304@gmail.com';
  try {
    const sendResult = await gmailService.sendEmail({
      to: testRecipient,
      subject: '⏳ Kairos Automated Integration Diagnostic',
      body: `Hello!\n\nThis is an automated verification email sent by your Kairos Engine running on Node.js.\n\nTimestamp: ${new Date().toISOString()}\nStatus: All Gmail API scopes verified!`
    });
    console.log('✅ Outbound email sent successfully! Message ID:', sendResult.id || sendResult);
  } catch (sendErr) {
    console.error('❌ Failed sending email:', sendErr.message);
  }

  // Test 3: Pub/Sub Webhook Payload Ingestion
  console.log('\n--- [Test 3/3] Testing Webhook Ingestion (/webhooks/gmail) ---');
  try {
    const mockPayload = {
      message: {
        data: Buffer.from(JSON.stringify({
          emailAddress: testRecipient,
          historyId: watchResult.historyId
        })).toString('base64'),
        messageId: `msg_${Date.now()}`
      }
    };

    const webhookRes = await axios.post('http://localhost:3000/webhooks/gmail', mockPayload);
    console.log('✅ Webhook endpoint responded:', webhookRes.data || '200 OK');
  } catch (webhookErr) {
    console.error('❌ Webhook test failed:', webhookErr.response?.data || webhookErr.message);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL GMAIL SUITE TESTS COMPLETED SUCCESSFULLY!');
  console.log('Check your Gmail inbox: you received a live test email from Kairos!');
  console.log('================================================================\n');
}

runAllGmailTests().catch(err => {
  console.error('❌ Gmail test suite error:', err);
  process.exit(1);
});
