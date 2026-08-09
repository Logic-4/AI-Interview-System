const logger = require('../utils/logger');
const SystemConfig = require('../models/SystemConfig');
const { isSimilarQuestionText } = require('../utils/questionHelpers');

/* ─── API Configuration ─────────────────────────────────── */
const currentGemmaUrl = (process.env.RUNPOD_API_URL || process.env.GEMMA_API_URL || '')
  .trim().replace(/\/+$/, '');

if (currentGemmaUrl) {
  logger.info(`Loaded Gemma API URL from env: ${currentGemmaUrl}`);
} else {
  logger.warn('Gemma API URL is not configured in environment variables.');
}

function getGemmaBaseUrl() {
  return currentGemmaUrl;
}

/**
 * Pings the /health endpoint of the Gemma RunPod serverless worker
 * to check connection status.
 */
async function checkGemmaStatus() {
  const url = getGemmaBaseUrl();
  if (!url) {
    return { status: 'offline', error: 'Gemma URL is not configured.' };
  }

  // RunPod Serverless: POST /runsync with /health (cold start may take minutes)
  if (isRunPodUrl(url)) {
    try {
      const base = getRunPodEndpointBase(url);
      const res = await fetch(`${base}/runsync`, {
        method: 'POST',
        headers: runPodHeaders(),
        body: JSON.stringify({ input: { endpoint: '/health', payload: {} } }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        const text = await res.text();
        return { status: 'offline', url, error: `RunPod HTTP ${res.status}: ${text.slice(0, 120)}` };
      }
      const data = await res.json();
      if (data.status === 'FAILED' || data.error) {
        return { status: 'offline', url, error: data.error || data.status };
      }
      const output = data.output || data;
      return {
        status: 'online',
        url,
        model: output.model || 'Gemma 3 (RunPod)',
        provider: 'runpod',
      };
    } catch (error) {
      return { status: 'offline', url, error: error.message };
    }
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

const HEADERS = () => {
  const headers = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  };
  const apiKey = process.env.GEMMA_API_KEY;
  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }
  return headers;
};

/** True when GEMMA_API_URL points at RunPod Serverless (api.runpod.ai/v2/...). */
function isRunPodUrl(url) {
  return typeof url === 'string' && /api\.runpod\.ai\/v2\//i.test(url);
}

function getRunPodApiKey() {
  return (process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_TOKEN || '').trim();
}

function runPodHeaders() {
  const key = getRunPodApiKey();
  if (!key) {
    throw new Error(
      'RUNPOD_API_KEY is required when GEMMA_API_URL is a RunPod Serverless endpoint.'
    );
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  };
}

/** Base URL without trailing slash, e.g. https://api.runpod.ai/v2/abc123 */
function getRunPodEndpointBase(url) {
  return url.replace(/\/+$/, '').replace(/\/(runsync|run|health|status)$/i, '');
}

const TIMEOUT_MS = Number(process.env.GEMMA_TIMEOUT_MS || 90000);
const MAX_RETRIES = Number(process.env.GEMMA_MAX_RETRIES || 1);
const RETRY_DELAY_MS = 1500;
const HISTORY_WINDOW = 8;
const IS_PROD = process.env.NODE_ENV === 'production';
const RUNPOD_POLL_MS = Number(process.env.RUNPOD_POLL_MS || 300);
const CIRCUIT_OPEN_MS = Number(process.env.GEMMA_CIRCUIT_OPEN_MS || 60000);

const circuit = { failures: 0, openUntil: 0, reason: '' };

function assertCircuitClosed() {
  if (circuit.openUntil > Date.now()) {
    const retryAfterMs = circuit.openUntil - Date.now();
    const error = new Error(`Gemma service circuit is open (${circuit.reason}); retry in ${Math.ceil(retryAfterMs / 1000)}s`);
    error.code = 'GEMMA_CIRCUIT_OPEN';
    error.retryAfterMs = retryAfterMs;
    throw error;
  }
}

function recordCircuitFailure(reason, immediate = false) {
  circuit.failures += 1;
  circuit.reason = reason;
  if (immediate || circuit.failures >= 3) {
    circuit.openUntil = Date.now() + CIRCUIT_OPEN_MS;
  }
}

function recordCircuitSuccess() {
  circuit.failures = 0;
  circuit.openUntil = 0;
  circuit.reason = '';
}

const PLACEHOLDER_ANSWER_RE = /^\[(No |Transcription)/i;

const DIFFICULTY_LABELS = { junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead' };
function toDifficultyLabel(difficulty) {
  return DIFFICULTY_LABELS[(difficulty || '').toLowerCase()] || 'Mid';
}

function clampScore(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isPlaceholderAnswer(text) {
  if (!text || !text.trim()) return true;
  return PLACEHOLDER_ANSWER_RE.test(text.trim());
}

function isValidGeneratedQuestion(text) {
  if (typeof text !== 'string') return false;
  const question = text.trim().replace(/\s+/g, ' ');
  if (question.length < 8 || question.length > 300 || !question.endsWith('?')) return false;

  return !/(return only valid json|expected answer|ideal answer|one field ["']?question|interview assessment)/i.test(question);
}

function isValidInterviewerResponse(text) {
  if (typeof text !== 'string') return false;
  const response = text.trim().replace(/\s+/g, ' ');
  if (response.length < 2 || response.length > 300) return false;
  return !/(return only valid json|expected answer|ideal answer|one field ["']?question|interview assessment)/i.test(response);
}

function isQuestionAboutTargetSkill(question, targetSkill) {
  if (!targetSkill) return true;
  return String(question).toLowerCase().includes(String(targetSkill).toLowerCase());
}

const FALLBACK_TEMPLATES_EN = [
  (s) => `How would you apply ${s} in a practical project?`,
  (s) => `What challenges have you faced working with ${s}?`,
  (s) => `Can you describe a real-world scenario where ${s} was critical to the outcome?`,
  (s) => `How do you stay current with best practices in ${s}?`,
  (s) => `Walk me through your approach to debugging an issue related to ${s}.`,
  (s) => `What trade-offs do you consider when using ${s}?`,
];
const FALLBACK_TEMPLATES_SO = [
  (s) => `Sidee ayaad ${s} ugu adeegsan lahayd mashruuc wax ku ool ah?`,
  (s) => `Caqabadaha ugu waaweyn ee aad la kulantay markaad la shaqeynaysay ${s} maxay ahaayeen?`,
  (s) => `Sharax xaalad dhabta ah oo ${s} ay door muhiim ah ku lahayd natiijooyinka?`,
  (s) => `Sidee ayaad ula socotaa habab cusub ee ${s}?`,
  (s) => `Sharax qaababkaaga saxitaanka cilladaha la xiriira ${s}.`,
  (s) => `Maxay yihiin waxyaabaha aad tixgeliso markaad isticmaalayso ${s}?`,
];

let _fallbackCounter = 0;
function buildQuestionFallback({ targetSkill, jobRole, domain, language }) {
  const subject = targetSkill || jobRole || domain || 'this field';
  const isSomali = String(language).toLowerCase() === 'somali';
  const templates = isSomali ? FALLBACK_TEMPLATES_SO : FALLBACK_TEMPLATES_EN;
  return templates[_fallbackCounter++ % templates.length](subject);
}

function trimConversationHistory(history, maxTurns = HISTORY_WINDOW) {
  if (!Array.isArray(history)) return [];
  const trimmed = history.slice(-maxTurns);
  const anchor = history.find((m) => m.role === 'interviewer');
  if (anchor && !trimmed.some((m) => m.role === 'interviewer' && m.content === anchor.content)) {
    return [anchor, ...trimmed.slice(1)];
  }
  return trimmed;
}

function compactRoleProfile(roleProfile) {
  if (!roleProfile || typeof roleProfile !== 'object') return null;
  return {
    requiredSkills: (roleProfile.requiredSkills || []).slice(0, 5),
    preferredSkills: (roleProfile.preferredSkills || []).slice(0, 3),
    technicalStack: (roleProfile.technicalStack || []).slice(0, 5),
    responsibilities: (roleProfile.responsibilities || []).slice(0, 3),
    experienceLevel: roleProfile.experienceLevel || roleProfile.experience || '',
    candidateSkills: (roleProfile.candidateSkills || []).slice(0, 8),
    candidateExperience: (roleProfile.candidateExperience || []).slice(0, 5),
    candidateEducation: (roleProfile.candidateEducation || []).slice(0, 3),
    candidateProjects: (roleProfile.candidateProjects || []).slice(0, 5),
    candidateCertifications: (roleProfile.candidateCertifications || []).slice(0, 5),
  };
}

function normalizeEvaluation(evaluation) {
  if (!evaluation || typeof evaluation !== 'object') {
    return {
      score: null,
      feedback: '',
      strengths: [],
      improvements: [],
      suggestedAnswer: '',
      evaluationStatus: 'missing',
    };
  }
  const score = evaluation.score != null ? clampScore(evaluation.score) : null;
  // Map 'ok' (Python worker success signal) to 'completed' for downstream consistency
  const rawStatus = evaluation.evaluationStatus;
  const statusIsSuccess = rawStatus === 'ok' || rawStatus === 'completed';
  return {
    score,
    feedback: (evaluation.feedback || '').slice(0, 350),
    strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths.slice(0, 3) : [],
    improvements: Array.isArray(evaluation.improvements) ? evaluation.improvements.slice(0, 3) : [],
    suggestedAnswer: (evaluation.suggestedAnswer || '').slice(0, 350),
    evaluationStatus: score !== null && statusIsSuccess ? 'completed' : (rawStatus || 'failed'),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logGemmaRequest(base, endpoint, payload) {
  if (IS_PROD) {
    logger.info(`[gemmaService] POST ${endpoint} (history: ${payload.conversationHistory?.length ?? 'n/a'} turns)`);
    return;
  }
  console.log(`[gemmaService] >>> POST ${base}`);
  console.log(`[gemmaService] Payload keys: ${Object.keys(payload).join(', ')}`);
}

function logGemmaResponse(status, result) {
  if (IS_PROD) {
    logger.info(`[gemmaService] <<< ${status}`);
    return;
  }
  console.log(`[gemmaService] <<< ${status}`, JSON.stringify(result, null, 2).slice(0, 500));
}

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

/* ─── RunPod Serverless runsync ─────────────────────────── */
async function callRunPod(endpoint, payload, attempt = 0, timeoutMs = TIMEOUT_MS) {
  assertCircuitClosed();
  const gemmaUrl = getGemmaBaseUrl();
  const base = getRunPodEndpointBase(gemmaUrl);
  const runsyncUrl = `${base}/run`;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const startedAt = Date.now();

  logGemmaRequest(runsyncUrl, `${path} (RunPod)`, payload);

  try {
    const response = await fetch(runsyncUrl, {
      method: 'POST',
      headers: runPodHeaders(),
      body: JSON.stringify({
        input: {
          endpoint: path,
          payload,
        },
      }),
      signal: AbortSignal.timeout(Math.min(timeoutMs, 15000)),
    });

    if (!response.ok) {
      const text = await response.text();
      const retryable = response.status === 429;
      if (retryable && attempt < MAX_RETRIES) {
        logger.warn(`[gemmaService] RunPod ${response.status} on ${path}, retry ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        return callRunPod(endpoint, payload, attempt + 1, timeoutMs);
      }
      recordCircuitFailure(`HTTP ${response.status}`, [401, 403, 404].includes(response.status));
      throw new Error(`RunPod API error! status: ${response.status} — ${text.slice(0, 200)}`);
    }

    let data = await response.json();

    if (data.status === 'FAILED' || data.status === 'CANCELLED' || data.status === 'TIMED_OUT') {
      const errMsg = data.error || data.status || 'RunPod job failed';
      throw new Error(`RunPod job ${data.status}: ${errMsg}`);
    }

    const jobId = data.id;
    while (data.status && data.status !== 'COMPLETED' && !data.output) {
      if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(data.status)) {
        recordCircuitFailure(`job ${data.status}`);
        throw new Error(`RunPod job ${data.status}: ${data.error || 'Unknown error'}`);
      }
      if (!jobId) throw new Error(`RunPod job incomplete without an id: ${data.status}`);
      if (Date.now() - startedAt >= timeoutMs) {
        recordCircuitFailure('job timeout');
        const timeoutError = new Error(`RunPod job timed out after ${timeoutMs}ms (last status: ${data.status})`);
        timeoutError.code = 'GEMMA_TIMEOUT';
        throw timeoutError;
      }
      await sleep(RUNPOD_POLL_MS);
      const statusResponse = await fetch(`${base}/status/${jobId}`, {
        headers: runPodHeaders(),
        signal: AbortSignal.timeout(10000),
      });
      if (!statusResponse.ok) {
        throw new Error(`RunPod status error ${statusResponse.status}: ${(await statusResponse.text()).slice(0, 120)}`);
      }
      data = await statusResponse.json();
    }

    const result = data.output ?? data;
    if (result && result.error) {
      recordCircuitFailure('worker error');
      throw new Error(`RunPod worker error: ${result.error}`);
    }

    recordCircuitSuccess();
    logGemmaResponse('RunPod OK', result);
    return result;
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      recordCircuitFailure('network timeout');
    }
    throw error;
  }
}

/* ─── Common fetch helper with retry ───────────────────── */
async function callGemma(endpoint, payload, attempt = 0, timeoutMs = TIMEOUT_MS) {
  const gemmaUrl = getGemmaBaseUrl();
  if (!gemmaUrl) {
    throw new Error('Gemma API URL is not configured.');
  }

  if (isRunPodUrl(gemmaUrl)) {
    return callRunPod(endpoint, payload, attempt, timeoutMs);
  }

  const base = new URL(endpoint.replace(/^\/+/, ''), gemmaUrl.endsWith('/') ? gemmaUrl : `${gemmaUrl}/`).href;
  logGemmaRequest(base, endpoint, payload);

  try {
    const response = await fetch(base, {
      method: 'POST',
      headers: HEADERS(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 404) {
      // The Colab instance is running the standard runsync task router.
      // Adapt the endpoint and payload to Colab's native fine-tuned task names.
      return await callColabRunsyncFallback(gemmaUrl, endpoint, payload, timeoutMs);
    }

    if (!response.ok) {
      const text = await response.text();
      const retryable = response.status >= 500 || response.status === 429;
      if (retryable && attempt < MAX_RETRIES) {
        logger.warn(`[gemmaService] ${response.status} on ${endpoint}, retry ${attempt + 1}/${MAX_RETRIES}`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        return callGemma(endpoint, payload, attempt + 1, timeoutMs);
      }
      throw new Error(`Gemma API error! status: ${response.status} — ${text.slice(0, 200)}`);
    }

    const result = await response.json();
    logGemmaResponse(`${response.status} OK`, result);
    return result;
  } catch (error) {
    if (attempt < MAX_RETRIES && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      logger.warn(`[gemmaService] Timeout on ${endpoint}, retry ${attempt + 1}/${MAX_RETRIES}`);
      await sleep(RETRY_DELAY_MS * (attempt + 1));
      return callGemma(endpoint, payload, attempt + 1, timeoutMs);
    }
    throw error;
  }
}

/**
 * Universal Colab runsync router fallback that maps high-level requests to
 * the fine-tuned model tasks (/ask_technical_question, /open_mock_interview_session, etc.)
 */
async function callColabRunsyncFallback(gemmaUrl, endpoint, payload, timeoutMs) {
  const runsyncUrl = new URL('runsync', gemmaUrl.endsWith('/') ? gemmaUrl : `${gemmaUrl}/`).href;

  if (endpoint === '/generate-questions') {
    const requests = Array.isArray(payload?.requests) ? payload.requests : [];
    const generatedQuestions = [];
    for (const req of requests) {
      const singleQ = await callColabRunsyncFallback(gemmaUrl, '/generate-question', req, timeoutMs);
      generatedQuestions.push(singleQ);
    }
    return { questions: generatedQuestions };
  }

  let taskName = '/ask_technical_question';
  const category = (payload?.category || '').toLowerCase();
  if (endpoint === '/interview-turn') {
    taskName = '/score_candidate_answer';
  } else if (category === 'intro') {
    taskName = '/open_mock_interview_session';
  } else if (category === 'outro') {
    taskName = '/close_mock_interview_session';
  }

  const runsyncBody = {
    endpoint: taskName,
    payload: {
      candidate_name: payload?.candidateName || payload?.candidate_name || 'Candidate',
      language: (payload?.language || 'english').toLowerCase() === 'somali' ? 'so' : 'en',
      specialization: payload?.targetSkill || payload?.jobRole || payload?.role || payload?.domain || 'Technology',
      difficulty: payload?.difficulty || 'mid',
      question: payload?.currentQuestion?.text || payload?.question || '',
      answer: payload?.candidateAnswer || payload?.answer || '',
    },
  };

  const res = await fetch(runsyncUrl, {
    method: 'POST',
    headers: HEADERS(),
    body: JSON.stringify(runsyncBody),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemma Colab runsync error! status: ${res.status} — ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawText = data?.output?.response || data?.output?.question || data?.response || data?.question || '';

  if (endpoint === '/generate-question') {
    return {
      question: rawText,
      expectedAnswer: `Candidate explains core concepts for ${runsyncBody.payload.specialization}.`,
      category: payload?.category || 'conceptual',
      difficulty: payload?.difficulty || 'medium',
    };
  }

  if (endpoint === '/interview-turn') {
    let parsed = null;
    try { parsed = safeParseJSON(rawText); } catch (_) {}
    const score = parsed?.score != null ? clampScore(parsed.score) : null;
    const isSomali = (payload?.language || '').toLowerCase() === 'somali';
    return {
      evaluation: {
        score,
        feedback: parsed?.feedback || rawText || 'Answer recorded — detailed evaluation will be available in the final report.',
        strengths: Array.isArray(parsed?.strengths) ? parsed.strengths : [],
        improvements: Array.isArray(parsed?.improvements) ? parsed.improvements : [],
        suggestedAnswer: parsed?.suggestedAnswer || '',
        evaluationStatus: score !== null ? 'ok' : 'fallback',
      },
      nextInterviewerResponse: isSomali
        ? 'Mahadsanid. Aan u gudubno mawduuca xiga.'
        : 'Thank you. Let us move on to the next question.',
      isFollowUp: false,
      isTopicComplete: true,
      evaluationStatus: score !== null ? 'ok' : 'fallback',
    };
  }

  return data?.output || data;
}


/* ─── Generate Interview Questions ────────────────────────
 *   Endpoint: /generate-question (called multiple times for multiple questions)
 *   Payload:  { language, domain, role, category }
 */
function resolveQuestionCategory(type, absoluteIndex, totalCount) {
  if (absoluteIndex === 0) return 'intro';
  if (absoluteIndex === totalCount - 1) return 'outro';

  let categoryCycle;
  const lowerType = (type || 'mixed').toLowerCase();

  if (lowerType === 'hr') {
    categoryCycle = ['motivation', 'strengths/weaknesses', 'culture fit', 'experience'];
  } else if (lowerType === 'technical') {
    categoryCycle = ['core skills', 'applied knowledge', 'debugging', 'fundamentals'];
  } else if (lowerType === 'behavioral') {
    categoryCycle = ['STAR-based situation', 'past experience', 'problem solving'];
  } else if (lowerType === 'system-design') {
    categoryCycle = ['architecture overview', 'scalability', 'trade-offs', 'component design'];
  } else {
    // mixed: interleave technical and HR categories
    categoryCycle = ['core skills', 'motivation', 'applied knowledge', 'culture fit', 'debugging', 'past experience'];
  }

  return categoryCycle[(absoluteIndex - 1) % categoryCycle.length];
}

const generateInterviewQuestions = async (type, domain, difficulty, count = 1, context = {}) => {
  const {
    jobRole,
    language,
    candidateName,
    jobDescription,
    resumeText,
    focusSkills,
    roleProfile,
    title,
    duration,
    scheduledAt,
    difficultyLabel,
    _forcedCategory,
    _forcedIndex,
    _forcedCount,
    _startIndex = 0,
    requestId,
    requestTimeoutMs,
  } = context;
  const questions = [];
  const batchRequests = [];

  // Candidate-selected focus skills are the interview's explicit scope, so they
  // must outrank skills inferred from a resume or job description.
  const explicitFocusSkills = [...new Set((focusSkills || [])
    .filter((skill) => typeof skill === 'string' && skill.trim())
    .map((skill) => skill.trim().toLowerCase()))];
  const skillHints = [...explicitFocusSkills];
  if (roleProfile?.requiredSkills?.length) skillHints.push(...roleProfile.requiredSkills);
  if (roleProfile?.preferredSkills?.length) skillHints.push(...roleProfile.preferredSkills);
  if (roleProfile?.technicalStack?.length) skillHints.push(...roleProfile.technicalStack);
  if (roleProfile?.candidateSkills?.length) skillHints.push(...roleProfile.candidateSkills);
  // Deduplicate
  const uniqueSkills = [...new Set(skillHints
    .filter((skill) => typeof skill === 'string' && skill.trim())
    .map((skill) => skill.trim().toLowerCase()))].slice(0, 10);
  const hasStructuredProfile = Boolean(roleProfile && (
    roleProfile.requiredSkills?.length
    || roleProfile.candidateSkills?.length
    || roleProfile.responsibilities?.length
    || roleProfile.candidateExperience?.length
  ));
  const rawContextLimit = hasStructuredProfile ? 2000 : 12000;

  console.log(`\n[gemmaService] 🎯 Fetching ${count} interview questions...`);
  if (uniqueSkills.length) console.log(`[gemmaService] 📋 Focus skills: ${uniqueSkills.join(', ')}`);

  const totalCount = _forcedCount ?? count;

  // Generate questions one by one with appropriate categories
  for (let i = 0; i < count; i++) {
    const absoluteIndex = _forcedIndex !== undefined ? _forcedIndex : _startIndex + i;
    const category = _forcedCategory || resolveQuestionCategory(type, absoluteIndex, totalCount);

    // Pin this question slot to one specific skill so the model doesn't fall back to generic phrasing.
    // Rotate through the skill list by index so each question targets a different skill.
    const targetPool = explicitFocusSkills.length ? explicitFocusSkills : uniqueSkills;
    const targetSkill = targetPool.length
      ? targetPool[absoluteIndex % targetPool.length]
      : '';
    // Pass up to 4 remaining skills as supporting context (not the primary target).
    const supportingSkills = uniqueSkills.filter(s => s !== targetSkill).slice(0, 4);

    const payload = {
      language: language || 'english',
      domain: domain || 'general',
      role: jobRole || 'candidate',
      candidateName: candidateName || 'Candidate',
      category,
      type: type || 'technical',
      difficulty: difficulty || 'mid',
      difficultyLabel: difficultyLabel || toDifficultyLabel(difficulty),
      targetSkill,
      supportingSkills,
      skills: uniqueSkills,
      questionIndex: absoluteIndex,
      totalQuestions: totalCount,
      responsibilities: roleProfile?.responsibilities || [],
      experience: roleProfile?.experienceLevel || '',
      candidateExperience: roleProfile?.candidateExperience || [],
      candidateEducation: roleProfile?.candidateEducation || [],
      candidateProjects: roleProfile?.candidateProjects || [],
      candidateCertifications: roleProfile?.candidateCertifications || [],
      interviewTitle: title || '',
      durationMinutes: duration || null,
      scheduledAt: scheduledAt || null,
      jobDescription: jobDescription ? jobDescription.slice(0, rawContextLimit) : '',
      resumeText: resumeText ? resumeText.slice(0, rawContextLimit) : '',
      sessionMode: context.isPractice === false ? 'company' : 'practice',
      requestId,
    };

    if (count > 1) {
      batchRequests.push({ payload, category, absoluteIndex });
      continue;
    }

    const result = await callGemma('/generate-question', payload, 0, requestTimeoutMs || TIMEOUT_MS);
    const qText = result.question || result.text || '';

    const isIntroOutro = category === 'intro' || category === 'outro';
    const isValidQuestion = isValidGeneratedQuestion(qText)
      && (isIntroOutro || !explicitFocusSkills.length || isQuestionAboutTargetSkill(qText, targetSkill));
    if (isValidQuestion) {
      questions.push({
        text: qText.trim(),
        category: category,
        difficulty: difficulty || 'medium',
        expectedAnswer: result.expectedAnswer || result.expected_answer || result.answer || '',
        order: absoluteIndex,
      });
    } else if (isIntroOutro) {
      // Model output unusable — let the caller's dedicated fallback handle this
      questions.push({
        text: '',
        category,
        difficulty: difficulty || 'medium',
        expectedAnswer: '',
        order: absoluteIndex,
      });
    } else {
      questions.push({
        text: buildQuestionFallback({ targetSkill, jobRole, domain, language }),
        category,
        difficulty: difficulty || 'medium',
        expectedAnswer: '',
        order: absoluteIndex,
      });
    }
  }

  if (batchRequests.length) {
    const result = await callGemma('/generate-questions', {
      requests: batchRequests.map((item) => item.payload),
      requestId,
    }, 0, requestTimeoutMs || TIMEOUT_MS);
    const generated = Array.isArray(result.questions) ? result.questions : [];
    generated.forEach((item, index) => {
      const meta = batchRequests[index];
      const qText = item?.question || item?.text || '';
      if (!meta) return;
      const targetPool = explicitFocusSkills.length ? explicitFocusSkills : uniqueSkills;
      const targetSkill = targetPool.length
        ? targetPool[meta.absoluteIndex % targetPool.length]
        : '';
      const isIntroOutro = meta.category === 'intro' || meta.category === 'outro';
      const isValidQuestion = isValidGeneratedQuestion(qText)
        && (isIntroOutro || !explicitFocusSkills.length || isQuestionAboutTargetSkill(qText, targetSkill));
      questions.push({
        text: isValidQuestion
          ? qText.trim()
          : isIntroOutro ? '' : buildQuestionFallback({ targetSkill, jobRole, domain, language }),
        category: meta.category,
        difficulty: difficulty || 'medium',
        expectedAnswer: isValidQuestion
          ? item.expectedAnswer || item.expected_answer || item.answer || ''
          : '',
        order: meta.absoluteIndex,
      });
    });
  }

  // Deduplicate: replace duplicate question text with a skill-rotated fallback
  const seen = [];
  for (const q of questions) {
    if (q.text && isSimilarQuestionText(q.text, '')) continue; // skip empty
    if (q.text && seen.some(s => isSimilarQuestionText(q.text, s))) {
      const targetPool = explicitFocusSkills.length ? explicitFocusSkills : uniqueSkills;
      const altSkill = targetPool.length
        ? targetPool[(q.order + seen.length) % targetPool.length]
        : '';
      q.text = buildQuestionFallback({ targetSkill: altSkill, jobRole, domain, language });
      q.expectedAnswer = '';
    }
    if (q.text) seen.push(q.text);
  }

  questions.sort((a, b) => a.order - b.order);

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
  jobRole = '',
  language = 'english',
  type = 'technical',
  options = {}
) => {
  const {
    difficulty = 'mid',
    currentQuestion = null,
    roleProfile = null,
    candidateAnswer = '',
  } = options;

  if (isPlaceholderAnswer(candidateAnswer)) {
    return {
      evaluation: normalizeEvaluation({
        score: 0,
        feedback: 'No substantive answer was detected. Please try again.',
        strengths: [],
        improvements: ['Provide a clear spoken or typed answer.'],
        suggestedAnswer: '',
        evaluationStatus: 'placeholder',
      }),
      nextInterviewerResponse: language === 'somali'
        ? 'Ma aanan helin jawaab. Fadlan isku day mar kale.'
        : "I didn't catch a substantive answer. Please try again.",
      isFollowUp: true,
      evaluationStatus: 'placeholder',
    };
  }

  const payload = {
    conversationHistory: trimConversationHistory(conversationHistory),
    domain,
    role: jobRole || domain,
    language,
    type,
    difficulty,
    difficultyLabel: toDifficultyLabel(difficulty),
    currentQuestion: currentQuestion
      ? {
          text: currentQuestion.text || '',
          expectedAnswer: currentQuestion.expectedAnswer || '',
          category: currentQuestion.category || 'general',
          difficulty: currentQuestion.difficulty || difficulty,
        }
      : {},
    roleProfile: compactRoleProfile(roleProfile),
  };

  const result = await callGemma('/interview-turn', payload);

  const evaluation = normalizeEvaluation({
    ...(result.evaluation || {}),
    evaluationStatus: result.evaluationStatus,
  });

  const isFollowUp = Boolean(result.isFollowUp);
  const nextInterviewerResponse = isValidInterviewerResponse(result.nextInterviewerResponse)
    ? result.nextInterviewerResponse.trim()
    : isFollowUp
      ? language === 'somali'
        ? 'Fadlan si faahfaahsan u sharax habkaaga.'
        : 'Could you explain your approach in a little more detail?'
      : language === 'somali'
        ? 'Mahadsanid. Aan u gudubno mawduuca xiga.'
        : "Thank you. Let's move on to the next topic.";

  return {
    ...result,
    evaluation,
    nextInterviewerResponse,
    isFollowUp,
    answeredCandidateQuestion: Boolean(result.answeredCandidateQuestion),
  };
};




/* ─── Parse Job Description ───────────────────────────────
 *   Endpoint: /parse
 *   Payload:  { job_description, role }
 *   Response: expects { evaluation: "..." } or direct JSON
 */
const parseJobDescription = async (jobDescription, jobRole, resumeText = '', metadata = {}) => {
  const payload = {
    job_description: jobDescription,
    resume_text: resumeText,
    role: jobRole,
    interview_title: metadata.title || '',
  };

  const result = await callGemma('/parse', payload);

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

  const result = await callGemma('/feedback', payload);

  let feedback = result.feedback || result.data || result;

  if (result.evaluation && typeof result.evaluation === 'string') {
    feedback = safeParseJSON(result.evaluation);
  }

  logger.info(`Comprehensive feedback generated — overall score: ${feedback.overallScore}`);
  return feedback;
};

/* ─── Audio Transcription (stub) ─────────────────────────── */
const transcribeAudio = async () => {
  logger.warn('Audio transcription is not available — use browser Web Speech API instead');
  throw new Error('Audio transcription is not available. The frontend uses browser-native Speech Recognition for STT.');
};

const warmGemma = async (requestId = 'startup-warmup') => {
  const startedAt = Date.now();
  const gemmaUrl = getGemmaBaseUrl();

  if (!gemmaUrl) {
    throw new Error('Gemma API URL is not configured.');
  }

  let result;

  if (isRunPodUrl(gemmaUrl)) {
    // RunPod Serverless: send warmup via the standard runsync payload
    result = await callRunPod('/warmup', { requestId });
  } else {
    // Colab/ngrok or any other direct FastAPI server:
    // Use GET /health — it's always present and pings the live model without
    // triggering an actual generation. The /warmup POST does not exist on the
    // Colab notebook and returns 404.
    const res = await fetch(`${gemmaUrl}/health`, {
      method: 'GET',
      headers: HEADERS(),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemma API error! status: ${res.status} — ${text.slice(0, 200)}`);
    }
    result = await res.json();
  }

  logger.info(JSON.stringify({
    event: 'gemma_warmup_complete',
    requestId,
    totalMs: Date.now() - startedAt,
    modelLoadMs: result?._timing?.modelLoadMs ?? null,
  }));
  return result;
};


module.exports = {
  parseJobDescription,
  generateInterviewQuestions,
  processInterviewTurn,
  generateComprehensiveFeedback,
  transcribeAudio,
  getGemmaBaseUrl,
  clampScore,
  isPlaceholderAnswer,
  trimConversationHistory,
  compactRoleProfile,
  normalizeEvaluation,
  isValidGeneratedQuestion,
  isQuestionAboutTargetSkill,
  isValidInterviewerResponse,
  checkGemmaStatus,
  warmGemma,
  _circuit: circuit,
};
