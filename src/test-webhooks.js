const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:3000';

async function runTests() {
  console.log('🧪 Starting Webhook Verification Tests...\n');

  try {
    // 1. Health Check
    console.log('1️⃣ Testing Health Check (GET /health)...');
    const healthRes = await axios.get(`${BASE_URL}/health`);
    console.log('   Status:', healthRes.status, healthRes.data);

    // 2. WhatsApp Verification Challenge
    console.log('\n2️⃣ Testing WhatsApp Webhook Verification (GET /webhooks/whatsapp)...');
    const verifyRes = await axios.get(`${BASE_URL}/webhooks/whatsapp`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'kairos_webhook_secret_2026',
        'hub.challenge': 'CHALLENGE_ACCEPTED_7788'
      }
    });
    console.log('   Status:', verifyRes.status, 'Response:', verifyRes.data);

    // 3. WhatsApp Inbound Message
    console.log('\n3️⃣ Testing WhatsApp Incoming Message (POST /webhooks/whatsapp)...');
    const waPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550239999', phone_number_id: '109999999999' },
                contacts: [{ profile: { name: 'Aarav Sharma' }, wa_id: '919876543210' }],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgLOTExOTk5OTk5OTk5FQIAERgSRTk0OTYyOUU5RjhERkQ2NEIA',
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    text: { body: 'URGENT: Can you please confirm the venue permission for tomorrow morning session? We are waiting for approval.' },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };
    const waRes = await axios.post(`${BASE_URL}/webhooks/whatsapp`, waPayload);
    console.log('   Status:', waRes.status, waRes.data);

    // 4. Gmail Pub/Sub Webhook
    console.log('\n4️⃣ Testing Gmail Pub/Sub Notification (POST /webhooks/gmail)...');
    const gmailPubSubPayload = {
      message: {
        data: Buffer.from(JSON.stringify({
          emailAddress: 'user@example.com',
          historyId: '99887766'
        })).toString('base64'),
        messageId: 'pubsub-msg-12345',
        publishTime: new Date().toISOString()
      },
      subscription: 'projects/test-project/subscriptions/gmail-sub'
    };
    const gmailRes = await axios.post(`${BASE_URL}/webhooks/gmail`, gmailPubSubPayload);
    console.log('   Status:', gmailRes.status, gmailRes.data);

    // 5. Simulator Endpoint
    console.log('\n5️⃣ Testing Event Simulator (POST /webhooks/simulate)...');
    const simRes = await axios.post(`${BASE_URL}/webhooks/simulate`, {
      source: 'Gmail',
      sender: 'dean.academics@college.edu',
      subject: 'Urgent: Submit attendance register by 5 PM today',
      body: 'All department heads must submit the physical attendance register before 5:00 PM today without fail.'
    });
    console.log('   Status:', simRes.status);
    console.log('   AI Extraction Result:', JSON.stringify(simRes.data.result?.aiResult, null, 2));

    console.log('\n🎉 ALL WEBHOOK TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

runTests();
