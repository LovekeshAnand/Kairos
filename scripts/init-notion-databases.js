import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID || '3c23cc964d1f80059d16f84a5264f066';

if (!NOTION_API_KEY) {
  console.error('Error: NOTION_API_KEY is missing from .env');
  process.exit(1);
}

async function notionRequest(endpoint, method = 'POST', body = null) {
  const headers = {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };
  const res = await fetch(`https://api.notion.com/v1/${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Notion API Error [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

async function initNotionDatabases() {
  console.log(`Connecting to Notion parent page ID: ${PARENT_PAGE_ID}...`);
  try {
    const page = await notionRequest(`pages/${PARENT_PAGE_ID}`, 'GET');
    console.log(`Connected to page: ${page.id}`);
  } catch (err) {
    console.error('Could not access page. Make sure the page is shared with your integration:', err.message);
    process.exit(1);
  }

  const results = {};

  // 1. Run Log Database
  console.log("Creating 'Run Log' Database...");
  const runLogDb = await notionRequest('databases', 'POST', {
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Run Log' } }],
    properties: {
      'Summary': { title: {} },
      'Timestamp': { date: {} },
      'Flow': {
        select: {
          options: [
            { name: 'invoice', color: 'blue' },
            { name: 'meeting_transcript', color: 'purple' },
            { name: 'reminders', color: 'orange' }
          ]
        }
      },
      'Trigger Type': {
        select: {
          options: [
            { name: 'webhook', color: 'green' },
            { name: 'cron', color: 'yellow' },
            { name: 'notion_poll', color: 'default' }
          ]
        }
      },
      'Status': {
        select: {
          options: [
            { name: 'success', color: 'green' },
            { name: 'failed', color: 'red' },
            { name: 'pending_approval', color: 'yellow' },
            { name: 'rejected', color: 'gray' },
            { name: 'ignored', color: 'brown' }
          ]
        }
      },
      'Related Item': { rich_text: {} },
      'Error': { rich_text: {} }
    }
  });
  results.NOTION_RUN_LOG_DB_ID = runLogDb.id;
  console.log('-> Run Log DB ID:', runLogDb.id);

  // 2. Invoices Database
  console.log("Creating 'Invoices' Database...");
  const invoicesDb = await notionRequest('databases', 'POST', {
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Invoices' } }],
    properties: {
      'Invoice Name': { title: {} },
      'File': { files: {} },
      'Recipient Name': { rich_text: {} },
      'Phone Number': { phone_number: {} },
      'Amount': { number: { format: 'number' } },
      'Due Date': { date: {} },
      'Status': {
        select: {
          options: [
            { name: 'New', color: 'blue' },
            { name: 'Awaiting Approval', color: 'yellow' },
            { name: 'Approved', color: 'green' },
            { name: 'Rejected', color: 'red' },
            { name: 'Sent', color: 'purple' },
            { name: 'Send Failed', color: 'orange' },
            { name: 'Needs Info', color: 'pink' }
          ]
        }
      }
    }
  });
  results.NOTION_INVOICES_DB_ID = invoicesDb.id;
  console.log('-> Invoices DB ID:', invoicesDb.id);

  // 3. Tasks Database
  console.log("Creating 'Tasks' Database...");
  const tasksDb = await notionRequest('databases', 'POST', {
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Tasks' } }],
    properties: {
      'Task': { title: {} },
      'Source Meeting': { rich_text: {} },
      'Owner': { rich_text: {} },
      'Due Date': { date: {} },
      'Status': {
        select: {
          options: [
            { name: 'Pending Review', color: 'yellow' },
            { name: 'Active', color: 'green' },
            { name: 'Done', color: 'blue' },
            { name: 'Rejected', color: 'gray' }
          ]
        }
      },
      'AI Reasoning': { rich_text: {} }
    }
  });
  results.NOTION_TASKS_DB_ID = tasksDb.id;
  console.log('-> Tasks DB ID:', tasksDb.id);

  // 4. Requests / Reminders Database
  console.log("Creating 'Requests / Reminders' Database...");
  const requestsDb = await notionRequest('databases', 'POST', {
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Requests / Reminders' } }],
    properties: {
      'Item': { title: {} },
      'Source': {
        select: {
          options: [
            { name: 'email', color: 'red' },
            { name: 'whatsapp', color: 'green' }
          ]
        }
      },
      'Sender': { rich_text: {} },
      'Category': {
        select: {
          options: [
            { name: 'Support', color: 'orange' },
            { name: 'Billing', color: 'blue' },
            { name: 'Meeting', color: 'purple' },
            { name: 'General', color: 'default' },
            { name: 'Urgent', color: 'red' }
          ]
        }
      },
      'Priority': {
        select: {
          options: [
            { name: 'Low', color: 'gray' },
            { name: 'Medium', color: 'yellow' },
            { name: 'High', color: 'red' }
          ]
        }
      },
      'Status': {
        select: {
          options: [
            { name: 'Awaiting Approval', color: 'yellow' },
            { name: 'Approved', color: 'green' },
            { name: 'Rejected', color: 'gray' },
            { name: 'Ignored', color: 'brown' },
            { name: 'Needs Manual Review', color: 'pink' }
          ]
        }
      },
      'Summary': { rich_text: {} }
    }
  });
  results.NOTION_REQUESTS_DB_ID = requestsDb.id;
  console.log('-> Requests / Reminders DB ID:', requestsDb.id);

  console.log('\nAll 4 Notion databases successfully created:');
  console.log(JSON.stringify(results, null, 2));
}

initNotionDatabases().catch(console.error);
