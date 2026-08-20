const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

async function createSickLeaveApplication(applicantName = 'Lovekesh Anand') {
  console.log(`🔍 Connecting to Notion to create Sick Leave Application for "${applicantName}"...`);

  try {
    // 1. Search for accessible parent pages
    const searchRes = await notion.search({
      filter: { value: 'page', property: 'object' }
    });

    if (searchRes.results.length === 0) {
      console.log('\n⚠️ No accessible parent page found in your Notion workspace.');
      console.log('👉 To grant access to Notion:');
      console.log('   1. Open any page in your Notion workspace.');
      console.log('   2. Click the top-right "..." menu -> Connections -> Add Connection -> select "Kairos".');
      console.log('   3. Run this script again!\n');
      return { success: false, reason: 'No shared page found' };
    }

    const parentPage = searchRes.results[0];
    const parentTitle = parentPage.properties?.title?.title?.[0]?.plain_text || 'Workspace Root';
    console.log(`📌 Found accessible parent page: "${parentTitle}" (${parentPage.id})`);

    // 2. Create the Sick Leave Application Page
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const newPage = await notion.pages.create({
      parent: { page_id: parentPage.id },
      icon: {
        type: 'emoji',
        emoji: '🏥'
      },
      cover: {
        type: 'external',
        url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80'
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: `🏥 Sick Leave Application — ${applicantName}`
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
            rich_text: [{ text: { content: 'Sick Leave Application' } }]
          }
        },
        {
          object: 'block',
          type: 'callout',
          callout: {
            icon: { type: 'emoji', emoji: 'ℹ️' },
            rich_text: [
              {
                text: {
                  content: `Submitted by: ${applicantName} | Date: ${today} | Status: Pending Approval`
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'divider',
          divider: {}
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ text: { content: 'Leave Details' } }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { text: { content: 'Dear Operations / Management Team,\n\n' } },
              {
                text: {
                  content: `I am writing to formally request sick leave as I am feeling unwell and unable to perform my duties today. I will keep the team updated regarding my recovery and resume work as soon as I am feeling better.\n\n`
                }
              },
              { text: { content: 'Please let me know if any urgent tasks need immediate handover.' } }
            ]
          }
        },
        {
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: [
              {
                text: {
                  content: `Applicant: ${applicantName}\nApplication Type: Sick Leave\nGenerated via: Kairos Autonomous Engine`
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ text: { content: 'Approval Checklist' } }]
          }
        },
        {
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ text: { content: 'Review medical notice / application' } }],
            checked: false
          }
        },
        {
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ text: { content: 'Acknowledge and mark attendance' } }],
            checked: false
          }
        }
      ]
    });

    console.log(`\n🎉 Page successfully created in Notion!`);
    console.log(`🔗 Page URL: ${newPage.url}`);
    return { success: true, pageId: newPage.id, url: newPage.url };

  } catch (error) {
    console.error('❌ Error creating Notion page:', error.message);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  const nameArg = process.argv.slice(2).join(' ') || 'Lovekesh Anand';
  createSickLeaveApplication(nameArg);
}

module.exports = { createSickLeaveApplication };
