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
 * Structure & Categorize Inbound Email
 */
async function structureEmail({ sender, subject = '', body = '' }) {
  const prompt = `
Analyze the incoming email below. Categorize it, prioritize it, summarize it, and generate a professional draft reply.
If it is spam, promotion, or bot noise, set "isNoise": true.

Sender: ${sender}
Subject: ${subject}
Body:
"""
${body}
"""

Respond with a JSON object strictly matching this schema:
{
  "isNoise": boolean,
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
 * Structure & Categorize Inbound WhatsApp Message (Supports Multilingual & Hinglish)
 */
async function structureWhatsApp({ sender, body = '' }) {
  const prompt = `
Analyze the incoming WhatsApp message below. It may be written in English, Hindi, Hinglish (e.g. "bhai sunday ko 4 baje meeting rakh le"), or other languages.
1. Understand the true intent (e.g., scheduling a meeting, asking for an invoice, seeking support, or general chat).
2. Extract the key request into a clean, professional English title and summary.
3. If it is a meeting request, set category to "Meeting", extract the proposed time/day into the summary, and draft a friendly, enthusiastic confirmation response (e.g., "Yeah, let's schedule! I have noted the meeting for [time/day]. See you then!").
4. If it is trivial chatter ("ok", "k", spam), set "isNoise": true.

Sender: ${sender}
Message:
"""
${body}
"""

Respond with a JSON object strictly matching this schema:
{
  "isNoise": boolean,
  "title": "Short descriptive title in English (max 8 words)",
  "category": "Meeting" | "Support" | "Billing" | "General" | "Urgent",
  "priority": "Low" | "Medium" | "High",
  "summary": "1-2 sentence clear summary in English explaining what the sender requested",
  "draftResponse": "Natural, friendly draft response (e.g., 'Yeah, let's schedule for Sunday at 4:00 PM!')"
}
`;

  try {
    const result = await callOpenRouter(prompt);
    return result;
  } catch (err) {
    console.warn('⚠️ OpenRouter unavailable, using heuristic fallback:', err.message);
    return heuristicFallback({ sender, subject: '', body, source: 'whatsapp' });
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
 * Robust Heuristic Fallback Engine (Zero crashes when offline / rate-limited)
 */
function heuristicFallback({ sender, subject = '', body = '', source = 'email' }) {
  const text = `${subject} ${body}`.toLowerCase();
  
  // Priority detection
  let priority = 'Medium';
  if (text.match(/\b(urgent|asap|emergency|immediately|deadline|critical|blocked|jaldi|turant)\b/i)) {
    priority = 'High';
  } else if (text.match(/\b(fyi|newsletter|update|subscription|low priority)\b/i)) {
    priority = 'Low';
  }

  // Category detection (English + Hindi + Hinglish)
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

  const isNoise = body.trim().length < 3 && !subject;
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
  structureTranscript
};

