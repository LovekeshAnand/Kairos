const { Client } = require('@notionhq/client');
require('dotenv').config();

const notionApiKey = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;

const notion = new Client({
  auth: notionApiKey
});

const RUN_LOG_DB_ID = process.env.NOTION_RUN_LOG_DB_ID;
const INVOICES_DB_ID = process.env.NOTION_INVOICES_DB_ID;
const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;
const REQUESTS_DB_ID = process.env.NOTION_REQUESTS_DB_ID;

/**
 * Validates Notion API connection and configured databases
 */
async function validateNotion() {
  if (!notionApiKey) {
    console.warn('⚠️ NOTION_API_KEY is not set in environment.');
    return { success: false, reason: 'NOTION_API_KEY missing' };
  }

  try {
    const user = await notion.users.me({});
    console.log(`✅ Connected to Notion as bot: "${user.name || user.id}"`);
    return {
      success: true,
      bot: user.name,
      databases: {
        runLog: RUN_LOG_DB_ID || 'missing',
        invoices: INVOICES_DB_ID || 'missing',
        tasks: TASKS_DB_ID || 'missing',
        requests: REQUESTS_DB_ID || 'missing'
      }
    };
  } catch (err) {
    console.error('❌ Notion connection validation failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Appends an authentic audit record to the Notion Run Log database
 * Guaranteed to be called on EVERY run (success, pending, rejected, failed, ignored)
 */
async function writeRunLog({
  flow = 'reminders',           // 'invoice' | 'meeting_transcript' | 'reminders'
  triggerType = 'webhook',     // 'webhook' | 'cron' | 'notion_poll'
  status = 'success',          // 'success' | 'failed' | 'pending_approval' | 'rejected' | 'ignored'
  summary,                     // one-line human readable summary
  relatedItemId = '',          // ID or reference of affected item
  error = null
}) {
  if (!RUN_LOG_DB_ID) {
    console.warn('⚠️ NOTION_RUN_LOG_DB_ID is not configured. Log output:', summary);
    return null;
  }

  try {
    const page = await notion.pages.create({
      parent: { database_id: RUN_LOG_DB_ID },
      properties: {
        'Summary': {
          title: [{ text: { content: (summary || 'Execution run').slice(0, 2000) } }]
        },
        'Timestamp': {
          date: { start: new Date().toISOString() }
        },
        'Flow': {
          select: { name: flow }
        },
        'Trigger Type': {
          select: { name: triggerType }
        },
        'Status': {
          select: { name: status }
        },
        'Related Item': {
          rich_text: [{ text: { content: (relatedItemId || '').slice(0, 2000) } }]
        },
        'Error': {
          rich_text: [{ text: { content: (error ? String(error) : '').slice(0, 2000) } }]
        }
      }
    });

    console.log(`📗 [Run Log] Written to Notion: "${summary}" (${status})`);
    return page;
  } catch (err) {
    console.error('❌ Failed to write Notion Run Log row:', err.message);
    return null;
  }
}

/* ========================================================================= */
/* Flow A — Invoices Database Operations                                     */
/* ========================================================================= */

/**
 * Creates or stages an invoice item in Notion Invoices DB
 */
async function createInvoiceItem({
  invoiceName,
  recipientName,
  phoneNumber,
  amount = 0,
  dueDate = null,
  fileUrl = null,
  status = 'New'
}) {
  if (!INVOICES_DB_ID) {
    throw new Error('NOTION_INVOICES_DB_ID is not configured');
  }

  const properties = {
    'Invoice Name': {
      title: [{ text: { content: (invoiceName || 'New Invoice').slice(0, 2000) } }]
    },
    'Recipient Name': {
      rich_text: [{ text: { content: (recipientName || '').slice(0, 2000) } }]
    },
    'Phone Number': {
      phone_number: phoneNumber || null
    },
    'Amount': {
      number: Number(amount) || 0
    },
    'Status': {
      select: { name: status }
    }
  };

  if (dueDate) {
    properties['Due Date'] = { date: { start: dueDate } };
  }

  if (fileUrl) {
    properties['File'] = {
      files: [
        {
          name: `${invoiceName || 'invoice'}.pdf`,
          external: { url: fileUrl }
        }
      ]
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: INVOICES_DB_ID },
    properties
  });

  return page;
}

/**
 * Queries invoices by status (e.g. 'New', 'Approved', 'Awaiting Approval')
 */
async function fetchInvoicesByStatus(status) {
  if (!INVOICES_DB_ID) return [];

  try {
    const response = await notion.databases.query({
      database_id: INVOICES_DB_ID,
      filter: {
        property: 'Status',
        select: { equals: status }
      }
    });

    return response.results.map(page => {
      const p = page.properties;
      const getTitle = prop => prop?.title?.[0]?.plain_text || '';
      const getRichText = prop => prop?.rich_text?.[0]?.plain_text || '';
      const getPhone = prop => prop?.phone_number || '';
      const getNumber = prop => prop?.number || 0;
      const getDate = prop => prop?.date?.start || '';
      const getSelect = prop => prop?.select?.name || '';
      const getFile = prop => {
        if (!prop?.files || prop.files.length === 0) return null;
        return prop.files[0]?.file?.url || prop.files[0]?.external?.url || null;
      };

      return {
        id: page.id,
        invoiceName: getTitle(p['Invoice Name']),
        recipientName: getRichText(p['Recipient Name']),
        phoneNumber: getPhone(p['Phone Number']),
        amount: getNumber(p['Amount']),
        dueDate: getDate(p['Due Date']),
        status: getSelect(p['Status']),
        fileUrl: getFile(p['File'])
      };
    });
  } catch (err) {
    console.error(`❌ Error fetching invoices with status [${status}]:`, err.message);
    return [];
  }
}

/**
 * Updates an invoice row's status
 */
async function updateInvoiceStatus(pageId, status) {
  return await notion.pages.update({
    page_id: pageId,
    properties: {
      'Status': { select: { name: status } }
    }
  });
}

/* ========================================================================= */
/* Flow B — Tasks Database Operations                                        */
/* ========================================================================= */

/**
 * Creates structured task item extracted from a meeting transcript
 */
async function createTaskItem({
  task,
  sourceMeeting = '',
  owner = '',
  dueDate = null,
  reasoning = '',
  status = 'Pending Review'
}) {
  if (!TASKS_DB_ID) {
    throw new Error('NOTION_TASKS_DB_ID is not configured');
  }

  const properties = {
    'Task': {
      title: [{ text: { content: (task || 'Extracted Task').slice(0, 2000) } }]
    },
    'Source Meeting': {
      rich_text: [{ text: { content: (sourceMeeting || '').slice(0, 2000) } }]
    },
    'Owner': {
      rich_text: [{ text: { content: (owner || 'Unassigned').slice(0, 2000) } }]
    },
    'AI Reasoning': {
      rich_text: [{ text: { content: (reasoning || '').slice(0, 2000) } }]
    },
    'Status': {
      select: { name: status }
    }
  };

  if (dueDate) {
    properties['Due Date'] = { date: { start: dueDate } };
  }

  return await notion.pages.create({
    parent: { database_id: TASKS_DB_ID },
    properties
  });
}

/**
 * Queries tasks by status (e.g. 'Active', 'Pending Review')
 */
async function fetchTasksByStatus(status) {
  if (!TASKS_DB_ID) return [];

  try {
    const response = await notion.databases.query({
      database_id: TASKS_DB_ID,
      filter: {
        property: 'Status',
        select: { equals: status }
      }
    });

    return response.results.map(page => {
      const p = page.properties;
      return {
        id: page.id,
        task: p['Task']?.title?.[0]?.plain_text || '',
        sourceMeeting: p['Source Meeting']?.rich_text?.[0]?.plain_text || '',
        owner: p['Owner']?.rich_text?.[0]?.plain_text || '',
        dueDate: p['Due Date']?.date?.start || '',
        reasoning: p['AI Reasoning']?.rich_text?.[0]?.plain_text || '',
        status: p['Status']?.select?.name || ''
      };
    });
  } catch (err) {
    console.error(`❌ Error fetching tasks with status [${status}]:`, err.message);
    return [];
  }
}

/**
 * Updates a task status
 */
async function updateTaskStatus(pageId, status) {
  return await notion.pages.update({
    page_id: pageId,
    properties: {
      'Status': { select: { name: status } }
    }
  });
}

/* ========================================================================= */
/* Flow C — Requests / Reminders Database Operations                         */
/* ========================================================================= */

/**
 * Creates a structured request or reminder entry in Notion
 */
async function createRequestItem({
  item,
  source = 'email',
  sender = '',
  category = 'General',
  priority = 'Medium',
  status = 'Awaiting Approval',
  summary = '',
  draftResponse = '',
  rawContent = ''
}) {
  if (!REQUESTS_DB_ID) {
    throw new Error('NOTION_REQUESTS_DB_ID is not configured');
  }

  const page = await notion.pages.create({
    parent: { database_id: REQUESTS_DB_ID },
    properties: {
      'Item': {
        title: [{ text: { content: (item || 'Inbound Item').slice(0, 2000) } }]
      },
      'Source': {
        select: { name: source }
      },
      'Sender': {
        rich_text: [{ text: { content: (sender || '').slice(0, 2000) } }]
      },
      'Category': {
        select: { name: category || 'General' }
      },
      'Priority': {
        select: { name: priority || 'Medium' }
      },
      'Status': {
        select: { name: status || 'Awaiting Approval' }
      },
      'Summary': {
        rich_text: [{ text: { content: (summary || '').slice(0, 2000) } }]
      }
    },
    children: [
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: '💬 AI Generated Draft Response' } }]
        }
      },
      {
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: [{ text: { content: (draftResponse || 'No draft generated').slice(0, 2000) } }]
        }
      },
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: '📩 Original Message' } }]
        }
      },
      {
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{ text: { content: (rawContent || 'Empty').slice(0, 2000) } }],
          language: 'plain text'
        }
      }
    ]
  });

  return page;
}

