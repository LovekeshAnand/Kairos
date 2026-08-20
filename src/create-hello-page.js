const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

async function main() {
  console.log('🔍 Searching for accessible pages in your Notion workspace...');

  try {
    const searchRes = await notion.search({
      filter: { value: 'page', property: 'object' }
    });

    if (searchRes.results.length === 0) {
      console.log('\n⚠️ No accessible pages found yet.');
      console.log('👉 Quick fix:');
      console.log('   1. Open Notion in your browser.');
      console.log('   2. Go to any page (or create a new page).');
      console.log('   3. Click the top-right "..." menu -> Connections -> Add Connection -> select "Kairos".');
      return;
    }

    const parentPage = searchRes.results[0];
    const parentTitle = parentPage.properties?.title?.title?.[0]?.plain_text || 'Workspace';
    console.log(`📌 Found accessible parent page: "${parentTitle}" (ID: ${parentPage.id})`);

    console.log('✨ Creating new page with "Hello"...');
    const newPage = await notion.pages.create({
      parent: { page_id: parentPage.id },
      icon: {
        type: 'emoji',
        emoji: '👋'
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: '👋 Hello from Kairos!'
              }
            }
          ]
        }
      },
      children: [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ text: { content: 'Hello World!' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                text: {
                  content: 'Hello! This page was created automatically by your Kairos Autonomous Engine integration.'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'callout',
          callout: {
            icon: { type: 'emoji', emoji: '🚀' },
            rich_text: [
              {
                text: {
                  content: 'Your Notion integration is working perfectly! All webhooks and operations can now read and write directly here.'
                }
              }
            ]
          }
        }
      ]
    });

    console.log(`\n🎉 Page successfully created in Notion!`);
    console.log(`🔗 URL: ${newPage.url}`);

  } catch (error) {
    console.error('❌ Error creating Notion page:', error.message);
  }
}

main();
