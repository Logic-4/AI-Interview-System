const logger = require('../utils/logger');
const SystemConfig = require('../models/SystemConfig');

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
const RUNPOD_POLL_MS = Number(process.env.RUNPOD_POLL_MS || 500);
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

function clampScore(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isPlaceholderAnswer(text) {
  if (!text || !text.trim()) return true;
  return PLACEHOLDER_ANSWER_RE.test(text.trim());
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
  return {
    score: evaluation.score != null ? clampScore(evaluation.score) : null,
    feedback: evaluation.feedback || '',
    strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths.slice(0, 3) : [],
    improvements: Array.isArray(evaluation.improvements) ? evaluation.improvements.slice(0, 3) : [],
    suggestedAnswer: evaluation.suggestedAnswer || '',
    evaluationStatus: evaluation.evaluationStatus || 'ok',
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

  const base = new URL(endpoint, gemmaUrl).href;

  logGemmaRequest(base, endpoint, payload);

  try {
    const response = await fetch(base, {
      method: 'POST',
      headers: HEADERS(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

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
    categoryCycle = ['core skills', 'scenario tasks', 'debugging', 'fundamentals'];
  } else if (lowerType === 'behavioral') {
    categoryCycle = ['STAR-based situation', 'past experience', 'problem solving'];
  } else {
    categoryCycle = ['conceptual', 'situational', 'behavioral', 'technical'];
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
    _forcedCategory,
    _forcedIndex,
    _forcedCount,
    _startIndex = 0,
    requestId,
    requestTimeoutMs,
  } = context;
  const questions = [];
  const batchRequests = [];

  // Build a concise skill list from all available sources
  const skillHints = [];
  if (roleProfile?.requiredSkills?.length) skillHints.push(...roleProfile.requiredSkills);
  if (roleProfile?.preferredSkills?.length) skillHints.push(...roleProfile.preferredSkills);
  if (roleProfile?.technicalStack?.length) skillHints.push(...roleProfile.technicalStack);
  if (roleProfile?.candidateSkills?.length) skillHints.push(...roleProfile.candidateSkills);
  if (focusSkills?.length) skillHints.push(...focusSkills);
  // Deduplicate
  const uniqueSkills = [...new Set(skillHints.map(s => s.toLowerCase()))].slice(0, 10);
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

    const payload = {
      language: language || 'english',
      domain: domain || 'general',
      role: jobRole || 'candidate',
      candidateName: candidateName || 'Candidate',
      category,
      type: type || 'technical',
      difficulty: difficulty || 'mid',
      skills: uniqueSkills,
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
      requestId,
    };

    if (count > 1) {
      batchRequests.push({ payload, category, absoluteIndex });
      continue;
    }

    const result = await callGemma('/generate-question', payload, 0, requestTimeoutMs || TIMEOUT_MS);
    const qText = result.question || result.text || '';

    if (qText) {
      questions.push({
        text: qText,
        category: category,
        difficulty: difficulty || 'medium',
        expectedAnswer: result.expectedAnswer || result.expected_answer || result.answer || '',
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
      if (!meta || !qText) return;
      questions.push({
        text: qText,
        category: meta.category,
        difficulty: difficulty || 'medium',
        expectedAnswer: item.expectedAnswer || item.expected_answer || item.answer || '',
        order: meta.absoluteIndex,
      });
    });
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
    jobRole,
    language,
    type,
    difficulty,
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

  return {
    ...result,
    evaluation,
    isFollowUp: Boolean(result.isFollowUp),
    answeredCandidateQuestion: Boolean(result.answeredCandidateQuestion),
  };
};

/* ─── Legacy evaluate ─── */
const evaluateAnswer = async () => {
  throw new Error('evaluateAnswer is deprecated. Use processInterviewTurn instead.');
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
  const result = await callGemma('/warmup', { requestId });
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
  evaluateAnswer,
  processInterviewTurn,
  generateComprehensiveFeedback,
  transcribeAudio,
  getGemmaBaseUrl,
  clampScore,
  isPlaceholderAnswer,
  trimConversationHistory,
  compactRoleProfile,
  normalizeEvaluation,
  checkGemmaStatus,
  warmGemma,
  _circuit: circuit,
};
