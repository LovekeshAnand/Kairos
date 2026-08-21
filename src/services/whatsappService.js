const axios = require('axios');
require('dotenv').config();

const OPENWA_API_URL = process.env.OPENWA_API_URL || 'http://localhost:2785';
const OPENWA_API_KEY = process.env.OPENWA_API_KEY;
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID;

/**
 * Normalizes phone number, group ID, or LID into proper WhatsApp chatId format
 * Supports:
 * - Direct contacts: 919876543210@c.us
 * - Group chats: 120363409582504727@g.us
 * - WhatsApp LIDs: 7370348429484@lid
 */
function formatChatId(recipient) {
  if (!recipient) return null;
  const clean = String(recipient).trim();
  if (clean.endsWith('@c.us') || clean.endsWith('@lid') || clean.endsWith('@g.us')) {
    return clean;
  }
  const digits = clean.replace(/[^\d]/g, '');
  // WhatsApp Group IDs start with 120363 or are 17+ digits
  if (digits.startsWith('120363') || digits.length >= 17) {
    return `${digits}@g.us`;
  }
  // WhatsApp LIDs (13-16 digits without country code prefix)
  if (digits.length >= 13 && !digits.startsWith('91') && !digits.startsWith('1')) {
    return `${digits}@lid`;
  }
  return `${digits}@c.us`;
}

/**
 * Checks if OpenWA service is healthy and connected
 */
