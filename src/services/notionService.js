const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

let actionHubDbId = process.env.NOTION_ACTION_HUB_DB_ID;
let runLogDbId = process.env.NOTION_RUN_LOG_DB_ID;

let isInitialized = false;

/**
 * Initializes and validates Notion databases, discovering them if IDs are not explicitly configured.
 */
async function initNotionDatabases() {
  if (isInitialized && (actionHubDbId || runLogDbId)) {
    return { success: true, actionHubDbId, runLogDbId };
  }

  if (!process.env.NOTION_TOKEN) {
    console.warn('⚠️ NOTION_TOKEN is not set. Notion operations will be skipped.');
    return { success: false, reason: 'NOTION_TOKEN missing' };
  }

  try {
    const response = await notion.search({
      filter: { value: 'database', property: 'object' }
    });

    for (const db of response.results) {
      const title = db.title?.[0]?.plain_text || '';
      if (title.toLowerCase().includes('action') || title.toLowerCase().includes('inbox') || title.toLowerCase().includes('kairos action')) {
        actionHubDbId = actionHubDbId || db.id;
        console.log(`📌 Found Action Hub Database: "${title}" (${db.id})`);
      } else if (title.toLowerCase().includes('run') || title.toLowerCase().includes('log') || title.toLowerCase().includes('audit')) {
        runLogDbId = runLogDbId || db.id;
        console.log(`📌 Found Run Log Database: "${title}" (${db.id})`);
      }
    }

    isInitialized = true;
    return {
      success: true,
      actionHubDbId,
      runLogDbId,
      databasesFound: response.results.length
    };
  } catch (error) {
    isInitialized = true;
    console.error('❌ Error initializing Notion databases:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Creates a new item in the Action Hub database
 */
async function createActionItem({
  title,
  source,
  sender,
  priority = 'Medium',
  category = 'General',
  status = 'Needs Approval',
  summary = '',
  draftResponse = '',
  rawMessage = '',
  sourceId = ''
}) {
  if (!actionHubDbId) {
    await initNotionDatabases();
  }

  if (!actionHubDbId) {
    console.warn('⚠️ No Action Hub Database configured or found. Skipping Notion record creation.');
    return null;
  }

  try {
    const page = await notion.pages.create({
      parent: { database_id: actionHubDbId },
      properties: {
        'Title': {
          title: [{ text: { content: title || 'Inbound Request' } }]
        },
        'Source': {
          select: { name: source || 'Gmail' }
        },
        'Sender': {
          rich_text: [{ text: { content: (sender || '').slice(0, 2000) } }]
        },
        'Priority': {
          select: { name: priority }
        },
        'Category': {
          select: { name: category }
        },
        'Status': {
          select: { name: status }
        },
        'AI Summary': {
          rich_text: [{ text: { content: (summary || '').slice(0, 2000) } }]
        },
        'Draft Response': {
          rich_text: [{ text: { content: (draftResponse || '').slice(0, 2000) } }]
        },
        'Source ID': {
          rich_text: [{ text: { content: (sourceId || '').slice(0, 2000) } }]
        }
      },
      children: [
        {
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ text: { content: '📩 Original Message Content' } }]
          }
        },
        {
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ text: { content: (rawMessage || 'No body content').slice(0, 2000) } }],
            language: 'plain text'
          }
        }
      ]
    });

    console.log(`✅ Action Item created in Notion: ${page.id}`);
    return page;
  } catch (error) {
    console.error('❌ Failed to create Action Item in Notion:', error.message);
    throw error;
  }
}

/**
 * Appends a row to the Run Log database (Audit Trail)
 */
async function logExecution({
  executionId,
  trigger = 'Webhook',
  status = 'Success',
  actionTaken = '',
  durationMs = 0,
  errorDetails = ''
}) {
  if (!runLogDbId) {
    await initNotionDatabases();
  }

  if (!runLogDbId) {
    console.warn('⚠️ No Run Log Database configured or found. Skipping Run Log entry.');
    return null;
  }

  try {
    const page = await notion.pages.create({
      parent: { database_id: runLogDbId },
      properties: {
        'Execution ID': {
          title: [{ text: { content: executionId || `RUN-${Date.now()}` } }]
        },
        'Trigger': {
          select: { name: trigger }
        },
        'Status': {
          select: { name: status }
        },
        'Action Taken': {
          rich_text: [{ text: { content: (actionTaken || '').slice(0, 2000) } }]
        },
        'Execution Time (ms)': {
          number: durationMs
        },
        'Timestamp': {
          date: { start: new Date().toISOString() }
        },
        'Error Details': {
          rich_text: [{ text: { content: (errorDetails || '').slice(0, 2000) } }]
        }
      }
    });

    console.log(`📗 Run Log written in Notion: ${page.id} (${status})`);
    return page;
  } catch (error) {
    console.error('❌ Failed to write Run Log in Notion:', error.message);
    return null;
  }
}

/**
 * Fetch items that have been approved by human in Notion
 */
async function fetchApprovedItems() {
  if (!actionHubDbId) {
    await initNotionDatabases();
  }
  if (!actionHubDbId) return [];

  try {
    const response = await notion.databases.query({
      database_id: actionHubDbId,
      filter: {
        property: 'Status',
        select: {
          equals: 'Approved'
        }
      }
    });

    return response.results.map(page => {
      const getProp = (name, type) => {
        const prop = page.properties[name];
        if (!prop) return '';
        if (type === 'title') return prop.title?.[0]?.plain_text || '';
        if (type === 'rich_text') return prop.rich_text?.[0]?.plain_text || '';
        if (type === 'select') return prop.select?.name || '';
        return '';
      };

      return {
        id: page.id,
        title: getProp('Title', 'title'),
        source: getProp('Source', 'select'),
        sender: getProp('Sender', 'rich_text'),
        priority: getProp('Priority', 'select'),
        category: getProp('Category', 'select'),
        status: getProp('Status', 'select'),
        draftResponse: getProp('Draft Response', 'rich_text'),
        sourceId: getProp('Source ID', 'rich_text')
      };
    });
  } catch (error) {
    console.error('❌ Error querying approved items in Notion:', error.message);
    return [];
  }
}

/**
 * Update Notion item status (e.g. Approved -> Completed)
 */
async function updateItemStatus(pageId, status) {
  try {
    return await notion.pages.update({
      page_id: pageId,
      properties: {
        'Status': {
          select: { name: status }
        }
      }
    });
  } catch (error) {
    console.error(`❌ Failed to update page ${pageId} status:`, error.message);
    throw error;
  }
}

module.exports = {
  notion,
  initNotionDatabases,
  createActionItem,
  logExecution,
  fetchApprovedItems,
  updateItemStatus
};
