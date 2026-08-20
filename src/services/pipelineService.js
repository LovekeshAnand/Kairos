const notionService = require('./notionService');
const aiService = require('./aiService');
const gmailService = require('./gmailService');
const whatsappService = require('./whatsappService');

/**
 * Unified Ingestion & Processing Pipeline
 */
async function processIncomingItem({ source, sender, subject = '', body = '', sourceId = '' }) {
  const startTime = Date.now();
  const executionId = `RUN-${source.toUpperCase()}-${Date.now()}`;
  console.log(`\n🚀 [Kairos Engine] Processing inbound ${source} message from "${sender}"...`);

  try {
    // 1. AI Analysis & Draft Generation
    const aiResult = await aiService.processMessageWithAI({
      sender,
      subject,
      body,
      source
    });

    console.log(`🤖 AI Analysis: Priority=[${aiResult.priority}], Category=[${aiResult.category}]`);
    console.log(`📝 AI Summary: "${aiResult.summary}"`);

    // 2. Create Action Item in Notion
    const actionItem = await notionService.createActionItem({
      title: aiResult.title,
      source,
      sender,
      priority: aiResult.priority,
      category: aiResult.category,
      status: 'Needs Approval',
      summary: aiResult.summary,
      draftResponse: aiResult.draftResponse,
      rawMessage: body,
      sourceId
    });

    const durationMs = Date.now() - startTime;

    // 3. Log into Notion Run Log (Audit Trail)
    await notionService.logExecution({
      executionId,
      trigger: `${source} Webhook`,
      status: 'Pending Approval',
      actionTaken: `Parsed inbound ${source} message, categorized as [${aiResult.category}], and generated draft response waiting for human approval.`,
      durationMs
    });

    return {
      success: true,
      executionId,
      aiResult,
      actionItem
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`❌ Pipeline failed for ${source} item:`, error.message);

    await notionService.logExecution({
      executionId,
      trigger: `${source} Webhook`,
      status: 'Failed',
      actionTaken: `Failed during pipeline execution for ${source} from ${sender}`,
      durationMs,
      errorDetails: error.message
    });

    return {
      success: false,
      executionId,
      error: error.message
    };
  }
}

/**
 * Periodic Human Approval Poller
 * Scans Notion for items marked "Approved" by humans and dispatches the real actions.
 */
async function checkAndDispatchApprovedActions() {
  try {
    const approvedItems = await notionService.fetchApprovedItems();

    if (!approvedItems || approvedItems.length === 0) {
      return;
    }

    console.log(`\n⚡ Found ${approvedItems.length} approved item(s) in Notion! Executing real-world actions...`);

    for (const item of approvedItems) {
      const startTime = Date.now();
      const executionId = `DISPATCH-${Date.now()}`;

      try {
        console.log(`📤 Dispatching approved response for item: "${item.title}" to ${item.sender}`);

        let dispatchResult;
        if (item.source === 'Gmail') {
          dispatchResult = await gmailService.sendEmail({
            to: item.sender,
            subject: `Re: ${item.title}`,
            body: item.draftResponse
          });
        } else if (item.source === 'WhatsApp') {
          dispatchResult = await whatsappService.sendWhatsAppMessage({
            to: item.sender,
            text: item.draftResponse
          });
        } else {
          console.log(`ℹ️ Simulated dispatch for source: ${item.source}`);
          dispatchResult = { simulated: true };
        }

        // Update Notion status to Completed
        await notionService.updateItemStatus(item.id, 'Completed');

        const durationMs = Date.now() - startTime;

        // Log to Run Log
        await notionService.logExecution({
          executionId,
          trigger: 'Human Approval',
          status: 'Success',
          actionTaken: `Dispatched approved response to ${item.sender} via ${item.source}. Action marked as Completed in Notion.`,
          durationMs
        });

        console.log(`✅ Action successfully dispatched and marked Completed for "${item.title}"`);
      } catch (dispatchErr) {
        console.error(`❌ Error dispatching approved item ${item.id}:`, dispatchErr.message);
        await notionService.logExecution({
          executionId,
          trigger: 'Human Approval',
          status: 'Failed',
          actionTaken: `Failed dispatching to ${item.sender} via ${item.source}`,
          durationMs: Date.now() - startTime,
          errorDetails: dispatchErr.message
        });
      }
    }
  } catch (err) {
    // Suppress loop error spam if DB not connected
  }
}

/**
 * Starts background poller for approved items (runs every 15 seconds)
 */
function startApprovalPoller(intervalMs = 15000) {
  console.log(`🔄 Human approval monitor started (checking every ${intervalMs / 1000}s)...`);
  setInterval(checkAndDispatchApprovedActions, intervalMs);
}

module.exports = {
  processIncomingItem,
  checkAndDispatchApprovedActions,
  startApprovalPoller
};
