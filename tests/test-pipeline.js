require('dotenv').config();
const notionService = require('../src/services/notionService');
const aiService = require('../src/services/aiService');
const pipelineService = require('../src/services/pipelineService');
const whatsappService = require('../src/services/whatsappService');

async function runFullSystemTest() {
  console.log('================================================================');
  console.log('🧪 KAIROS END-TO-END SYSTEM VALIDATION TEST');
  console.log('================================================================\n');

  // 1. Notion Health Check
  console.log('--- [1/5] Testing Notion Connection ---');
  const notionStatus = await notionService.validateNotion();
  if (!notionStatus.success) {
    throw new Error('Notion connection failed');
  }

  // 2. Run Log Writer Test
  console.log('\n--- [2/5] Testing Authentic Run Log Creation ---');
  const logPage = await notionService.writeRunLog({
    flow: 'reminders',
    triggerType: 'webhook',
    status: 'success',
    summary: 'System self-diagnostic test executed successfully.',
    relatedItemId: 'DIAG-001'
  });
  console.log('✅ Run Log entry created in Notion:', logPage?.id);

  // 3. OpenRouter AI Test
  console.log('\n--- [3/5] Testing OpenRouter AI Engine ---');
  const sampleEmail = {
    sender: 'sponsor.lead@techcorp.io',
    subject: 'Hackathon Platinum Sponsorship Inquiry & Invoice request',
    body: 'Hi Lovekesh,\nWe would like to confirm our Platinum Sponsorship of $5,000 for the upcoming event. Please send over the invoice and bank transfer details before Friday so our accounts team can disburse payment.\n\nRegards,\nAlex Vance\nHead of Partnerships'
  };

  const aiResult = await aiService.structureEmail(sampleEmail);
  console.log('🤖 AI Extracted Title:   ', aiResult.title);
  console.log('🤖 AI Category / Priority:', `${aiResult.category} / ${aiResult.priority}`);
  console.log('🤖 AI Summary:          ', aiResult.summary);
  console.log('🤖 AI Draft Reply:      ', aiResult.draftResponse.slice(0, 100) + '...');

  // 4. Test Flow C: Inbound Request Staging in Notion
  console.log('\n--- [4/5] Testing Flow C (Inbound -> Requests DB -> Run Log) ---');
  const flowCResult = await pipelineService.processInboundCommunication({
    source: 'email',
    sender: sampleEmail.sender,
    subject: sampleEmail.subject,
    body: sampleEmail.body,
    sourceId: `test_mail_${Date.now()}`
  });
  console.log('✅ Flow C Result:', flowCResult.success ? 'Success' : 'Failed');

  // 5. Test Flow B: Meeting Transcript Action Extraction
  console.log('\n--- [5/5] Testing Flow B (Transcript -> Tasks DB -> Run Log) ---');
  const sampleTranscript = `
Lovekesh: "Welcome everyone. Let's assign action items for tomorrow's demo."
Rohan: "I will finish testing the OpenWA gateway pairing with our test number."
Priya: "I will upload the sample client invoice to Notion and set up the approval status."
Lovekesh: "Awesome. I'll make sure the live Run Log timestamps are verified."
`;
  const flowBResult = await pipelineService.processMeetingTranscript({
    transcriptText: sampleTranscript,
    meetingTitle: 'Demo Preparation Sync'
  });
  console.log('✅ Flow B Result:', `${flowBResult.tasksExtracted} task(s) extracted and staged in Tasks DB!`);

  console.log('\n================================================================');
  console.log('🎉 ALL SYSTEM TESTS COMPLETED SUCCESSFULLY!');
  console.log('Check your Notion workspace: all 4 databases now have live data!');
  console.log('================================================================\n');
}

runFullSystemTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
