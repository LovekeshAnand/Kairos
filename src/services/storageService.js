const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'kairos-store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial state schema
const defaultState = {
  incoming_items: [],
  idempotency_keys: {},
  watch_state: {
    lastHistoryId: null,
    watchExpiration: null,
    lastRenewed: null
  },
  processed_actions: {}
};

function readStore() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultState, null, 2), 'utf-8');
      return { ...defaultState };
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('⚠️ Storage read error, resetting to default:', err.message);
    return { ...defaultState };
  }
}

function writeStore(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ Storage write error:', err.message);
  }
}

/**
 * Checks if an event/message has already been processed (idempotency guard)
 */
function isProcessed(key) {
  if (!key) return false;
  const store = readStore();
  return Boolean(store.idempotency_keys[key]);
}

/**
 * Marks an event/message as processed
 */
function markProcessed(key, metadata = {}) {
  if (!key) return;
  const store = readStore();
  store.idempotency_keys[key] = {
    processedAt: new Date().toISOString(),
    ...metadata
  };
  writeStore(store);
}

/**
 * Records an incoming raw item into central data storage
 */
function saveIncomingItem({ id, source, raw_content, sender, structured_data = null, notion_page_id = null }) {
  const store = readStore();
  const record = {
    id: id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    source,
    sender,
    raw_content,
    received_at: new Date().toISOString(),
    status: 'new',
    structured_data,
    notion_page_id,
    error: null
  };
  store.incoming_items.push(record);
  writeStore(store);
  return record;
}

/**
 * Updates an item's status in central data storage
 */
function updateItem(id, updates) {
  const store = readStore();
  const index = store.incoming_items.findIndex(item => item.id === id);
  if (index !== -1) {
    store.incoming_items[index] = { ...store.incoming_items[index], ...updates, updatedAt: new Date().toISOString() };
    writeStore(store);
    return store.incoming_items[index];
  }
  return null;
}

/**
 * Gets Gmail watch state
 */
function getWatchState() {
  const store = readStore();
  return store.watch_state;
}

/**
 * Updates Gmail watch state
 */
function updateWatchState(updates) {
  const store = readStore();
  store.watch_state = { ...store.watch_state, ...updates };
  writeStore(store);
  return store.watch_state;
}

module.exports = {
  readStore,
  writeStore,
  getAllData: readStore,
  saveAllData: writeStore,
  isProcessed,
  markProcessed,
  saveIncomingItem,
  updateItem,
  getWatchState,
  updateWatchState
};
