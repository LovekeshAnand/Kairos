const axios = require('axios');

const BASE_URL = process.env.KAIROS_API_URL || 'http://localhost:3000';

async function testWebhooks() {
  console.log(`Testing Webhook Endpoints against ${BASE_URL}...\n`);

  try {
    // 1. Health Check
    console.log('1. Testing GET /health');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Response:', health.data);

    // 2. Simulate Flow C
    console.log('\n2. Testing POST /webhooks/simulate (Flow C - Inbound Message)');
    const simC = await axios.post(`${BASE_URL}/webhooks/simulate`, {
      flow: 'C',
      payload: {
        source: 'whatsapp',
        sender: '918929750553',
        body: 'Hello, could you please send me the updated invoice for our project?'
      }
    });
    console.log('✅ Flow C Simulation:', simC.data);

    // 3. Simulate Flow B
    console.log('\n3. Testing POST /webhooks/simulate (Flow B - Transcript)');
    const simB = await axios.post(`${BASE_URL}/webhooks/simulate`, {
      flow: 'B',
      payload: {
        meetingTitle: 'Client Kickoff Meeting',
        transcript: 'Client: "Please send the agreement by Monday." Manager: "Sure, Alex will handle that."'
      }
    });
    console.log('✅ Flow B Simulation:', simB.data);

    // 4. Simulate Flow A
    console.log('\n4. Testing POST /webhooks/simulate (Flow A - Invoice)');
    const simA = await axios.post(`${BASE_URL}/webhooks/simulate`, {
      flow: 'A',
      payload: {
        invoiceName: 'Invoice #TEST-999',
        recipientName: 'Lovekesh Anand',
        phoneNumber: '918929750553',
        amount: 3200
      }
    });
    console.log('✅ Flow A Simulation:', simA.data);

    console.log('\n🎉 All Webhook Simulation Tests Passed!');
  } catch (err) {
    console.error('❌ Webhook test failed:', err.response?.data || err.message);
  }
}

testWebhooks();
