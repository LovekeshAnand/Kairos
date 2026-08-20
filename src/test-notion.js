const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

async function main() {
  console.log('🔍 Testing Notion connection with token...');
  try {
    const user = await notion.users.me({});
    console.log('✅ Successfully authenticated as bot/user:', user.name || user.id);

    console.log('\n🔍 Searching for accessible pages and databases...');
    const searchRes = await notion.search({});
    console.log(`Found ${searchRes.results.length} accessible items in workspace.`);

    const databases = searchRes.results.filter(r => r.object === 'database');
    const pages = searchRes.results.filter(r => r.object === 'page');

    console.log(`\n📋 Databases (${databases.length}):`);
    databases.forEach(db => {
      const title = db.title?.[0]?.plain_text || '(Untitled Database)';
      console.log(`  - [Database] "${title}" | ID: ${db.id}`);
    });

    console.log(`\n📄 Pages (${pages.length}):`);
    pages.forEach(pg => {
      const title = pg.properties?.title?.title?.[0]?.plain_text || '(Untitled Page)';
      console.log(`  - [Page] "${title}" | ID: ${pg.id}`);
    });

  } catch (error) {
    console.error('❌ Notion API Error:', error.message);
  }
}

main();