/**
 * Queries requests by status (e.g. 'Approved', 'Awaiting Approval')
 */
async function fetchRequestsByStatus(status) {
  if (!REQUESTS_DB_ID) return [];

  try {
    const response = await notion.databases.query({
      database_id: REQUESTS_DB_ID,
      filter: {
        property: 'Status',
        select: { equals: status }
      }
    });

    return response.results.map(page => {
      const p = page.properties;
      return {
        id: page.id,
        item: p['Item']?.title?.[0]?.plain_text || '',
        source: p['Source']?.select?.name || 'email',
        sender: p['Sender']?.rich_text?.[0]?.plain_text || '',
        category: p['Category']?.select?.name || 'General',
        priority: p['Priority']?.select?.name || 'Medium',
        status: p['Status']?.select?.name || '',
        summary: p['Summary']?.rich_text?.[0]?.plain_text || ''
      };
    });
  } catch (err) {
    console.error(`❌ Error fetching requests with status [${status}]:`, err.message);
    return [];
  }
}

/**
 * Updates a request status
 */
async function updateRequestStatus(pageId, status) {
  return await notion.pages.update({
    page_id: pageId,
    properties: {
      'Status': { select: { name: status } }
    }
  });
}

/**
 * Reads page body blocks (e.g. to extract the draft response block)
 */
async function getPageDraftResponse(pageId) {
  try {
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    const quoteBlock = blocks.results.find(b => b.type === 'quote');
    return quoteBlock?.quote?.rich_text?.[0]?.plain_text || '';
  } catch (err) {
    return '';
  }
}

module.exports = {
  notion,
  validateNotion,
  writeRunLog,
  // Flow A
  createInvoiceItem,
  fetchInvoicesByStatus,
  updateInvoiceStatus,
  // Flow B
  createTaskItem,
  fetchTasksByStatus,
  updateTaskStatus,
  // Flow C
  createRequestItem,
  fetchRequestsByStatus,
  updateRequestStatus,
  getPageDraftResponse
};
