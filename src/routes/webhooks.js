const express = require('express');
const router = express.Router();
const gmailService = require('../services/gmailService');
const whatsappService = require('../services/whatsappService');
const pipelineService = require('../services/pipelineService');

/**
 * POST /webhooks/gmail
 * Google Cloud Pub/Sub Push Endpoint
 */
router.post('/gmail', async (req, res) => {
  try {
    const message = req.body?.message;
    if (!message || !message.data) {
      console.warn('⚠️ Received malformed Pub/Sub payload');
      return res.status(400).send('Invalid Pub/Sub message');
    }

    // Acknowledge immediately to Google Pub/Sub (prevents redelivery)
    res.status(200).send('OK');

    // Decode base64 data: { emailAddress, historyId }
    const rawData = Buffer.from(message.data, 'base64').toString('utf-8');
    const data = JSON.parse(rawData);
    console.log(`\n📬 [Gmail PubSub Webhook] Received notification:`, data);

    if (data.historyId) {
      // Asynchronously process the new email(s) from history
      setImmediate(async () => {
        await gmailService.processHistoryUpdate(data.historyId, async (email) => {
          await pipelineService.processIncomingItem({
            source: 'Gmail',
            sender: email.sender,
            subject: email.subject,
            body: email.body,
            sourceId: email.id
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
 * GET /webhooks/whatsapp
 * Meta WhatsApp Cloud API Verification Challenge
 */
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'kairos_webhook_secret_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('✅ WhatsApp Webhook verified successfully!');
    return res.status(200).send(challenge);
  } else {
    console.warn('❌ WhatsApp Webhook verification failed. Token mismatch.');
    return res.sendStatus(403);
  }
});

/**
 * POST /webhooks/whatsapp
 * Meta WhatsApp Cloud API Inbound Message Payload
 */
router.post('/whatsapp', async (req, res) => {
  try {
    // Fast 200 acknowledgment to Meta
    res.status(200).send('EVENT_RECEIVED');

    const parsed = whatsappService.parseWhatsAppPayload(req.body);
    if (!parsed) {
      // Ignored if it's a delivery status update or non-message payload
      return;
    }

    console.log(`\n💬 [WhatsApp Webhook] Received message from ${parsed.senderName} (${parsed.from}): "${parsed.body}"`);

    // Asynchronously feed to pipeline
    setImmediate(async () => {
      await pipelineService.processIncomingItem({
        source: 'WhatsApp',
        sender: parsed.from,
        subject: `WhatsApp message from ${parsed.senderName}`,
        body: parsed.body,
        sourceId: parsed.messageId
      });
    });
  } catch (error) {
    console.error('❌ Error handling WhatsApp webhook:', error.message);
  }
});

/**
 * POST /webhooks/simulate
 * Instant Simulator Endpoint to test incoming Gmail or WhatsApp messages locally
 */
router.post('/simulate', async (req, res) => {
  const {
    source = 'Gmail',
    sender = source === 'Gmail' ? 'student.club@university.edu' : '+919876543210',
    subject = 'URGENT: Request for venue permission for hackathon tomorrow',
    body = 'Respected Admin,\nWe need immediate approval for Hall 4 for the upcoming 24hr hackathon as 150 students are registered. Please confirm at the earliest.\n\nThanks,\nStudent Council'
  } = req.body || {};

  try {
    const result = await pipelineService.processIncomingItem({
      source,
      sender,
      subject,
      body,
      sourceId: `SIM-${Date.now()}`
    });

    res.status(200).json({
      message: `Simulated inbound ${source} event successfully processed!`,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhooks/poll/approved
 * Manually triggers check for approved items in Notion
 */
router.post('/poll/approved', async (req, res) => {
  try {
    await pipelineService.checkAndDispatchApprovedActions();
    res.status(200).json({ message: 'Approval poll executed.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
