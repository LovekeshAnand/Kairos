const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

async function setupDatabases(parentPageId = process.env.NOTION_PARENT_PAGE_ID) {
  if (!process.env.NOTION_TOKEN) {
    console.error('❌ NOTION_TOKEN is required in .env');
    return;
  }

  if (!parentPageId) {
    console.log('🔍 Searching for accessible pages in Notion workspace...');
    const searchRes = await notion.search({
      filter: { value: 'page', property: 'object' }
    });

    if (searchRes.results.length === 0) {
      console.log('\n⚠️ No pages found. Please invite/connect the "Kairos" integration to a Notion page:');
      console.log('   1. Open your Notion page where you want Kairos to live.');
      console.log('   2. Click the top-right "..." menu -> Connections -> Add Connection -> "Kairos".');
      console.log('   3. Run this setup script again or set NOTION_PARENT_PAGE_ID in .env\n');
      return;
    }

    parentPageId = searchRes.results[0].id;
    console.log(`📌 Using parent page: ${parentPageId}`);
  }

  console.log(`\n🚀 Setting up Kairos databases under parent page (${parentPageId})...`);

  try {
    // 1. Create Action Hub Database
    console.log('Creating "Kairos Action Hub" database...');
    const actionHubDb = await notion.databases.create({
      parent: { page_id: parentPageId },
      title: [{ type: 'text', text: { content: '⚡ Kairos Action Hub' } }],
      properties: {
        'Title': { title: {} },
        'Source': {
          select: {
            options: [
              { name: 'Gmail', color: 'red' },
              { name: 'WhatsApp', color: 'green' },
              { name: 'API', color: 'blue' }
            ]
          }
        },
        'Sender': { rich_text: {} },
        'Priority': {
          select: {
            options: [
              { name: 'Critical', color: 'red' },
              { name: 'High', color: 'orange' },
              { name: 'Medium', color: 'yellow' },
              { name: 'Low', color: 'gray' }
            ]
          }
        },
        'Category': {
          select: {
            options: [
              { name: 'Urgent', color: 'red' },
              { name: 'Inquiry', color: 'blue' },
              { name: 'Billing', color: 'green' },
              { name: 'Support', color: 'purple' },
              { name: 'Attendance', color: 'pink' },
              { name: 'Follow-up', color: 'brown' },
              { name: 'General', color: 'default' }
            ]
          }
        },
        'Status': {
          select: {
            options: [
              { name: 'Needs Approval', color: 'yellow' },
              { name: 'Approved', color: 'green' },
              { name: 'In Progress', color: 'blue' },
              { name: 'Completed', color: 'gray' },
              { name: 'Rejected', color: 'red' }
            ]
          }
        },
        'AI Summary': { rich_text: {} },
        'Draft Response': { rich_text: {} },
        'Source ID': { rich_text: {} }
      }
    });

    console.log(`✅ "Kairos Action Hub" created! ID: ${actionHubDb.id}`);

    // 2. Create Run Log Database
    console.log('Creating "Kairos Run Log" database...');
    const runLogDb = await notion.databases.create({
      parent: { page_id: parentPageId },
      title: [{ type: 'text', text: { content: '📗 Kairos Run Log' } }],
      properties: {
        'Execution ID': { title: {} },
        'Trigger': {
          select: {
            options: [
              { name: 'Gmail Webhook', color: 'red' },
              { name: 'WhatsApp Webhook', color: 'green' },
              { name: 'Human Approval', color: 'purple' },
              { name: 'Simulator', color: 'blue' },
              { name: 'Cron Sync', color: 'orange' }
            ]
          }
        },
        'Status': {
          select: {
            options: [
              { name: 'Success', color: 'green' },
              { name: 'Pending Approval', color: 'yellow' },
              { name: 'Failed', color: 'red' }
            ]
          }
        },
        'Action Taken': { rich_text: {} },
        'Execution Time (ms)': { number: {} },
        'Timestamp': { date: {} },
        'Error Details': { rich_text: {} }
      }
    });

    console.log(`✅ "Kairos Run Log" created! ID: ${runLogDb.id}`);

    // Update .env file automatically
    const envPath = path.resolve(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    envContent = envContent.replace(/NOTION_ACTION_HUB_DB_ID=.*/, `NOTION_ACTION_HUB_DB_ID=${actionHubDb.id}`);
    envContent = envContent.replace(/NOTION_RUN_LOG_DB_ID=.*/, `NOTION_RUN_LOG_DB_ID=${runLogDb.id}`);
    envContent = envContent.replace(/NOTION_PARENT_PAGE_ID=.*/, `NOTION_PARENT_PAGE_ID=${parentPageId}`);

    fs.writeFileSync(envPath, envContent);
    console.log('\n🎉 .env updated with newly generated database IDs!');

  } catch (error) {
    console.error('❌ Error creating Notion databases:', error.message);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  setupDatabases(args[0]);
}

module.exports = { setupDatabases };
