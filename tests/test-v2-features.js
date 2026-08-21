require('dotenv').config();
const notionService = require('../src/services/notionService');
const aiService = require('../src/services/aiService');
const pipelineService = require('../src/services/pipelineService');

async function runV2FeatureTests() {
  console.log('===============================================================');
  console.log('🧪 KAIROS V2 FEATURE VALIDATION SUITE');
  console.log('===============================================================');

  // TEST 1: Notion Connection & 5-Database Verification
  console.log('\n[1/4] Validating Notion Connection & 5 Databases...');
  const notionCheck = await notionService.validateNotion();
  if (!notionCheck.success) {
    throw new Error(`Notion connection failed: ${notionCheck.error}`);
  }
  console.log('-> Connected databases:', notionCheck.databases);

  // TEST 2: Spam & Group Noise Filter Verification
  console.log('\n[2/4] Testing Intelligent Spam & Group Chatter Filter...');
  
  // 2a. Casual Group Chatter (Noise)
  const groupNoiseResult = await pipelineService.processInboundCommunication({
    source: 'whatsapp',
    sender: '120363409582504727@g.us',
    senderName: 'Gaming Group',
    body: 'areee counter strike ek game hai bhai khelo sab',
    isGroup: true,
    sourceId: `test_group_noise_${Date.now()}`
  });
  console.log('-> Group Chatter Result:', groupNoiseResult);
  if (!groupNoiseResult.ignored) {
    throw new Error('Group chatter was not flagged as noise!');
  }
  console.log('✅ Group chatter correctly ignored and filtered!');

  // 2b. Actionable Direct Meeting Request (Not Noise)
  const directActionResult = await pipelineService.processInboundCommunication({
    source: 'whatsapp',
    sender: '918929750553@c.us',
    senderName: 'Lovekesh Anand',
    body: 'Bhai sunday ko 4 baje meeting rakh le',
    isGroup: false,
    sourceId: `test_direct_action_${Date.now()}`
  });
  console.log('-> Direct Action Result:', directActionResult);
  if (!directActionResult.notionPageId) {
    throw new Error('Direct meeting request was not staged in Notion!');
  }
  console.log('✅ Actionable request parsed and staged in Notion:', directActionResult.notionPageId);

  // TEST 3: Central Documents DB Asset Capture
  console.log('\n[3/4] Testing Central Documents DB Asset Capture...');
  const docPage = await notionService.createDocumentItem({
    name: 'Invoice_ACME_Feb2026.pdf',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    source: 'whatsapp',
    sender: '918929750553',
    senderName: 'Lovekesh Anand',
    category: 'Invoice',
    fileType: 'PDF',
    summary: 'Captured vendor invoice for February 2026.'
  });
  console.log('✅ Document staged in Notion Documents DB:', docPage.id);

  // TEST 4: Human Response Override Priority
  console.log('\n[4/4] Testing Human Response Override Priority...');
  const reqWithOverride = await notionService.createRequestItem({
    item: 'Website redesign proposal review',
    source: 'email',
    sender: 'client@example.com',
    category: 'General',
    priority: 'High',
    status: 'Awaiting Approval',
    summary: 'Client submitted draft website redesign scope.',
    draftResponse: 'AI generated generic response: Thank you, we will review.',
    humanResponse: 'Custom Human Response: Proposal looks great! Approved to proceed with Phase 1.'
  });

  const resolvedReply = await notionService.getPageDraftResponse(reqWithOverride.id);
  console.log('-> Resolved reply text:', resolvedReply);
  if (!resolvedReply.includes('Custom Human Response')) {
    throw new Error('Human Response did not take priority over AI draft!');
  }
  console.log('✅ Human Response override successfully prioritized over AI draft!');

  console.log('\n===============================================================');
  console.log('🎉 ALL V2 FEATURES VALIDATED AND WORKING PERFECTLY!');
  console.log('===============================================================');
}

runV2FeatureTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});
