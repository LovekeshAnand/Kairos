const notionService = require('./notionService');
const aiService = require('./aiService');
const gmailService = require('./gmailService');
const whatsappService = require('./whatsappService');
const storageService = require('./storageService');

/* ========================================================================= */
/* Flow A — Invoices (File Upload -> Approval -> WhatsApp Outbound)          */
/* ========================================================================= */

/**
 * Scans for newly created invoices in Notion and stages them for approval
 */
async function scanAndStageNewInvoices() {
  try {
    const newInvoices = await notionService.fetchInvoicesByStatus('New');
    if (!newInvoices || newInvoices.length === 0) return;

    for (const inv of newInvoices) {
      const startTime = Date.now();
      console.log(`\n📄 [Flow A - Invoice] Detected new invoice: "${inv.invoiceName}" for ${inv.recipientName || 'Unknown'}`);

      // Edge case validation: Missing phone number
      if (!inv.phoneNumber) {
        console.warn(`⚠️ [Flow A] Invoice "${inv.invoiceName}" missing phone number. Flagging as Needs Info.`);
        await notionService.updateInvoiceStatus(inv.id, 'Needs Info');
        await notionService.writeRunLog({
          flow: 'invoice',
          triggerType: 'notion_poll',
          status: 'failed',
          summary: `Invoice "${inv.invoiceName}" flagged as Needs Info (missing phone number).`,
          relatedItemId: inv.id,
          error: 'Recipient phone number is required to send invoice via WhatsApp.'
        });
        continue;
      }

      // Transition to Awaiting Approval
      await notionService.updateInvoiceStatus(inv.id, 'Awaiting Approval');
      await notionService.writeRunLog({
        flow: 'invoice',
        triggerType: 'notion_poll',
        status: 'pending_approval',
        summary: `Invoice "${inv.invoiceName}" for ${inv.recipientName} ($${inv.amount}) staged for human approval.`,
        relatedItemId: inv.id
      });
    }
  } catch (err) {
    console.error('❌ [Flow A] Error scanning new invoices:', err.message);
  }
}

/**
 * Dispatches approved invoices to recipients via OpenWA WhatsApp
 */
async function processApprovedInvoices() {
  try {
    const approvedInvoices = await notionService.fetchInvoicesByStatus('Approved');
    if (!approvedInvoices || approvedInvoices.length === 0) return;

    for (const inv of approvedInvoices) {
      const startTime = Date.now();
      const idempotencyKey = `inv_approved_${inv.id}`;

      if (storageService.isProcessed(idempotencyKey)) {
        continue;
      }

      console.log(`\n🚀 [Flow A - Invoice] Dispatching approved invoice: "${inv.invoiceName}" to ${inv.phoneNumber}...`);
      storageService.markProcessed(idempotencyKey, { invoiceName: inv.invoiceName });

      try {
        const caption = `Hello ${inv.recipientName || 'Client'},\n\nPlease find attached your invoice "${inv.invoiceName}" for $${inv.amount}${inv.dueDate ? ` (Due: ${inv.dueDate})` : ''}.\n\nThank you for your business!`;

        if (inv.fileUrl) {
          // Send with PDF file attachment
          await whatsappService.sendWhatsAppMedia({
            to: inv.phoneNumber,
            fileUrl: inv.fileUrl,
            filename: `${inv.invoiceName.replace(/[^\w-]/g, '_')}.pdf`,
            caption
          });
        } else {
          // Send formatted invoice text if no file was uploaded
          await whatsappService.sendWhatsAppMessage({
            to: inv.phoneNumber,
            text: caption
          });
        }

        // Update Notion status to Sent
        await notionService.updateInvoiceStatus(inv.id, 'Sent');

        await notionService.writeRunLog({
          flow: 'invoice',
          triggerType: 'notion_poll',
          status: 'success',
          summary: `Invoice "${inv.invoiceName}" successfully sent to ${inv.phoneNumber} via WhatsApp.`,
          relatedItemId: inv.id
        });

        console.log(`✅ [Flow A] Invoice "${inv.invoiceName}" dispatched and marked as Sent.`);
      } catch (sendErr) {
        console.error(`❌ [Flow A] Failed sending invoice "${inv.invoiceName}":`, sendErr.message);
        await notionService.updateInvoiceStatus(inv.id, 'Send Failed');
        await notionService.writeRunLog({
          flow: 'invoice',
          triggerType: 'notion_poll',
          status: 'failed',
          summary: `Failed sending invoice "${inv.invoiceName}" to ${inv.phoneNumber}.`,
          relatedItemId: inv.id,
          error: sendErr.message
        });
      }
    }
  } catch (err) {
    console.error('❌ [Flow A] Error processing approved invoices:', err.message);
  }
}

