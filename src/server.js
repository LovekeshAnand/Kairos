require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');

const fs = require('fs');
const path = require('path');
const webhookRoutes = require('./routes/webhooks');
const authRoutes = require('./routes/auth');
const notionService = require('./services/notionService');
const pipelineService = require('./services/pipelineService');
const whatsappService = require('./services/whatsappService');
const gmailService = require('./services/gmailService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '15mb' }));
const frontendDist = path.join(__dirname, '../frontend/dist');
const publicDir = path.join(__dirname, 'public');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
} else {
  app.use(express.static(publicDir));
}

// Health Check Endpoint
app.get('/health', async (req, res) => {
  const notionStatus = await notionService.validateNotion();
  const openwaStatus = await whatsappService.checkOpenWAHealth();

  res.status(200).json({
    status: 'online',
    service: 'Kairos Autonomous Engine',
    timestamp: new Date().toISOString(),
    integrations: {
      notion: notionStatus.success ? 'connected' : 'degraded',
      openwa: openwaStatus.online ? 'connected' : 'offline',
      gmail: process.env.GMAIL_REFRESH_TOKEN ? 'configured' : 'unconfigured',
      openrouter: process.env.OPENROUTER_API_KEY ? 'configured' : 'unconfigured'
    }
  });
});

// Mount Routes
app.use('/webhooks', webhookRoutes);
app.use('/auth', authRoutes);

// SPA Fallback for client routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/auth') || req.path.startsWith('/webhooks') || req.path.startsWith('/health')) {
    return next();
  }
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('💥 Uncaught Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

/**
 * Automatically registers the Kairos webhook URL with OpenWA Gateway
 */
async function registerOpenWAWebhook() {
  const { apiKey, apiUrl } = whatsappService.getOpenWAConfig();
  const webhookUrl = `http://localhost:${PORT}/webhooks/whatsapp`;

  try {
    const sessRes = await axios.get(`${apiUrl}/api/sessions`, {
      headers: { 'X-API-Key': apiKey },
      timeout: 5000
    });
    const sessions = sessRes.data || [];
    for (const s of sessions) {
      const sid = s.id || s.name;
      try {
        await axios.post(
          `${apiUrl}/api/sessions/${sid}/webhooks`,
          {
            url: webhookUrl,
            events: ['message.received', 'session.status']
          },
          {
            headers: {
              'X-API-Key': apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 6000
          }
        );
        console.log(`🔗 [OpenWA] Automatically registered webhook dispatcher for session (${sid}) -> ${webhookUrl}`);
      } catch (regErr) {
        // Status 409 (already registered) or status 400 is fine
      }
    }
  } catch (err) {
    console.log(`ℹ️ [OpenWA] Webhook registration pending: ${err.message}`);
  }
}

// Server Startup
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n================================================================`);
    console.log(`⏳ KAIROS AUTONOMOUS OPERATIONS ENGINE (NOTION TRACK)`);
    console.log(`================================================================`);
    console.log(`🚀 Engine running at:  http://127.0.0.1:${PORT}`);
    console.log(`🏥 Health Check:       http://127.0.0.1:${PORT}/health`);
    console.log(`📌 Webhook Endpoints:`);
    console.log(`   - Gmail Pub/Sub:    POST http://127.0.0.1:${PORT}/webhooks/gmail`);
    console.log(`   - WhatsApp Inbound: POST http://127.0.0.1:${PORT}/webhooks/whatsapp`);
    console.log(`   - Transcripts:      POST http://127.0.0.1:${PORT}/webhooks/transcript`);
    console.log(`   - Multi-Simulator:  POST http://127.0.0.1:${PORT}/webhooks/simulate`);
    console.log(`================================================================\n`);

    // 1. Validate Notion Connections
    await notionService.validateNotion();

    // 2. Check OpenWA & Register Webhook
    const waHealth = await whatsappService.checkOpenWAHealth();
    if (waHealth.online) {
      console.log('✅ OpenWA Gateway is online on port 2785');
      await registerOpenWAWebhook();
    } else {
      console.log('⚠️ OpenWA Gateway offline (run OpenWA on port 2785)');
    }

    // 3. Start Gmail users.watch()
    if (process.env.GMAIL_REFRESH_TOKEN) {
      await gmailService.startGmailWatch();
    }

    // 4. Start Background State Engine (checks approvals every 15s)
    pipelineService.startBackgroundPoller(15000);

    // 5. Background Gmail Inbox Poller (every 20s for real-time inbox ingestion)
    if (process.env.GMAIL_REFRESH_TOKEN) {
      setInterval(async () => {
        try {
          await gmailService.fetchAndProcessLatestEmails(5);
        } catch (err) {
          // Quiet background sync
        }
      }, 20000);
    }

    // 6. Gmail Watch 5-Day Renewal Cron
    setInterval(async () => {
      console.log('🔄 [Gmail] Running periodic 5-day watch renewal...');
      await gmailService.startGmailWatch();
    }, 5 * 24 * 60 * 60 * 1000);
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
      console.error(`👉 Set a different PORT in your .env file.\n`);
    } else {
      console.error('❌ Server error:', err.message);
    }
  });
}

module.exports = app;
