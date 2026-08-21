const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure data directory exists
const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'kairos.db');

let db;
try {
  // Use Node.js built-in native SQLite engine
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);
} catch (err) {
  console.error('❌ Failed to initialize node:sqlite:', err.message);
  throw err;
}

// Initialize tables
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      refresh_token TEXT,
      access_token TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notion_configs (
      user_id TEXT PRIMARY KEY,
      notion_api_key TEXT,
      parent_page_id TEXT,
      run_log_db_id TEXT,
      invoices_db_id TEXT,
      tasks_db_id TEXT,
      requests_db_id TEXT,
      documents_db_id TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      flow TEXT,
      action TEXT,
      status TEXT,
      summary TEXT,
      created_at TEXT NOT NULL
    );
  `);
  console.log('📦 [SQLite] Database initialized schema at:', DB_PATH);
}

initSchema();

/**
 * Upserts a user from Google OAuth profile & tokens
 */
function upsertUser({ email, name, picture, refreshToken, accessToken }) {
  const existing = getUserByEmail(email);
  const now = new Date().toISOString();

  if (existing) {
    const query = db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        picture = COALESCE(?, picture),
        refresh_token = COALESCE(?, refresh_token),
        access_token = COALESCE(?, access_token),
        last_login_at = ?
      WHERE email = ?
    `);
    query.run(name || null, picture || null, refreshToken || null, accessToken || null, now, email);
    return getUserByEmail(email);
  } else {
    const id = 'usr_' + crypto.randomBytes(8).toString('hex');
    const query = db.prepare(`
      INSERT INTO users (id, email, name, picture, refresh_token, access_token, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    query.run(id, email, name || 'Kairos User', picture || '', refreshToken || '', accessToken || '', now, now);
    return getUserById(id);
  }
}

function getUserById(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) || null;
}

function getUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) || null;
}

/**
 * Creates a new active session
 */
function createSession(userId, days = 14) {
  const sessionId = 'sess_' + crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO sessions (session_id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(sessionId, userId, expiresAt, now.toISOString());
  return { sessionId, userId, expiresAt };
}

/**
 * Validates and retrieves an active session
 */
function getSession(sessionId) {
  if (!sessionId) return null;
  const stmt = db.prepare(`
    SELECT s.session_id, s.user_id, s.expires_at, u.email, u.name, u.picture, u.refresh_token
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.session_id = ?
  `);
  const session = stmt.get(sessionId);
  if (!session) return null;

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
    deleteSession(sessionId);
    return null;
  }
  return session;
}

/**
 * Deletes / invalidates a session
 */
function deleteSession(sessionId) {
  if (!sessionId) return;
  const stmt = db.prepare('DELETE FROM sessions WHERE session_id = ?');
  stmt.run(sessionId);
}

/**
 * Saves Notion Database IDs mapped to user
 */
function saveNotionConfig(userId, config) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO notion_configs (
      user_id, notion_api_key, parent_page_id, run_log_db_id,
      invoices_db_id, tasks_db_id, requests_db_id, documents_db_id, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      notion_api_key = excluded.notion_api_key,
      parent_page_id = excluded.parent_page_id,
      run_log_db_id = excluded.run_log_db_id,
      invoices_db_id = excluded.invoices_db_id,
      tasks_db_id = excluded.tasks_db_id,
      requests_db_id = excluded.requests_db_id,
      documents_db_id = excluded.documents_db_id,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    userId,
    config.notionApiKey || '',
    config.parentPageId || '',
    config.runLogDbId || '',
    config.invoicesDbId || '',
    config.tasksDbId || '',
    config.requestsDbId || '',
    config.documentsDbId || '',
    now
  );
}

function getNotionConfig(userId) {
  const stmt = db.prepare('SELECT * FROM notion_configs WHERE user_id = ?');
  return stmt.get(userId) || null;
}

/**
 * Appends an audit event to SQLite
 */
function logAuditEvent({ userId = null, flow, action, status, summary }) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO audit_events (user_id, flow, action, status, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(userId, flow || 'general', action || 'execute', status || 'success', summary || '', now);
}

module.exports = {
  db,
  upsertUser,
  getUserById,
  getUserByEmail,
  createSession,
  getSession,
  deleteSession,
  saveNotionConfig,
  getNotionConfig,
  logAuditEvent
};
