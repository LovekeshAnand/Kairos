const axios = require('axios');
require('dotenv').config();

/**
 * AI Service for intent recognition, priority scoring, summarization, and draft generation.
 * Supports Gemini API if configured, with an intelligent built-in heuristic NLP engine as resilient fallback.
 */
async function processMessageWithAI({ sender, subject = '', body = '', source = 'Gmail' }) {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (geminiApiKey) {
    try {
      return await callGeminiAPI({ sender, subject, body, source, apiKey: geminiApiKey });
    } catch (err) {
      console.warn('⚠️ Gemini API call failed, falling back to heuristic engine:', err.message);
    }
  }

  // Resilient Heuristic Engine
  return analyzeWithHeuristics({ sender, subject, body, source });
}

/**
 * Analyzes messages via Google Gemini API
 */
async function callGeminiAPI({ sender, subject, body, source, apiKey }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const prompt = `
You are an autonomous operations assistant for a busy organization.
Analyze the following incoming ${source} message and return a JSON object ONLY.

Sender: ${sender}
Subject: ${subject}
Message Body:
"""
${body}
"""

Respond with a JSON object matching this schema:
{
  "title": "Short descriptive action title (max 10 words)",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "category": "Urgent" | "Inquiry" | "Billing" | "Support" | "Attendance" | "Follow-up" | "General",
  "summary": "1-2 sentence human-readable summary of what the sender needs and why",
  "draftResponse": "A polished, professional draft response addressing the request directly and politely",
  "requiresHumanApproval": true
}
`;

  const response = await axios.post(
    endpoint,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  return JSON.parse(text);
}

/**
 * Robust heuristic NLP engine to ensure zero crashes and instant offline/local execution
 */
function analyzeWithHeuristics({ sender, subject, body, source }) {
  const fullText = `${subject} ${body}`.toLowerCase();

  // Priority detection
  let priority = 'Medium';
  if (fullText.match(/\b(urgent|asap|emergency|critical|immediately|deadline today|payment failed|blocked)\b/i)) {
    priority = 'Critical';
  } else if (fullText.match(/\b(important|by tomorrow|attention|escalate|high priority|overdue)\b/i)) {
    priority = 'High';
  } else if (fullText.match(/\b(fyi|newsletter|update|subscription|low priority|whenever)\b/i)) {
    priority = 'Low';
  }

  // Category detection
  let category = 'General';
  if (fullText.match(/\b(invoice|bill|payment|fee|receipt|refund|cost|pricing|dues)\b/i)) {
    category = 'Billing';
  } else if (fullText.match(/\b(attendance|register|absent|leave|present|roll call|session)\b/i)) {
    category = 'Attendance';
  } else if (fullText.match(/\b(help|issue|bug|error|problem|support|broken|crash|ticket)\b/i)) {
    category = 'Support';
  } else if (fullText.match(/\b(follow up|status update|checking in|pending reply|status on)\b/i)) {
    category = 'Follow-up';
  } else if (fullText.match(/\b(how to|query|question|info|details|what is|when will|inquiry)\b/i)) {
    category = 'Inquiry';
  } else if (priority === 'Critical') {
    category = 'Urgent';
  }

  // Title generation
  let title = subject ? subject : `${source} message from ${sender.split('@')[0] || sender}`;
  if (title.length > 60) {
    title = title.slice(0, 57) + '...';
  }

  // Summary generation
  const cleanBody = body.replace(/\s+/g, ' ').trim();
  const summary = cleanBody.length > 0
    ? `${sender} sent a ${category.toLowerCase()} request regarding: "${cleanBody.slice(0, 140)}${cleanBody.length > 140 ? '...' : ''}"`
    : `Inbound ${source} message received from ${sender}.`;

  // Draft response generation
  let draftResponse = '';
  const senderName = sender.includes('@') ? sender.split('@')[0] : sender;

  if (category === 'Billing') {
    draftResponse = `Hello ${senderName},\n\nThank you for reaching out regarding your billing inquiry. We have received your details and our finance team is reviewing your invoice/receipt. We will update you shortly.\n\nBest regards,\nOperations Team`;
  } else if (category === 'Attendance') {
    draftResponse = `Hi ${senderName},\n\nYour attendance request/record has been received and verified against the log. If any further document is needed, we will notify you.\n\nBest regards,\nOperations Team`;
  } else if (category === 'Support') {
    draftResponse = `Hello ${senderName},\n\nWe have logged your support request. Our technical operations team has been notified and is currently investigating the issue. We will follow up with an update promptly.\n\nBest regards,\nSupport Desk`;
  } else {
    draftResponse = `Hi ${senderName},\n\nThank you for getting in touch. We have received your message regarding "${title}" and are processing it. We will get back to you with next steps as soon as possible.\n\nWarm regards,\nOperations Team`;
  }

  return {
    title,
    priority,
    category,
    summary,
    draftResponse,
    requiresHumanApproval: true
  };
}

module.exports = {
  processMessageWithAI
};
