const axios = require('axios');
const fs = require('fs');
const path = require('path');

function getOpenWAConfig() {
  let apiKey = process.env.OPENWA_API_KEY;
  if (!apiKey) {
    const keyFile = path.join(__dirname, '../../openwa/data/.api-key');
    if (fs.existsSync(keyFile)) {
      try {
        apiKey = fs.readFileSync(keyFile, 'utf-8').trim();
      } catch (e) {}
    }
  }
  if (!apiKey) apiKey = 'kairos-openwa-secret-key-2026';

  const apiUrl = process.env.OPENWA_API_URL || 'http://localhost:2785';
  const sessionId = process.env.OPENWA_SESSION_ID || 'default';
  return { apiKey, apiUrl, sessionId };
}

/**
 * Normalizes phone number, group ID, or LID into proper WhatsApp chatId format
 */
function formatChatId(recipient) {
  if (!recipient) return null;
  const clean = String(recipient).trim();
  if (clean.endsWith('@c.us') || clean.endsWith('@lid') || clean.endsWith('@g.us')) {
    return clean;
  }
  const digits = clean.replace(/[^\d]/g, '');
  if (digits.startsWith('120363') || digits.length >= 17) {
    return `${digits}@g.us`;
  }
  if (digits.length >= 13 && !digits.startsWith('91') && !digits.startsWith('1')) {
    return `${digits}@lid`;
  }
  return `${digits}@c.us`;
}

/**
 * Checks if OpenWA service is healthy and connected
 */
async function checkOpenWAHealth() {
  const { apiUrl } = getOpenWAConfig();
  try {
    const res = await axios.get(`${apiUrl}/api/health`, { timeout: 4000 });
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

  const { apiKey, apiUrl, sessionId } = getOpenWAConfig();
  const chatId = formatChatId(to);

  // Anti-ban simulation: slight human delay before outbound send
  await new Promise(resolve => setTimeout(resolve, 1500));

  try {
    // Resolve active session id dynamically
    let targetSessionId = sessionId;
    try {
      const sessRes = await axios.get(`${apiUrl}/api/sessions`, { headers: { 'X-API-Key': apiKey }, timeout: 4000 });
      if (sessRes.data?.length > 0) {
        targetSessionId = sessRes.data[0].id || sessRes.data[0].name || sessionId;
      }
    } catch (e) {}

    const endpoint = `${apiUrl}/api/sessions/${targetSessionId}/messages/send-text`;
    const response = await axios.post(
      endpoint,
      {
        chatId,
        text
      },
      {
        headers: {
          'X-API-Key': apiKey,
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

  const { apiKey, apiUrl, sessionId } = getOpenWAConfig();
  const chatId = formatChatId(to);

  // Anti-ban debounce
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    let targetSessionId = sessionId;
    try {
      const sessRes = await axios.get(`${apiUrl}/api/sessions`, { headers: { 'X-API-Key': apiKey }, timeout: 4000 });
      if (sessRes.data?.length > 0) {
        targetSessionId = sessRes.data[0].id || sessRes.data[0].name || sessionId;
      }
    } catch (e) {}

    let base64Content = null;
    let mimeType = 'application/pdf';

    try {
      const fileRes = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 15000 });
      base64Content = Buffer.from(fileRes.data, 'binary').toString('base64');
      mimeType = fileRes.headers['content-type'] || 'application/pdf';
    } catch (fetchErr) {
      console.warn('⚠️ Could not download file buffer, falling back to direct URL:', fetchErr.message);
    }

    const endpoint = `${apiUrl}/api/sessions/${targetSessionId}/messages/send-media`;
    
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
          'X-API-Key': apiKey,
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
  const { apiKey, apiUrl } = getOpenWAConfig();
  const headers = { 'X-API-Key': apiKey };

  try {
    // 1. Discover sessions
    let sessionsRes = await axios.get(`${apiUrl}/api/sessions`, { headers, timeout: 5000 });
    let sessions = sessionsRes.data || [];
    let session = sessions.length > 0 ? sessions[0] : null;

    // 2. If no session exists, create one
    if (!session) {
      const createRes = await axios.post(`${apiUrl}/api/sessions`, { name: 'default' }, { headers, timeout: 8000 });
      session = createRes.data;
    }

    const sessionId = session.id || session.name || 'default';

    // 3. If session is not started, start it
    if (session.status === 'created' || session.status === 'disconnected') {
      try {
        const startRes = await axios.post(`${apiUrl}/api/sessions/${sessionId}/start`, {}, { headers, timeout: 10000 });
        session = startRes.data;
      } catch (startErr) {
        console.warn('⚠️ Could not start session:', startErr.message);
      }
    }

    // 4. Fetch QR code
    let qrCode = session.qr || null;
    if (!qrCode && (session.status === 'qr_ready' || session.status === 'created' || !session.phone)) {
      try {
        const qrRes = await axios.get(`${apiUrl}/api/sessions/${sessionId}/qr`, { headers, timeout: 5000 });
        qrCode = qrRes.data?.qrCode || qrRes.data?.qr || null;
      } catch (qrErr) {
        // QR not ready yet
      }
    }

    return {
      success: true,
      sessionId: sessionId,
      status: session.status || 'qr_ready',
      phone: session.phone || null,
      pushName: session.pushName || null,
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
  disconnectSession,
  getOpenWAConfig
};
