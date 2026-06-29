const logger = require('../utils/logger');
const SystemConfig = require('../models/SystemConfig');

/* ─── API Configuration ─────────────────────────────────── */
let currentKaggleUrl = '';

// Load Kaggle URL on startup (runs asynchronously in background after import)
const initKaggleUrl = async () => {
  try {
    const config = await SystemConfig.findOne({ key: 'KAGGLE_API_URL' });
    if (config && config.value) {
      currentKaggleUrl = config.value.trim().replace(/\/+$/, '');
      logger.info(`Loaded Kaggle API URL from MongoDB: ${currentKaggleUrl}`);
    } else {
      currentKaggleUrl = process.env.KAGGLE_API_URL
        ? process.env.KAGGLE_API_URL.trim().replace(/\/+$/, '')
        : '';
      logger.info(`Loaded Kaggle API URL from env: ${currentKaggleUrl}`);
    }
  } catch (error) {
    logger.error(`Error initializing Kaggle URL: ${error.message}`);
    currentKaggleUrl = process.env.KAGGLE_API_URL
      ? process.env.KAGGLE_API_URL.trim().replace(/\/+$/, '')
      : '';
  }
};

initKaggleUrl();

function getKaggleBaseUrl() {
  return currentKaggleUrl;
}

function setKaggleBaseUrl(url) {
  currentKaggleUrl = url ? url.trim().replace(/\/+$/, '') : '';
}

/**
 * Pings the /health endpoint of the Kaggle FastAPI server
 * to check connection status.
 */
async function checkKaggleStatus() {
  const url = getKaggleBaseUrl();
  if (!url) {
    return { status: 'offline', error: 'Kaggle URL is not configured.' };
  }
  try {
    const res = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      return { status: 'online', url, model: data.model || 'Gemma 3' };
    }
    return { status: 'offline', url, error: `HTTP Status ${res.status}` };
  } catch (error) {
    return { status: 'offline', url, error: error.message };
  }
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Bypass-Tunnel-Reminder': 'true',
};

const TIMEOUT_MS = 60000;

/* ─── Safe JSON Parser ────────────────────────────────────
 *  LLMs often wrap JSON in markdown ```json ... ``` blocks
 *  or prefix/suffix with stray text. This utility extracts
 *  the first JSON object or array from a string and parses it.
 */
function safeParseJSON(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error(`safeParseJSON: input is not a string — got ${typeof raw}`);
  }

  let cleaned = raw.trim();

  // Strip markdown code fences (```json, ```, etc.)
  cleaned = cleaned.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();

  // If the string doesn't start with { or [, try to find the first JSON
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error(
      `safeParseJSON: no JSON object or array found in response.\nRaw text (first 500 chars):\n${raw.slice(0, 500)}`
    );
  }

  const jsonStart = firstBracket === -1 ? firstBrace
    : firstBrace === -1 ? firstBracket
    : Math.min(firstBrace, firstBracket);

  // Find the matching closing bracket
  let depth = 0;
  let inString = false;
  let escape = false;
  let jsonEnd = -1;
  const startChar = cleaned[jsonStart];
  const endChar = startChar === '{' ? '}' : ']';

  for (let i = jsonStart; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === startChar) depth++;
    if (ch === endChar) depth--;
    if (depth === 0) { jsonEnd = i + 1; break; }
  }

  if (jsonEnd === -1) {
    throw new Error(
      `safeParseJSON: unbalanced braces in response.\nRaw text (first 500 chars):\n${raw.slice(0, 500)}`
    );
  }

  const jsonStr = cleaned.slice(jsonStart, jsonEnd);

  try {
    return JSON.parse(jsonStr);
  } catch (parseErr) {
    throw new Error(
      `safeParseJSON: JSON.parse failed at character position ${jsonStart}–${jsonEnd}.\n` +
      `Parse error: ${parseErr.message}\n` +
      `Extracted JSON string:\n${jsonStr.slice(0, 1000)}\n` +
      `Full raw text (first 800 chars):\n${raw.slice(0, 800)}`
    );
  }
}