async function checkOpenWAHealth() {
  try {
    const res = await axios.get(`${OPENWA_API_URL}/api/health`, { timeout: 4000 });
    return { online: res.status === 200, data: res.data };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

/**
 * Sends a text message via OpenWA Gateway with anti-ban debounce
 */
async function sendWhatsAppMessage({ to, text }) {
  if (!to || !text) {
    throw new Error('Missing "to" or "text" for WhatsApp message');
  }

  const chatId = formatChatId(to);

  // Anti-ban simulation: slight human delay before outbound send
  await new Promise(resolve => setTimeout(resolve, 1500));

  try {
    const endpoint = `${OPENWA_API_URL}/api/sessions/${OPENWA_SESSION_ID}/messages/send-text`;
    const response = await axios.post(
      endpoint,
      {
        chatId,
        text
      },
      {
        headers: {
          'X-API-Key': OPENWA_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      }
    );

    console.log(`📤 [OpenWA] Message successfully sent to ${chatId}: "${text.slice(0, 60)}..."`);
    return response.data;
  } catch (err) {
    console.error(`❌ [OpenWA] Failed sending WhatsApp message to ${chatId}:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Sends a document or media file (e.g. Invoice PDF) via OpenWA Gateway
 */
async function sendWhatsAppMedia({ to, fileUrl, filename = 'invoice.pdf', caption = '' }) {
  if (!to || !fileUrl) {
    throw new Error('Missing "to" or "fileUrl" for WhatsApp media send');
  }

  const chatId = formatChatId(to);

  // Anti-ban debounce
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Download file buffer or pass external url depending on format
    let base64Content = null;
    let mimeType = 'application/pdf';

    try {
      const fileRes = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 15000 });
      base64Content = Buffer.from(fileRes.data, 'binary').toString('base64');
      mimeType = fileRes.headers['content-type'] || 'application/pdf';
    } catch (fetchErr) {
      console.warn('⚠️ Could not download file buffer, falling back to direct URL:', fetchErr.message);
    }

    const endpoint = `${OPENWA_API_URL}/api/sessions/${OPENWA_SESSION_ID}/messages/send-media`;
    
    const payload = base64Content
      ? {
          chatId,
          data: `data:${mimeType};base64,${base64Content}`,
          filename,
          caption
        }
      : {
          chatId,
          url: fileUrl,
          filename,
          caption
        };

    const response = await axios.post(
      endpoint,
      payload,
      {
        headers: {
          'X-API-Key': OPENWA_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log(`📄 [OpenWA] Invoice media successfully dispatched to ${chatId}`);
    return response.data;
  } catch (err) {
    console.error(`❌ [OpenWA] Failed sending media to ${chatId}:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Fetches QR code and session state from OpenWA for web onboarding
 */
async function getQRCode() {
  try {
    let res = await axios.get(`${OPENWA_API_URL}/api/sessions/${OPENWA_SESSION_ID}`, {
      headers: { 'X-API-Key': OPENWA_API_KEY },
      timeout: 5000
    });

    // If disconnected, auto-start the session so OpenWA launches Puppeteer & generates the QR code
    if (res.data?.status === 'disconnected' || !res.data?.engineLoaded) {
      try {
        const startRes = await axios.post(`${OPENWA_API_URL}/api/sessions/${OPENWA_SESSION_ID}/start`, {}, {
          headers: { 'X-API-Key': OPENWA_API_KEY },
          timeout: 10000
        });
        res = startRes;
      } catch (startErr) {
        console.warn('⚠️ Could not auto-start session:', startErr.message);
      }
    }

    let qrCode = res.data?.qr || null;
    if (!qrCode && (res.data?.status === 'qr_ready' || res.data?.status === 'disconnected' || !res.data?.phone)) {
      try {
        const qrRes = await axios.get(`${OPENWA_API_URL}/api/sessions/${OPENWA_SESSION_ID}/qr`, {
          headers: { 'X-API-Key': OPENWA_API_KEY },
          timeout: 5000
        });
        qrCode = qrRes.data?.qrCode || qrRes.data?.qr || null;
      } catch (qrErr) {
        // Keep qrCode as null if not ready yet
      }
    }

    return {
      success: true,
      status: res.data?.status || 'disconnected',
      phone: res.data?.phone || null,
      pushName: res.data?.pushName || null,
      qr: qrCode
    };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data?.message || err.message
    };
  }
}

/**
 * Disconnects / logs out the active WhatsApp session in OpenWA
 */
async function disconnectSession() {
  try {
    await axios.post(`${OPENWA_API_URL}/api/sessions/${OPENWA_SESSION_ID}/logout`, {}, {
      headers: { 'X-API-Key': OPENWA_API_KEY },
      timeout: 10000
    });
    return { success: true, message: 'WhatsApp session logged out successfully.' };
  } catch (err) {
    try {
      await axios.delete(`${OPENWA_API_URL}/api/sessions/${OPENWA_SESSION_ID}`, {
        headers: { 'X-API-Key': OPENWA_API_KEY },
        timeout: 10000
      });
      return { success: true, message: 'WhatsApp session reset successfully.' };
    } catch (e2) {
      return { success: false, error: e2.response?.data?.message || e2.message };
    }
  }
}

/**
 * Parses incoming webhook payloads from OpenWA
 */
function parseOpenWAWebhook(body) {
  try {
    const event = body.event || body.type;
    const data = body.data || body;

    // Filter incoming message events
    if (event && !event.includes('message')) {
      return null;
    }

    const rawSender = data.from || data.sender || data.author || '';
    const bodyText = data.body || data.text || data.caption || '';
    const messageId = data.id || data.messageId || `wa_${Date.now()}`;
    const pushname = data.pushname || data.notifyName || data.name || '';
    const hasMedia = data.hasMedia || data.type === 'image' || data.type === 'document' || data.type === 'video';

    // Ignore messages sent by ourselves or empty text without media
    if ((!bodyText && !hasMedia) || data.fromMe === true) {
      return null;
    }

    // Clean device instance suffix if present (e.g. 918929750553:12@c.us -> 918929750553@c.us)
    const sender = String(rawSender).replace(/:.*@/, '@');
    const senderName = pushname || sender.replace(/@.*$/, '');
    const isGroup = sender.includes('@g.us') || sender.startsWith('120363');

    const attachments = [];
    if (hasMedia && data.mediaUrl) {
      attachments.push({
        filename: data.filename || `whatsapp_${Date.now()}.${data.mimetype?.split('/')[1] || 'pdf'}`,
        url: data.mediaUrl,
        type: data.type === 'image' ? 'Image' : 'Document',
        category: 'General'
      });
    }

    return {
      messageId,
      sender,
      senderName,
      body: bodyText || (hasMedia ? '[Media Document Attached]' : ''),
      isGroup,
      attachments,
      raw: data
    };
  } catch (err) {
    console.error('❌ Error parsing OpenWA webhook:', err.message);
    return null;
  }
}

module.exports = {
  checkOpenWAHealth,
  sendWhatsAppMessage,
  sendWhatsAppMedia,
  parseOpenWAWebhook,
  formatChatId,
  getQRCode,
  disconnectSession
};
