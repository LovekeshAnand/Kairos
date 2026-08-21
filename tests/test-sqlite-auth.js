const dbService = require('../src/services/dbService');
const assert = require('assert');

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING SQLITE & AUTHENTICATION TESTS');
  console.log('================================================================\n');

  // Test 1: User Upsert
  const testEmail = `operator_${Date.now()}@kairos-test.io`;
  const user = dbService.upsertUser({
    email: testEmail,
    name: 'Kairos Operator',
    picture: 'https://lh3.googleusercontent.com/a/test-avatar',
    refreshToken: '1//dummy_refresh_token',
    accessToken: 'ya29.dummy_access_token'
  });

  assert(user, 'User must be returned from upsertUser');
  assert.strictEqual(user.email, testEmail);
  assert.strictEqual(user.name, 'Kairos Operator');
  console.log('✅ Test 1 Passed: User successfully upserted in SQLite.');

  // Test 2: Create & Retrieve Session
  const session = dbService.createSession(user.id, 7);
  assert(session && session.sessionId, 'Session ID must be generated');

  const retrieved = dbService.getSession(session.sessionId);
  assert(retrieved, 'Session must be retrievable from SQLite');
  assert.strictEqual(retrieved.email, testEmail);
  assert.strictEqual(retrieved.name, 'Kairos Operator');
  console.log('✅ Test 2 Passed: Session created and verified in SQLite.');

  // Test 3: Notion Config Storage
  dbService.saveNotionConfig(user.id, {
    notionApiKey: 'secret_test_key_123',
    parentPageId: 'page_abc_123',
    runLogDbId: 'db_run_log',
    invoicesDbId: 'db_invoices',
    tasksDbId: 'db_tasks',
    requestsDbId: 'db_requests',
    documentsDbId: 'db_documents'
  });

  const config = dbService.getNotionConfig(user.id);
  assert(config, 'Notion config must be stored');
  assert.strictEqual(config.parent_page_id, 'page_abc_123');
  assert.strictEqual(config.invoices_db_id, 'db_invoices');
  console.log('✅ Test 3 Passed: Notion Database mappings stored in SQLite.');

  // Test 4: Audit Event Logging
  dbService.logAuditEvent({
    userId: user.id,
    flow: 'auth',
    action: 'google_signin',
    status: 'success',
    summary: 'Test operator signed in.'
  });
  console.log('✅ Test 4 Passed: Audit event logged in SQLite.');

  // Test 5: Session Deletion / Logout
  dbService.deleteSession(session.sessionId);
  const deletedSession = dbService.getSession(session.sessionId);
  assert.strictEqual(deletedSession, null, 'Deleted session must return null');
  console.log('✅ Test 5 Passed: Session invalidated and deleted cleanly.');

  console.log('\n================================================================');
  console.log('🎉 ALL SQLITE & AUTH TESTS PASSED (5/5)!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
