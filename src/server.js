require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const webhookRoutes = require('./routes/webhooks');
const notionService = require('./services/notionService');
const pipelineService = require('./services/pipelineService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Kairos Autonomous Engine',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/webhooks', webhookRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('💥 Uncaught Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start Server only if run directly
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`⚡ Kairos Engine running at http://127.0.0.1:${PORT}`);
    console.log(`======================================================`);
    console.log(`📌 Webhook Endpoints:`);
    console.log(`  - Gmail (Pub/Sub):   POST http://127.0.0.1:${PORT}/webhooks/gmail`);
    console.log(`  - WhatsApp Verify:   GET  http://127.0.0.1:${PORT}/webhooks/whatsapp`);
    console.log(`  - WhatsApp Incoming: POST http://127.0.0.1:${PORT}/webhooks/whatsapp`);
    console.log(`  - Event Simulator:   POST http://127.0.0.1:${PORT}/webhooks/simulate`);
    console.log(`======================================================\n`);

    // Initialize Notion in background
    notionService.initNotionDatabases().then((notionStatus) => {
      if (notionStatus.success) {
        console.log('✅ Notion Integration Connected!');
      } else {
        console.log('⚠️ Notion Note:', notionStatus.reason || notionStatus.error);
      }
    });

    // Start Human Approval Background Poller
    pipelineService.startApprovalPoller(15000);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
      console.error(`👉 You can free port ${PORT} or set PORT=${Number(PORT) + 1} in your .env file.\n`);
    } else {
      console.error('❌ Server error:', err.message);
    }
  });
}

module.exports = app;