/* ========================================================================= */
/* Flow B — Meeting Transcripts -> Tasks Extraction                           */
/* ========================================================================= */

/**
 * Processes meeting transcript and extracts actionable tasks into Tasks DB
 */
async function processMeetingTranscript({ transcriptText, meetingTitle = 'Team Sync' }) {
  const startTime = Date.now();
  console.log(`\n🎙️ [Flow B - Transcript] Processing transcript for: "${meetingTitle}"...`);

  // Write initial in-progress run log
  await notionService.writeRunLog({
    flow: 'meeting_transcript',
    triggerType: 'webhook',
    status: 'pending_approval',
    summary: `Started processing meeting transcript for "${meetingTitle}".`
  });

  // Central storage
  const itemRecord = storageService.saveIncomingItem({
    source: 'meeting_transcript',
    sender: 'Meeting Recorder',
    raw_content: transcriptText
  });

  try {
    const aiResult = await aiService.structureTranscript(transcriptText, meetingTitle);
    const tasks = aiResult.tasks || [];

    console.log(`🤖 [Flow B] AI extracted ${tasks.length} task(s) from transcript.`);

    const createdTasks = [];
    for (const t of tasks) {
      const taskPage = await notionService.createTaskItem({
        task: t.task,
        sourceMeeting: meetingTitle,
        owner: t.owner,
        dueDate: t.dueDate,
        reasoning: t.reasoning,
        status: 'Pending Review'
      });
      createdTasks.push(taskPage.id);
    }

    storageService.updateItem(itemRecord.id, {
      status: 'structured',
      structured_data: aiResult
    });

    await notionService.writeRunLog({
      flow: 'meeting_transcript',
      triggerType: 'webhook',
      status: 'success',
      summary: `Extracted ${tasks.length} actionable task(s) from "${meetingTitle}" staged for review.`,
      relatedItemId: itemRecord.id
    });

    return {
      success: true,
      meetingSummary: aiResult.meetingSummary,
      tasksExtracted: tasks.length,
      taskIds: createdTasks
    };
  } catch (err) {
    console.error('❌ [Flow B] Failed processing transcript:', err.message);
    await notionService.writeRunLog({
      flow: 'meeting_transcript',
      triggerType: 'webhook',
      status: 'failed',
      summary: `Failed processing transcript for "${meetingTitle}".`,
      relatedItemId: itemRecord.id,
      error: err.message
    });
    throw err;
  }
}

/* ========================================================================= */
/* Flow C — Inbound Email / WhatsApp -> Requests & Reminders                  */
/* ========================================================================= */

/**
 * Handles incoming email or WhatsApp message, structures with AI, and stages in Notion
 */
