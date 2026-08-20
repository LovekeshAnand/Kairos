const axios = require('axios');
require('dotenv').config();

/**
 * Parses incoming Meta WhatsApp Cloud API webhook payload
 */
function parseWhatsAppPayload(body) {
  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages || value.messages.length === 0) {
      return null;
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0] || {};

    let textContent = '';
    if (message.type === 'text') {
      textContent = message.text?.body || '';
    } else if (message.type === 'interactive') {
      textContent = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
    } else if (message.type === 'button') {
      textContent = message.button?.text || '';
    } else {
      textContent = `[Received ${message.type} attachment/message]`;
    }

    return {
      messageId: message.id,
      from: message.from,
      senderName: contact.profile?.name || message.from,
      timestamp: message.timestamp,
      body: textContent,
      type: message.type
    };
  } catch (error) {
    console.error('❌ Failed to parse WhatsApp payload:', error.message);
    return null;
  }
}

/**
 * Sends a WhatsApp message via Meta Cloud API
 */
async function sendWhatsAppMessage({ to, text }) {
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('⚠️ WhatsApp credentials not configured. Simulating message dispatch.');
    return { simulated: true, to, text };
  }

  const endpoint = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await axios.post(
    endpoint,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

module.exports = {
  parseWhatsAppPayload,
  sendWhatsAppMessage
};
