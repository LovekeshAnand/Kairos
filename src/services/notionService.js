const { Client } = require('@notionhq/client');
require('dotenv').config();

const notionApiKey = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;

const notion = new Client({
  auth: notionApiKey
});

const getRunLogDbId = () => process.env.NOTION_RUN_LOG_DB_ID || '';
const getInvoicesDbId = () => process.env.NOTION_INVOICES_DB_ID || '';
const getTasksDbId = () => process.env.NOTION_TASKS_DB_ID || '';
const getRequestsDbId = () => process.env.NOTION_REQUESTS_DB_ID || '';
const getDocumentsDbId = () => process.env.NOTION_DOCUMENTS_DB_ID || '';

let cachedBotName = null;
let lastNotionCheck = 0;

/**
 * Validates Notion API connection and configured databases
 */
async function validateNotion(force = false) {
  if (!notionApiKey) {
    return { success: false, reason: 'NOTION_API_KEY missing' };
  }

  // Cache for 60 seconds
  const now = Date.now();
  if (!force && cachedBotName && (now - lastNotionCheck < 60000)) {
    return {
      success: true,
      bot: cachedBotName,
      databases: {
        runLog: getRunLogDbId() || 'missing',
        invoices: getInvoicesDbId() || 'missing',
        tasks: getTasksDbId() || 'missing',
        requests: getRequestsDbId() || 'missing',
        documents: getDocumentsDbId() || 'missing'
      }
    };
  }

  try {
    const user = await notion.users.me({});
    cachedBotName = user.name || user.id;
    lastNotionCheck = now;
    return {
      success: true,
      bot: cachedBotName,
      databases: {
        runLog: getRunLogDbId() || 'missing',
        invoices: getInvoicesDbId() || 'missing',
        tasks: getTasksDbId() || 'missing',
        requests: getRequestsDbId() || 'missing',
        documents: getDocumentsDbId() || 'missing'
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Appends an authentic audit record to the Notion Run Log database
 * Guaranteed to be called on EVERY run (success, pending, rejected, failed, ignored)
 */
async function writeRunLog({
  flow = 'reminders',           // 'invoice' | 'meeting_transcript' | 'reminders' | 'documents'
  triggerType = 'webhook',     // 'webhook' | 'cron' | 'notion_poll'
  status = 'success',          // 'success' | 'failed' | 'pending_approval' | 'rejected' | 'ignored'
  summary,                     // one-line human readable summary
  relatedItemId = '',          // ID or reference of affected item
  error = null
}) {
  const runLogDbId = getRunLogDbId();
  if (!runLogDbId) {
    console.log(`ℹ️ [Run Log] ${summary} (${status})`);
    return null;
  }

  try {
    const page = await notion.pages.create({
      parent: { database_id: runLogDbId },
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
    console.warn('⚠️ Failed to write Notion Run Log row:', err.message);
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
  phoneNumber = '',
  amount = 0,
  dueDate = null,
  fileUrl = null,
  status = 'New'
}) {
  const invoicesDbId = getInvoicesDbId();
  if (!invoicesDbId) {
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
    parent: { database_id: invoicesDbId },
    properties
  });

  return page;
}

/**
 * Queries invoices by status (e.g. 'New', 'Approved', 'Awaiting Approval')
 */
async function fetchInvoicesByStatus(status) {
  const invoicesDbId = getInvoicesDbId();
  if (!invoicesDbId) return [];

  try {
    const response = await notion.databases.query({
      database_id: invoicesDbId,
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
  humanResponse = '',
  rawContent = ''
}) {
  const requestsDbId = getRequestsDbId();
  if (!requestsDbId) {
    throw new Error('NOTION_REQUESTS_DB_ID is not configured');
  }

  const properties = {
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
  };

  if (humanResponse) {
    properties['Human Response'] = {
      rich_text: [{ text: { content: (humanResponse || '').slice(0, 2000) } }]
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: requestsDbId },
    properties,
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
        type: 'callout',
        callout: {
          icon: { type: 'emoji', emoji: '💡' },
          rich_text: [{ text: { content: 'Tip: You can override the AI draft by typing your custom message into the "Human Response" property above before approving.' } }]
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
  const requestsDbId = getRequestsDbId();
  if (!requestsDbId) return [];

  try {
    const response = await notion.databases.query({
      database_id: requestsDbId,
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
        summary: p['Summary']?.rich_text?.[0]?.plain_text || '',
        humanResponse: p['Human Response']?.rich_text?.[0]?.plain_text || ''
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
 * Reads page response prioritizing the custom Human Response property, falling back to AI Quote block
 */
async function getPageDraftResponse(pageId) {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const humanResp = page.properties?.['Human Response']?.rich_text?.[0]?.plain_text;
    if (humanResp && humanResp.trim().length > 0) {
      console.log(`🙋 [Human Override] Using custom human reply from Notion property: "${humanResp.slice(0, 50)}..."`);
      return humanResp.trim();
    }

    const blocks = await notion.blocks.children.list({ block_id: pageId });
    const quoteBlock = blocks.results.find(b => b.type === 'quote');
    return quoteBlock?.quote?.rich_text?.[0]?.plain_text || '';
  } catch (err) {
    return '';
  }
}

/* ========================================================================= */
/* Database 5 — Documents & Attachment Asset Repository                       */
/* ========================================================================= */

/**
 * Stores a captured document/attachment in the central Documents DB
 */
async function createDocumentItem({
  name,
  fileUrl = null,
  source = 'whatsapp',
  sender = '',
  senderName = '',
  category = 'General',
  fileType = 'PDF',
  summary = '',
  receivedDate = new Date().toISOString()
}) {
  if (!DOCUMENTS_DB_ID) {
    console.warn('⚠️ NOTION_DOCUMENTS_DB_ID is not configured. Document staging skipped.');
    return null;
  }

  const properties = {
    'Document Name': {
      title: [{ text: { content: (name || 'New Document').slice(0, 2000) } }]
    },
    'Source': {
      select: { name: source }
    },
    'Sender': {
      rich_text: [{ text: { content: (sender || '').slice(0, 2000) } }]
    },
    'Sender Name': {
      rich_text: [{ text: { content: (senderName || '').slice(0, 2000) } }]
    },
    'Category': {
      select: { name: category || 'General' }
    },
    'File Type': {
      select: { name: fileType || 'Other' }
    },
    'AI Summary': {
      rich_text: [{ text: { content: (summary || '').slice(0, 2000) } }]
    },
    'Received Date': {
      date: { start: receivedDate }
    }
  };

  if (fileUrl) {
    properties['File'] = {
      files: [
        {
          name: `${name || 'document'}`,
          external: { url: fileUrl }
        }
      ]
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: DOCUMENTS_DB_ID },
    properties
  });

  console.log(`📂 [Documents DB] Staged document: "${name}" (${category}) [${page.id}]`);
  return page;
}

/**
 * Queries stored documents
 */
async function fetchDocuments({ category, source } = {}) {
  if (!DOCUMENTS_DB_ID) return [];

  try {
    const filter = [];
    if (category) filter.push({ property: 'Category', select: { equals: category } });
    if (source) filter.push({ property: 'Source', select: { equals: source } });

    const queryParams = { database_id: DOCUMENTS_DB_ID };
    if (filter.length === 1) {
      queryParams.filter = filter[0];
    } else if (filter.length > 1) {
      queryParams.filter = { and: filter };
    }

    const response = await notion.databases.query(queryParams);
    return response.results.map(page => {
      const p = page.properties;
      return {
        id: page.id,
        name: p['Document Name']?.title?.[0]?.plain_text || '',
        source: p['Source']?.select?.name || '',
        sender: p['Sender']?.rich_text?.[0]?.plain_text || '',
        senderName: p['Sender Name']?.rich_text?.[0]?.plain_text || '',
        category: p['Category']?.select?.name || '',
        fileType: p['File Type']?.select?.name || '',
        summary: p['AI Summary']?.rich_text?.[0]?.plain_text || '',
        receivedDate: p['Received Date']?.date?.start || '',
        fileUrl: p['File']?.files?.[0]?.file?.url || p['File']?.files?.[0]?.external?.url || null
      };
    });
  } catch (err) {
    console.error('❌ Error fetching documents from Notion:', err.message);
    return [];
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
  getPageDraftResponse,
  // Database 5 - Documents
  createDocumentItem,
  fetchDocuments
};