async function processInboundCommunication({ source, sender, subject = '', body = '', sourceId = '' }) {
  const startTime = Date.now();
  console.log(`\n📬 [Flow C - Inbound] Ingesting ${source} message from "${sender}"...`);

  // Central storage
  const itemRecord = storageService.saveIncomingItem({
    id: sourceId,
    source,
    sender,
    raw_content: body || subject
  });

  try {
    let aiResult;
    if (source.toLowerCase() === 'email' || source.toLowerCase() === 'gmail') {
      aiResult = await aiService.structureEmail({ sender, subject, body });
    } else {
      aiResult = await aiService.structureWhatsApp({ sender, body });
    }

    // Handle noise / spam
    if (aiResult.isNoise) {
      console.log(`ℹ️ [Flow C] Message classified as noise/spam. Logging as ignored.`);
      storageService.updateItem(itemRecord.id, { status: 'ignored' });
      await notionService.writeRunLog({
        flow: 'reminders',
        triggerType: 'webhook',
        status: 'ignored',
        summary: `Ignored noise/spam ${source} message from ${sender}.`,
        relatedItemId: itemRecord.id
      });
      return { success: true, ignored: true };
    }

    // Stage actionable request in Notion Requests DB
    const requestPage = await notionService.createRequestItem({
      item: aiResult.title,
      source: source.toLowerCase() === 'email' || source.toLowerCase() === 'gmail' ? 'email' : 'whatsapp',
      sender,
      category: aiResult.category,
      priority: aiResult.priority,
      status: 'Awaiting Approval',
      summary: aiResult.summary,
      draftResponse: aiResult.draftResponse,
      rawContent: body || subject
    });

    storageService.updateItem(itemRecord.id, {
      status: 'pushed_to_notion',
      notion_page_id: requestPage.id,
      structured_data: aiResult
    });

    await notionService.writeRunLog({
      flow: 'reminders',
      triggerType: 'webhook',
      status: 'pending_approval',
      summary: `Parsed inbound ${source} from ${sender} [${aiResult.category}] — draft response staged in Notion.`,
      relatedItemId: requestPage.id
    });

    console.log(`✅ [Flow C] Request staged in Notion: "${aiResult.title}" (${requestPage.id})`);
    return {
      success: true,
      aiResult,
      notionPageId: requestPage.id
    };
  } catch (err) {
    console.error(`❌ [Flow C] Failed processing inbound ${source}:`, err.message);
    await notionService.writeRunLog({
      flow: 'reminders',
      triggerType: 'webhook',
      status: 'failed',
      summary: `Failed processing inbound ${source} from ${sender}.`,
      relatedItemId: itemRecord.id,
      error: err.message
    });
    throw err;
  }
}

/**
 * Checks for approved requests in Notion and dispatches replies
 */
async function processApprovedRequests() {
  try {
    const approvedRequests = await notionService.fetchRequestsByStatus('Approved');
    if (!approvedRequests || approvedRequests.length === 0) return;

    for (const req of approvedRequests) {
      const idempotencyKey = `req_approved_${req.id}`;
      if (storageService.isProcessed(idempotencyKey)) continue;

      console.log(`\n⚡ [Flow C] Dispatching approved reply for: "${req.item}" to ${req.sender}...`);

      try {
        const draft = await notionService.getPageDraftResponse(req.id);
        const replyText = draft || `Hello, your request regarding "${req.item}" has been reviewed and approved.`;

        if (req.source === 'email' || req.source === 'gmail') {
          await gmailService.sendEmail({
            to: req.sender,
            subject: `Re: ${req.item}`,
            body: replyText
          });
        } else {
          await whatsappService.sendWhatsAppMessage({
            to: req.sender,
            text: replyText
          });
        }

        storageService.markProcessed(idempotencyKey, { title: req.item });

        await notionService.writeRunLog({
          flow: 'reminders',
          triggerType: 'notion_poll',
          status: 'success',
          summary: `Approved response dispatched to ${req.sender} via ${req.source}.`,
          relatedItemId: req.id
        });

        console.log(`✅ [Flow C] Response successfully sent to ${req.sender}`);
      } catch (dispatchErr) {
        console.error(`❌ [Flow C] Failed dispatching approved response for ${req.id}:`, dispatchErr.message);
        await notionService.writeRunLog({
          flow: 'reminders',
          triggerType: 'notion_poll',
          status: 'failed',
          summary: `Failed dispatching approved response to ${req.sender}.`,
          relatedItemId: req.id,
          error: dispatchErr.message
        });
      }
    }
  } catch (err) {
    console.error('❌ [Flow C] Error processing approved requests:', err.message);
  }
}

/* ========================================================================= */
/* Periodic Background Poller                                                */
/* ========================================================================= */

/**
 * Runs periodic state checks across all 3 flows
 */
async function runPeriodicPoll() {
  await scanAndStageNewInvoices();
  await processApprovedInvoices();
  await processApprovedRequests();
}

function startBackgroundPoller(intervalMs = 15000) {
  console.log(`🔄 [State Engine] Background poller started (polling Notion every ${intervalMs / 1000}s)...`);
  setInterval(runPeriodicPoll, intervalMs);
}

module.exports = {
  // Flow A
  scanAndStageNewInvoices,
  processApprovedInvoices,
  // Flow B
  processMeetingTranscript,
  // Flow C
  processInboundCommunication,
  processApprovedRequests,
  // Background State Engine
  runPeriodicPoll,
  startBackgroundPoller
};
