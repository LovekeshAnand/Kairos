const express = require('express');
const router = express.Router();
const gmailService = require('../services/gmailService');
const whatsappService = require('../services/whatsappService');
const pipelineService = require('../services/pipelineService');

/**
 * POST /webhooks/gmail
 * Google Cloud Pub/Sub Push Ingestion Endpoint
 */
router.post('/gmail', async (req, res) => {
  try {
    const message = req.body?.message;
    if (!message || !message.data) {
      console.warn('⚠️ Received malformed Pub/Sub payload');
      return res.status(400).send('Invalid Pub/Sub message structure');
    }

    // Immediate 200 acknowledgment to Google Pub/Sub (prevents duplicate retries)
    res.status(200).send('OK');

    // Decode base64 payload: { emailAddress, historyId }
    const rawData = Buffer.from(message.data, 'base64').toString('utf-8');
    const data = JSON.parse(rawData);
    console.log(`\n📬 [Gmail Webhook] Inbound Pub/Sub push notification for: ${data.emailAddress} (historyId: ${data.historyId})`);

    if (data.historyId) {
      setImmediate(async () => {
        await gmailService.processHistoryUpdate(data.historyId, async email => {
          await pipelineService.processInboundCommunication({
            source: 'email',
            sender: email.sender,
            subject: email.subject,
            body: email.body,
            sourceId: `gmail_${email.id}`
          });
        });
      });
    }
  } catch (error) {
    console.error('❌ Error handling Gmail webhook:', error.message);
    if (!res.headersSent) {
      res.status(500).send('Error');
    }
  }
});

/**
 * POST /webhooks/whatsapp
 * OpenWA Gateway Inbound Webhook Endpoint
 */
router.post('/whatsapp', async (req, res) => {
  try {
    // Fast 200 acknowledgment to OpenWA
    res.status(200).json({ status: 'received' });

    const parsed = whatsappService.parseOpenWAWebhook(req.body);
    if (!parsed) {
      return; // Ignore system / non-message events
    }

    console.log(`\n💬 [WhatsApp Webhook] Inbound message from ${parsed.senderName} (${parsed.sender}): "${parsed.body}"`);

    // Async pipeline processing
    setImmediate(async () => {
      await pipelineService.processInboundCommunication({
        source: 'whatsapp',
        sender: parsed.sender,
        subject: `WhatsApp message from ${parsed.senderName}`,
        body: parsed.body,
        sourceId: `wa_${parsed.messageId}`
      });
    });
  } catch (error) {
    console.error('❌ Error handling WhatsApp webhook:', error.message);
  }
});

/**
 * POST /webhooks/transcript
 * Google Meet Transcript Ingestion Endpoint
 */
router.post('/transcript', async (req, res) => {
  const { transcript, meetingTitle = 'Google Meet Review' } = req.body || {};

  if (!transcript) {
    return res.status(400).json({ error: 'Missing "transcript" field in request body' });
  }

  try {
    const result = await pipelineService.processMeetingTranscript({
      transcriptText: transcript,
      meetingTitle
    });

    res.status(200).json({
      message: 'Meeting transcript successfully processed and tasks staged in Notion.',
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/simulate
 * Universal Simulator Endpoint for Demos & Testing (Flow A, B, or C)
 */
router.post('/simulate', async (req, res) => {
  const { flow = 'C', payload = {} } = req.body || {};

  try {
    if (flow.toUpperCase() === 'A' || flow.toLowerCase() === 'invoice') {
      // Simulate Flow A: Ingest new invoice
      const notionService = require('../services/notionService');
      const invoice = await notionService.createInvoiceItem({
        invoiceName: payload.invoiceName || `Invoice #INV-${Math.floor(1000 + Math.random() * 9000)}`,
        recipientName: payload.recipientName || 'Lovekesh Anand',
        phoneNumber: payload.phoneNumber || '918929750553',
        amount: payload.amount || 2500,
        dueDate: payload.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'New'
      });

      return res.status(200).json({
        message: 'Flow A simulated: New invoice staged in Notion Invoices DB.',
        invoiceId: invoice.id
      });
    }

    if (flow.toUpperCase() === 'B' || flow.toLowerCase() === 'transcript') {
      // Simulate Flow B: Ingest transcript
      const sampleTranscript = payload.transcript || `
John: "Let's review the hackathon roadmap. Sarah, can you finalize the client invoice template by Friday?"
Sarah: "Sure, I'll have the invoice PDF ready by Friday."
John: "Great. Mike, please make sure the OpenWA session auto-restart is tested before demo day."
Mike: "Got it, I will test the session persistence tomorrow."
John: "Thanks everyone, that's all for today."
`;
      const result = await pipelineService.processMeetingTranscript({
        transcriptText: sampleTranscript,
        meetingTitle: payload.meetingTitle || 'Sprint Planning Meeting'
      });

      return res.status(200).json({
        message: 'Flow B simulated: Transcript processed and tasks staged.',
        result
      });
    }

    // Default Flow C: Inbound Email/WhatsApp message
    const result = await pipelineService.processInboundCommunication({
      source: payload.source || 'email',
      sender: payload.sender || (payload.source === 'whatsapp' ? '918929750553' : 'client.partner@company.com'),
      subject: payload.subject || 'URGENT: Request for updated proposal and billing schedule',
      body: payload.body || 'Hi Team, please send over the finalized project proposal and billing schedule before tomorrow 5 PM so we can sign off.',
      sourceId: `sim_${Date.now()}`
    });

    return res.status(200).json({
      message: 'Flow C simulated: Inbound communication processed and staged in Notion.',
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/poll
 * Triggers immediate approval state check across all databases
 */
router.post('/poll', async (req, res) => {
  try {
    await pipelineService.runPeriodicPoll();
    res.status(200).json({ message: 'State poll executed successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