/* ─── Common fetch helper ───────────────────────────────── */
async function callKaggle(endpoint, payload) {
  const kaggleUrl = getKaggleBaseUrl();
  const base = kaggleUrl
    ? new URL(endpoint, kaggleUrl).href
    : endpoint;

  console.log('═══════════════════════════════════════════════════');
  console.log('[kaggleService] >>> Sending request to Kaggle API');
  console.log(`  URL:    ${base}`);
  console.log(`  Method: POST`);
  console.log(`  Headers: ${JSON.stringify(HEADERS)}`);
  console.log(`  Payload: ${JSON.stringify(payload, null, 2)}`);
  console.log('═══════════════════════════════════════════════════');

  const response = await fetch(base, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  console.log(`[kaggleService] <<< Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const text = await response.text();
    console.error(`[kaggleService] Response body (first 500 chars): ${text.slice(0, 500)}`);
    throw new Error(`Kaggle API error! status: ${response.status} — ${response.statusText}`);
  }

  const result = await response.json();
  console.log(`[kaggleService] Response JSON: ${JSON.stringify(result, null, 2)}`);

  return result;
}

/* ─── Category sequence for question flow ─────────────────
 *   - First question (i === 0)         → "intro"
 *   - Last question  (i === count - 1) → "outro"
 *   - Middle questions                 → alternate between
 *     "conceptual", "situational", "behavioral"
 */
const CATEGORY_CYCLE = ['conceptual', 'situational', 'behavioral'];

function getCategoryForIndex(i, count) {
  if (i === 0) return 'intro';
  if (i === count - 1) return 'outro';
  return CATEGORY_CYCLE[(i - 1) % CATEGORY_CYCLE.length];
}

/* ─── Generate Interview Questions ────────────────────────
 *   Endpoint: /generate-question (called multiple times for multiple questions)
 *   Payload:  { language, domain, role, category }
 */
const generateInterviewQuestions = async (type, domain, difficulty, count = 1, context = {}) => {
  const { jobRole, language, candidateName, jobDescription, resumeText, focusSkills, roleProfile } = context;
  const questions = [];

  // Build a concise skill list from all available sources
  const skillHints = [];
  if (roleProfile?.requiredSkills?.length) skillHints.push(...roleProfile.requiredSkills);
  if (roleProfile?.preferredSkills?.length) skillHints.push(...roleProfile.preferredSkills);
  if (roleProfile?.technicalStack?.length) skillHints.push(...roleProfile.technicalStack);
  if (focusSkills?.length) skillHints.push(...focusSkills);
  // Deduplicate
  const uniqueSkills = [...new Set(skillHints.map(s => s.toLowerCase()))].slice(0, 10);

  console.log(`\n[kaggleService] 🎯 Fetching ${count} interview questions...`);
  if (uniqueSkills.length) console.log(`[kaggleService] 📋 Focus skills: ${uniqueSkills.join(', ')}`);

  // Generate questions one by one with appropriate categories
  for (let i = 0; i < count; i++) {
    // Determine category based on position
    let category;
    if (i === 0) {
      category = 'intro'; // First question
    } else if (i === count - 1) {
      category = 'outro'; // Last question
    } else {
      let CATEGORY_CYCLE;
      const lowerType = (type || 'mixed').toLowerCase();
      
      if (lowerType === 'hr') {
        CATEGORY_CYCLE = ['motivation', 'strengths/weaknesses', 'culture fit', 'experience'];
      } else if (lowerType === 'technical') {
        CATEGORY_CYCLE = ['core skills', 'scenario tasks', 'debugging', 'fundamentals'];
      } else if (lowerType === 'behavioral') {
        CATEGORY_CYCLE = ['STAR-based situation', 'past experience', 'problem solving'];
      } else {
        // Mixed type
        CATEGORY_CYCLE = ['conceptual', 'situational', 'behavioral', 'technical'];
      }
      
      category = CATEGORY_CYCLE[(i - 1) % CATEGORY_CYCLE.length];
    }

    const payload = {
      language: language || 'english',
      domain: domain || 'general',
      role: jobRole || 'candidate',
      candidateName: candidateName || 'Candidate',
      category: category,
      type: type || 'technical',
      skills: uniqueSkills,
      responsibilities: roleProfile?.responsibilities || [],
      experience: roleProfile?.experienceLevel || '',
      jobDescription: (resumeText ? `[Candidate Resume]:\n${resumeText.slice(0, 1000)}\n\n` : '') + 
                      (jobDescription ? `[Job Description]:\n${jobDescription.slice(0, 800)}` : ''),
    };

    const result = await callKaggle('/generate-question', payload);
    const qText = result.question || result.text || '';

    if (qText) {
      questions.push({
        text: qText,
        category: category,
        difficulty: difficulty || 'medium',
        expectedAnswer: result.expectedAnswer || result.expected_answer || result.answer || '',
        order: i,
      });
    }
  }

  logger.info(`Generated ${questions.length} questions for ${type}/${domain}/${difficulty}`);
  return questions;
};

/* ─── Process Interview Turn (Dynamic Chat) ────────────────
 *   Endpoint: /interview-turn
 *   Payload:  { conversationHistory, domain, role, language }
 *   Response: { evaluation: {score, feedback, ...}, nextInterviewerResponse, isFollowUp }
 */
const processInterviewTurn = async (
  conversationHistory,
  domain = 'general',
  role = 'candidate',
  language = 'english',
  type = 'technical'
) => {
  const payload = {
    conversationHistory,
    domain,
    role,
    language,
    type,
  };

  const result = await callKaggle('/interview-turn', payload);
  logger.info(`Turn processed — Next response: "${result.nextInterviewerResponse?.slice(0, 50)}..."`);
  return result;
};

/* ─── Evaluate a Single Answer (Legacy - kept for retry/fallback) ────────── */
const evaluateAnswer = async (
  questionText,
  expectedAnswer,
  userAnswer,
  domain = 'general',
  role = 'candidate',
  language = 'english'
) => {
  const payload = {
    question: questionText,
    candidate_answer: userAnswer,
    expected_answer: expectedAnswer,
    domain,
    role,
    language,
    instruction:
      'OUTPUT STRICTLY AS RAW JSON. Do not use markdown formatting. Do not wrap in ```json blocks. ' +
      'Return ONLY a JSON object with keys: score (0-100), feedback (string), ' +
      'strengths (array of strings), improvements (array of strings), suggestedAnswer (string).',
  };

  const result = await callKaggle('/evaluate', payload);

  let parsed;

  if (result.score !== undefined) {
    parsed = result;
  } else if (result.evaluation && typeof result.evaluation === 'string') {
    parsed = safeParseJSON(result.evaluation);
  } else if (result.evaluation && typeof result.evaluation === 'object') {
    parsed = result.evaluation;
  } else {
    try {
      parsed = safeParseJSON(JSON.stringify(result));
    } catch {
      throw new Error(`Unexpected evaluation response format.`);
    }
  }

  logger.info(`Answer evaluated — score: ${parsed.score}`);
  return parsed;
};

/* ─── Parse Job Description ───────────────────────────────
 *   Endpoint: /parse
 *   Payload:  { job_description, role }
 *   Response: expects { evaluation: "..." } or direct JSON
 */
const parseJobDescription = async (jobDescription, jobRole) => {
  const payload = {
    job_description: jobDescription,
    role: jobRole,
  };

  const result = await callKaggle('/parse', payload);

  let data = result.parsed || result.data || result;

  if (result.evaluation && typeof result.evaluation === 'string') {
    data = safeParseJSON(result.evaluation);
  }

  logger.info(`Job description parsed for "${jobRole}" — ${data.requiredSkills?.length || 0} skills extracted`);
  return data;
};

/* ─── Generate Comprehensive Feedback ─────────────────────
 *   Endpoint: /feedback
 */
const generateComprehensiveFeedback = async (interviewData) => {
  const payload = {
    interview_data: interviewData,
  };

  const result = await callKaggle('/feedback', payload);

  let feedback = result.feedback || result.data || result;

  if (result.evaluation && typeof result.evaluation === 'string') {
    feedback = safeParseJSON(result.evaluation);
  }

  logger.info(`Comprehensive feedback generated — overall score: ${feedback.overallScore}`);
  return feedback;
};

/* ─── Audio Transcription (stub — not supported) ─────────── */
const transcribeAudio = async () => {
  logger.warn('Audio transcription is not available — use browser Web Speech API instead');
  throw new Error('Audio transcription is not available. The frontend uses browser-native Speech Recognition for STT.');
};

module.exports = {
  parseJobDescription,
  generateInterviewQuestions,
  evaluateAnswer,
  processInterviewTurn,
  generateComprehensiveFeedback,
  transcribeAudio,
  getKaggleBaseUrl,
  setKaggleBaseUrl,
  checkKaggleStatus,
};
