require('dotenv').config();
const notionService = require('../src/services/notionService');
const pipelineService = require('../src/services/pipelineService');

async function testFlowA() {
  console.log('================================================================');
  console.log('📄 TESTING FLOW A (INVOICE CREATION -> STAGING -> APPROVAL -> WHATSAPP)');
  console.log('================================================================\n');

  // Step 1: Create a sample invoice with status 'New'
  console.log('--- Step 1: Staging a new Invoice in Notion Invoices DB ---');
  const invoicePage = await notionService.createInvoiceItem({
    invoiceName: 'Invoice #INV-2026-001 (Hackathon Sponsorship)',
    recipientName: 'Lovekesh Anand',
    phoneNumber: '918929750553',
    amount: 1500,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    status: 'New'
  });
  console.log(`✅ Staged new invoice in Notion: ${invoicePage.id}`);

  // Step 2: Run scan to transition to Awaiting Approval & Log
  console.log('\n--- Step 2: Running Pipeline Scan (New -> Awaiting Approval) ---');
  await pipelineService.scanAndStageNewInvoices();

  // Step 3: Simulate Human Approval in Notion
  console.log('\n--- Step 3: Simulating Human Approval in Notion (Awaiting Approval -> Approved) ---');
  await notionService.updateInvoiceStatus(invoicePage.id, 'Approved');
  console.log('✅ Invoice status switched to "Approved" in Notion');

  // Step 4: Run approval poller to trigger real outbound action
  console.log('\n--- Step 4: Running Approval Dispatcher (Approved -> WhatsApp Dispatch -> Sent) ---');
  await pipelineService.processApprovedInvoices();

  console.log('\n================================================================');
  console.log('🎉 Flow A Test Complete! Check your WhatsApp and Notion Run Log!');
  console.log('================================================================\n');
}

testFlowA().catch(err => {
  console.error('❌ Flow A failed:', err);
  process.exit(1);
});
