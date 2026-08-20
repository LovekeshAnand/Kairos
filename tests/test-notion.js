require('dotenv').config();
const notionService = require('../src/services/notionService');

async function testNotion() {
  console.log('Testing Notion Database Connectivity...\n');
  const status = await notionService.validateNotion();
  console.log('Notion Connection Status:', status);

  if (status.success) {
    console.log('Writing test Run Log entry...');
    const log = await notionService.writeRunLog({
      flow: 'reminders',
      triggerType: 'notion_poll',
      status: 'success',
      summary: 'Manual Notion connectivity test'
    });
    console.log('✅ Run Log entry written:', log?.id);
  }
}

testNotion();
