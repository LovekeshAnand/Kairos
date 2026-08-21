const axios = require('axios');
require('dotenv').config();

const OPENROUTER_KEYS = [
  process.env.OPENROUTER_API_KEY,
  process.env.OPENROUTER_API_KEY_TWO,
  process.env.OPENROUTER_API_KEY_THREE,
  process.env.OPENROUTER_API_KEY_FOUR
].filter(Boolean);

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

/**
 * Calls OpenRouter with automatic failover across all configured API keys
 */
async function callOpenRouter(prompt, systemInstruction = 'You are a strict JSON extraction engine. Respond ONLY with valid JSON, no preamble, no markdown fences.') {
  if (OPENROUTER_KEYS.length === 0) {
    throw new Error('No OpenRouter API keys configured in .env');
  }

  let lastError = null;

  for (let i = 0; i < OPENROUTER_KEYS.length; i++) {
    const apiKey = OPENROUTER_KEYS[i];
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/LovekeshAnand/Kairos',
            'X-Title': 'Kairos Automation'
          },
          timeout: 20000
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response content from OpenRouter');
      }

      return cleanAndParseJSON(content);
    } catch (err) {
      console.warn(`⚠️ OpenRouter Key [${i + 1}/${OPENROUTER_KEYS.length}] failed: ${err.message}. Trying next key...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All OpenRouter API keys failed.');
}

/**
 * Defensive JSON cleaner and parser to prevent pipeline crashes
 */
function cleanAndParseJSON(rawText) {
  if (typeof rawText === 'object' && rawText !== null) {
    return rawText;
  }

  try {
    // Remove markdown code fences ```json ... ``` or ``` ... ```
    let cleaned = String(rawText).trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    
    // Find the first '{' or '[' and last '}' or ']'
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = 0;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    let endIdx = cleaned.length;
    if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) {
      endIdx = lastBrace + 1;
    } else if (lastBracket !== -1) {
      endIdx = lastBracket + 1;
    }

    cleaned = cleaned.slice(startIdx, endIdx);
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('❌ Failed to parse AI JSON response:', err.message, '\nRaw was:', rawText);
    return {
      error: 'unparseable_ai_response',
      raw: String(rawText),
      isNoise: false,
      title: 'Unparseable Request - Needs Review',
      category: 'General',
      priority: 'Medium',
      summary: 'Message requires manual review due to unexpected formatting.',
      draftResponse: 'Hello, thank you for reaching out. We have received your message and will review it shortly.'
    };
  }
}

/**
 * Structure & Categorize Inbound Email with Spam / Newsletter Filter
 */
async function structureEmail({ sender, subject = '', body = '' }) {
  const prompt = `
Analyze the incoming email below.
1. Determine if this email is promotional marketing, a newsletter, automated digest (e.g. NYTimes, job boards, alerts), or spam. If so, set "isNoise": true with a clear "noiseReason".
2. If it is an authentic business, client, or actionable email, categorize it, determine priority, generate a clear 1-sentence English summary, and write a professional draft reply.

Sender: ${sender}
Subject: ${subject}
Body:
"""
${body.slice(0, 3000)}
"""

Respond with a JSON object strictly matching this schema:
{
  "isNoise": boolean,
  "noiseReason": "marketing_newsletter" | "automated_digest" | "trivial_spam" | "none",
  "title": "Short descriptive title (max 10 words)",
  "category": "Support" | "Billing" | "Meeting" | "General" | "Urgent",
  "priority": "Low" | "Medium" | "High",
  "summary": "1-2 sentence human readable summary",
  "draftResponse": "Polished, courteous draft reply ready for human approval"
}
`;

  try {
    const result = await callOpenRouter(prompt);
    return result;
  } catch (err) {
    console.warn('⚠️ OpenRouter unavailable, using heuristic fallback:', err.message);
    return heuristicFallback({ sender, subject, body, source: 'email' });
  }
}

/**
 * Structure & Categorize Inbound WhatsApp Message (Supports Groups, LIDs, Hinglish & Actionable Staging)
 */
async function structureWhatsApp({ sender, body = '', isGroup = false }) {
  const prompt = `
Analyze the incoming WhatsApp message below. It comes from a ${isGroup ? 'GROUP CHAT' : 'DIRECT 1-ON-1 CHAT'}.
1. NOISE RULES:
   - For DIRECT 1-ON-1 CHAT: ALWAYS set "isNoise": false! Every direct incoming message from a contact is an actionable interaction that needs a courteous, friendly draft reply.
   - For GROUP CHAT: Casual gaming chatter ("counter strike", "game hai", "lol", "hahaha", "@all") with zero questions/tasks can be marked "isNoise": true. Otherwise, set "isNoise": false.
2. If it is a meeting request, set category to "Meeting". If billing/invoice, set "Billing". If support/question, set "Support". Otherwise, set "General".
3. Write a polished, contextual, and helpful draft response ready for human approval.

Sender: ${sender}
Chat Type: ${isGroup ? 'Group Conversation' : 'Direct Message'}
Message Content:
"""
${body}
"""

Respond with a JSON object strictly matching this schema:
{
  "isNoise": boolean,
  "noiseReason": "group_casual_chatter" | "none",
  "title": "Short descriptive title in English (max 8 words)",
  "category": "Meeting" | "Support" | "Billing" | "General" | "Urgent",
  "priority": "Low" | "Medium" | "High",
  "summary": "1-2 sentence clear summary in English explaining what the sender requested",
  "draftResponse": "Natural, friendly draft response"
}
`;

  try {
    const result = await callOpenRouter(prompt);
    return result;
  } catch (err) {
    console.warn('⚠️ OpenRouter unavailable, using heuristic fallback:', err.message);
    return heuristicFallback({ sender, subject: '', body, source: 'whatsapp', isGroup });
  }
}

/**
 * Extract Action Items & Tasks from Google Meet Transcript
 */
async function structureTranscript(transcriptText, meetingTitle = 'Google Meet Discussion') {
  const prompt = `
You are an executive assistant. Extract discrete, concrete action items from this meeting transcript.
CRITICAL RULE: If no clear action items exist, return an empty array [] — NEVER invent or hallucinate tasks.

Meeting Title: ${meetingTitle}
Transcript:
"""
${transcriptText}
"""

Respond with a JSON object strictly matching this schema:
{
  "meetingSummary": "2-3 sentence overview of the meeting",
  "tasks": [
    {
      "task": "Specific actionable task title",
      "owner": "Person name or Unassigned",
      "dueDate": "YYYY-MM-DD or null if not mentioned",
      "reasoning": "Brief explanation of why this task was assigned based on transcript dialogue"
    }
  ]
}
`;

  try {
    const result = await callOpenRouter(prompt);
    if (!result.tasks || !Array.isArray(result.tasks)) {
      result.tasks = [];
    }
    return result;
  } catch (err) {
    console.warn('⚠️ OpenRouter unavailable for transcript, using fallback:', err.message);
    return {
      meetingSummary: 'Meeting transcript received and staged.',
      tasks: [
        {
          task: 'Review meeting transcript and assign pending items',
          owner: 'Unassigned',
          dueDate: null,
          reasoning: 'Automated fallback task for transcript review.'
        }
      ]
    };
  }
}

/**
 * Robust Heuristic Fallback Engine with Intelligent Noise & Spam Filter
 */
function heuristicFallback({ sender, subject = '', body = '', source = 'email', isGroup = false }) {
  const text = `${subject} ${body}`.toLowerCase().trim();
  
  // 1. Group Casual Chatter & Trivial Message Detection
  // Note: For direct 1-on-1 WhatsApp chats and normal group queries, messages are staged into Requests DB.
  const isTrivialAck = isGroup && text.match(/^(ok|k|okay|thanks|thx|cool|alright|nice|done|got it|haha|hahaha|lol|lmao|xd|👍|🙏|❤️|🔥|@all|@everyone)$/i);
  const isCasualGroupTalk = isGroup && text.match(/\b(counter strike|csgo|game hai|khelte|khel|sweating|bro ppt|kinda motivated)\b/i);

  // Check if sender is an automated notification service, newsletter, or platform digest
  const isAutomatedService = source === 'email' && sender.match(/(noreply|no-reply|notifications|invitations|welcome|digest|news|newsletter|updates|alerts|editorpicks|support@.*\.com|hello@students|@medium\.com|@substack\.com|@devpost\.com|@spotify\.com|@linkedin\.com|@unstop\.news|@nytimes\.com|@accounts\.google\.com|@google\.com)/i);

  const isPromoOrDigestText = source === 'email' && text.match(/\b(unsubscribe|view this email in your browser|daily digest|weekly digest|job alert|invitation to connect|hackathon|special offer|promotions|deals|privacy policy|terms of service)\b/i);

  const isActionablePersonal = !isAutomatedService && text.match(/\b(invoice|bill|payment|document|doc|pdf|receipt|contract|proposal|salary|help|request|send|meet|meeting|schedule|call|project|task|please|hi|hello|hey)\b/i);

  let isNoise = false;
  let noiseReason = 'none';

  if (isTrivialAck) {
    isNoise = true;
    noiseReason = 'trivial_acknowledgment';
  } else if (isCasualGroupTalk) {
    isNoise = true;
    noiseReason = 'group_casual_chatter';
  } else if (source === 'email' && (isAutomatedService || isPromoOrDigestText) && !isActionablePersonal) {
    isNoise = true;
    noiseReason = isAutomatedService ? 'automated_digest' : 'marketing_promotion';
  }

  // 2. Priority detection
  let priority = 'Medium';
  if (text.match(/\b(urgent|asap|emergency|immediately|deadline|critical|blocked|jaldi|turant)\b/i)) {
    priority = 'High';
  } else if (text.match(/\b(fyi|newsletter|update|subscription|low priority)\b/i)) {
    priority = 'Low';
  }

  // 3. Category detection (English + Hindi + Hinglish)
  let category = 'General';
  let isMeeting = false;
  
  if (text.match(/\b(meeting|call|sync|schedule|calendar|discuss|baje|rakh|rakhte|milte|milon|baat|sham|subah|sunday|monday|tuesday|wednesday|thursday|friday|saturday|kal|parso|pm|am)\b/i)) {
    category = 'Meeting';
    isMeeting = true;
  } else if (text.match(/\b(invoice|bill|payment|fee|receipt|refund|cost|paise|rupaye)\b/i)) {
    category = 'Billing';
  } else if (text.match(/\b(help|issue|bug|error|problem|support|broken|madad|dikkat)\b/i)) {
    category = 'Support';
  }

  let title = subject || `${source === 'email' ? 'Email' : 'WhatsApp'} from ${sender}`;
  if (isMeeting) {
    title = `Meeting Request: "${body.slice(0, 35)}..."`;
  }

  let draftResponse = `Hi,\n\nThank you for reaching out. We have received your message and are reviewing it.\n\nBest regards,\nOperations Team`;
  if (isMeeting) {
    draftResponse = `Yeah, let's schedule! I have noted this and added it to our calendar. Looking forward to connecting.`;
  }

  return {
    isNoise,
    noiseReason,
    title: title.slice(0, 60),
    category,
    priority,
    summary: `Inbound ${source} message received from ${sender}: "${(body || subject).slice(0, 100)}".`,
    draftResponse
  };
}

module.exports = {
  callOpenRouter,
  structureEmail,
  structureWhatsApp,
  structureTranscript,
  heuristicFallback
};


