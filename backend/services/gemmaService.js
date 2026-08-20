const logger = require('../utils/logger');
const SystemConfig = require('../models/SystemConfig');
const { isSimilarQuestionText } = require('../utils/questionHelpers');
const { normalizeEvaluation } = require('../utils/evaluation');
const { translateToSomali } = require('./geminiSpeechService');

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
// This must exceed real worst-case model latency or evaluations are aborted
// mid-flight and the score is lost. Measured against the live server: ~30s to
// score a short English answer, ~138s for the same call in Somali (Somali
// costs far more tokens per word). At the old 45s budget every Somali
// evaluation timed out — answers came back unscored no matter how good they
// were, which is the "takes ages and returns nothing" failure.
// Waiting is no longer felt by the candidate: submitAnswer responds after
// FAST_EVAL_BUDGET_MS and the evaluation finishes in the background, with
// completeInterview waiting for it before the final average is computed.
const INTERVIEW_TURN_TIMEOUT_MS = Number(process.env.INTERVIEW_TURN_TIMEOUT_MS || 180000);
const MAX_RETRIES = Number(process.env.GEMMA_MAX_RETRIES || 1);
const RETRY_DELAY_MS = 1500;
const HISTORY_WINDOW = 8;
const IS_PROD = process.env.NODE_ENV === 'production';
const RUNPOD_POLL_MS = Number(process.env.RUNPOD_POLL_MS || 300);
const CIRCUIT_OPEN_MS = Number(process.env.GEMMA_CIRCUIT_OPEN_MS || 60000);
// Somali can't use the /generate-questions batch endpoint (it ignores
// per-item language, see the ponytail note below), so each question is its
// own /generate-question call — cap how many run at once so a multi-question
// Somali interview doesn't fire a burst large enough to trip the shared
// circuit breaker via 429s.
const SOMALI_GEN_CONCURRENCY = Number(process.env.SOMALI_GEN_CONCURRENCY || 3);

const circuit = { failures: 0, openUntil: 0, reason: '' };

// Set once the configured base URL is discovered to be a runsync-only router
// (the Colab/Lightning notebook) so later calls skip the always-404 probe.
// Module-level is safe: the base URL is read once at load and never changes.
let colabRunsyncOnly = false;

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

function isPlaceholderAnswer(text) {
  if (!text || !text.trim()) return true;
  return PLACEHOLDER_ANSWER_RE.test(text.trim());
}

function isValidGeneratedQuestion(text) {
  if (typeof text !== 'string') return false;
  const question = text.trim().replace(/\s+/g, ' ');
  if (question.length < 8 || question.length > 300 || !question.endsWith('?')) return false;
  // The model sometimes crams several questions into one turn ("What is X?
  // How does it differ from Y? When would you use it?") — enforce one
  // question per turn by rejecting any text with more than one '?'.
  if ((question.match(/\?/g) || []).length > 1) return false;

  return !/(return only valid json|expected answer|ideal answer|one field ["']?question|interview assessment)/i.test(question);
}

// `isSomali` is optional so existing English-only callers keep working
// unchanged. When passed, a response with no Somali signal is rejected —
// mirrors the same guard question generation already has (looksSomali
// below), which this check was missing: the fine-tuned model's session-open
// task confirmed live to answer in English even when language:"so" was
// requested, and without this check that English text could reach a
// Somali-language candidate mid-interview as the "next question" prompt.
function isValidInterviewerResponse(text, isSomali = false) {
  if (typeof text !== 'string') return false;
  const response = text.trim().replace(/\s+/g, ' ');
  if (response.length < 2 || response.length > 300) return false;
  if (isSomali && looksEnglish(response)) return false;
  return !/(return only valid json|expected answer|ideal answer|one field ["']?question|interview assessment)/i.test(response);
}

// Generic words inside specialization-subtopic phrases ("HTML & CSS
// fundamentals", "DOM and browser rendering") that carry no topical signal
// on their own — stripped so matching is driven by the real technology/
// concept words instead of connective filler.
const SKILL_MATCH_STOPWORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'for', 'in', 'on', 'with', 'to',
  'fundamentals', 'concepts', 'principles', 'practices', 'basics', 'core',
]);

function skillMatchTokens(skill) {
  return String(skill)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2 && !SKILL_MATCH_STOPWORDS.has(t));
}

// A token match alone can't tell "react" the library apart from "React
// Native" the different, unrelated framework — "react" is a genuine
// substring/whole-word hit inside "react native" too. Confirmed live:
// target "react" let through "If I use strict mode with React Native app,
// will styling problems be caught?" — exactly the drift this guard exists
// to catch. Listed pairs are rejected even though the token technically
// matches; extend only with pairs actually seen live, not hypothetical ones.
const SKILL_CONFUSABLES = {
  react: ['react native'],
};

// Lenient on-topic check: a full-phrase substring match (the old behavior)
// almost never fires for a specialization subtopic like "HTML & CSS
// fundamentals" — no natural question repeats that whole phrase — so this
// matches on ANY significant token from targetSkill instead. Loose enough
// not to reject legitimate rephrasing (a "React hooks" question for target
// "react"), strict enough to catch outright drift confirmed live: assigned
// "mongodb", the model asked about Webpack instead — zero shared tokens.
function isQuestionAboutTargetSkill(question, targetSkill) {
  if (!targetSkill) return true;
  const tokens = skillMatchTokens(targetSkill);
  if (!tokens.length) return true;
  const q = String(question).toLowerCase();
  return tokens.some((t) => {
    if (!q.includes(t)) return false;
    const confusables = SKILL_CONFUSABLES[t];
    if (confusables && confusables.some((phrase) => q.includes(phrase))) return false;
    return true;
  });
}

// Somali technical questions routinely keep English loanwords like "API",
// "React", or "database", so "no Somali token found" is too strict a test:
// a real Somali question can be mostly technical terms plus only one or two
// Somali cue words, and the old detector rejected those as English. Keep a
// broad Somali cue list, but only classify text as English when it carries an
// explicit English opener/preamble instead of merely lacking a Somali token.
const SOMALI_TOKEN_RE = /\b(waa|maxaa|maxay|maxaad|maxayse|ma|iyo|oo|ah|ku|la|ka|aad|aan|waxaan|waxaa|waxaad|sidee|sideed|sida|goorma|kee|tee|xagee|xaggee|xaggeed|ayaad|khibrad|noo|tusaale|sharax|sharrax|farqiga|kartaa|leedahay|isticmaal|isticmaashaa|adeegsan|adeegsataa|ula|marka|markaad|shaqada|shaqo)\b/i;
const ENGLISH_OPENING_RE = /^(what|how|why|when|where|which|who|can you|could you|would you|please|tell me|walk me through|describe|explain|today we('| wi)ll|open(?:ing)? mock interview session|review complete)\b/i;
function looksSomali(text) {
  return SOMALI_TOKEN_RE.test(String(text || '').slice(0, 400));
}
function looksEnglish(text) {
  // Only reject as English on a positive signal. Somali technical questions
  // often contain mostly borrowed English nouns, and treating "not clearly
  // Somali" as English caused valid Somali questions to be thrown away.
  const sample = String(text || '').trim().slice(0, 200);
  return !looksSomali(sample) && ENGLISH_OPENING_RE.test(sample);
}

// Broad specializations aren't testable technical anchors by themselves
// ("frontend development" as a target produces a generic question) — expand
// each one the frontend offers (see frontend/src/lib/constants.ts
// TECHNOLOGY_SPECIALIZATIONS) into concrete subtopics so both real model
// generation and the fallback templates below have something specific to
// target when the candidate leaves Focus Skills empty.
const SPECIALIZATION_SUBTOPICS = {
  'frontend development': ['HTML & CSS fundamentals', 'JavaScript core concepts', 'DOM and browser rendering', 'responsive and accessible UI design', 'frontend state management', 'client-side performance optimization', 'consuming REST/GraphQL APIs', 'modern frontend frameworks'],
  'backend development': ['API design and REST principles', 'database schema design', 'authentication and authorization', 'server-side architecture', 'caching strategies', 'concurrency and async processing', 'error handling and logging', 'HTTP and networking fundamentals'],
  'mobile app development': ['mobile UI/UX patterns', 'native vs cross-platform trade-offs', 'app lifecycle and state management', 'offline storage and data sync', 'mobile performance and battery usage', 'push notifications', 'app release and distribution'],
  'devops & infrastructure': ['CI/CD pipelines', 'containerization', 'infrastructure as code', 'monitoring and alerting', 'deployment strategies', 'configuration management', 'incident response'],
  'cloud engineering': ['cloud service models (IaaS/PaaS/SaaS)', 'scalability and auto-scaling', 'cloud networking and security', 'cost optimization', 'serverless architecture', 'high-availability design'],
  'database administration': ['relational schema design and normalization', 'indexing and query optimization', 'transactions and ACID properties', 'backup and recovery', 'replication and high availability', 'database security'],
  'data science & analytics': ['data cleaning and preprocessing', 'statistical analysis fundamentals', 'data visualization', 'SQL for analytics', 'A/B testing', 'exploratory data analysis'],
  'machine learning & ai': ['supervised vs unsupervised learning', 'model evaluation metrics', 'overfitting and regularization', 'feature engineering', 'training pipelines', 'deploying models to production'],
  cybersecurity: ['common web vulnerabilities', 'authentication and access control', 'encryption fundamentals', 'network security basics', 'secure coding practices', 'incident response and threat detection'],
  'software architecture': ['design patterns', 'system design trade-offs', 'scalability and reliability', 'microservices vs monolith', 'API and service boundaries', 'managing technical debt'],
};

/** Expands broad specialization names (e.g. from jobRole) into their concrete subtopics. */
function expandSpecializationSubtopics(names = []) {
  const subtopics = [];
  for (const name of names) {
    const key = String(name || '').trim().toLowerCase();
    if (SPECIALIZATION_SUBTOPICS[key]) subtopics.push(...SPECIALIZATION_SUBTOPICS[key]);
  }
  return subtopics;
}

// The model is the ONLY source of interview questions — there are no
// hardcoded question templates. When a generated question fails shape/language
// validation we ask the model again (a fresh sample; on retry the previous
// text is passed as `rejected_question` so the prompt steers away from it),
// up to QUESTION_GEN_ATTEMPTS times. If every attempt is still unusable the
// slot is left empty and the caller fails generation loudly (retryable) —
// nothing templated ever reaches a candidate. A thrown call error (network,
// 404, open circuit) is NOT retried here: it propagates so the pipeline marks
// generation failed instead of masking a dead model as an empty question.
const QUESTION_GEN_ATTEMPTS = Number(process.env.QUESTION_GEN_ATTEMPTS || 3);

async function generateValidQuestion(payload, language, requestTimeoutMs) {
  const isSomali = String(language).toLowerCase() === 'somali';
  // For Somali, always ask the worker to COMPOSE in English (reliably good),
  // then translate through Gemini (translateToSomali) below. Composing new
  // technical content and getting Somali grammar right in the same model
  // call is too much for this fine-tune — confirmed live with wrong verb
  // choices and garbled multi-clause sentences even after lowering
  // temperature and adding few-shot examples. Gemini is a much larger,
  // broadly multilingual model already used for STT/TTS in this backend;
  // routing translation through it here also means this fix iterates at
  // Node speed instead of needing a Colab redeploy per attempt.
  const composePayload = isSomali ? { ...payload, language: 'english' } : payload;
  let lastEnglishText = '';
  let lastText = '';
  // A shape/language-valid question that missed the target-skill check —
  // kept as a safety net. Topic relevance is a soft preference, not a hard
  // gate like shape/language: the model can systematically drift on a given
  // skill (confirmed live: 3/3 attempts targeting "mongodb" all landed on an
  // unrelated topic), and emptying the slot after exhausting retries would
  // turn "occasionally off-topic" into "sometimes the interview breaks" —
  // strictly worse. A well-formed but off-target question beats none.
  let offTargetFallback = null;
  for (let attempt = 0; attempt < QUESTION_GEN_ATTEMPTS; attempt++) {
    const result = await callGemma(
      '/generate-question',
      attempt === 0 ? composePayload : { ...composePayload, rejected_question: lastEnglishText },
      0,
      requestTimeoutMs || TIMEOUT_MS,
    );
    let qText = (result.question || result.text || '').trim();
    if (qText) lastEnglishText = qText;

    if (isSomali && qText) {
      try {
        qText = await translateToSomali(qText);
      } catch (translateError) {
        logger.warn(`[gemmaService] Somali translation failed (attempt ${attempt + 1}): ${translateError.message}`);
        qText = '';
      }
    }

    if (qText) lastText = qText;
    const shapeValid = isValidGeneratedQuestion(qText) && !(isSomali && looksEnglish(qText));
    const onTarget = shapeValid && isQuestionAboutTargetSkill(qText, payload.targetSkill);
    if (shapeValid) {
      const answer = {
        text: qText,
        expectedAnswer: result.expectedAnswer || result.expected_answer || result.answer || '',
      };
      if (onTarget) return answer;
      offTargetFallback = answer;
    }
    logger.warn(JSON.stringify({
      event: 'question_rejected_retrying',
      attempt: attempt + 1,
      isSomali,
      shapeValid,
      onTarget,
      looksSomali: isSomali ? looksSomali(qText) : null,
      englishSource: isSomali ? lastEnglishText.slice(0, 160) : undefined,
      rawTextPreview: String(qText).slice(0, 160),
    }));
  }
  if (offTargetFallback) return offTargetFallback;
  return { text: '', expectedAnswer: '' };
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `fn` over `items` with at most `limit` in flight, preserving result order. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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

/**
 * Repairs LLM JSON cut short by a token limit — most commonly a string
 * value or array left open when generation stopped, which then has a
 * mismatched closing brace tacked on (e.g. `"improvements": ["foo"}`
 * instead of `"improvements": ["foo"]}`). Walks the string tracking the
 * bracket stack; whenever a closer doesn't match the innermost opener,
 * closes the inner ones first instead of failing. Any brackets still open
 * at the end (a purely truncated tail, no stray closer) are closed too.
 */
function repairTruncatedJSON(str) {
  const closerFor = { '{': '}', '[': ']' };
  const stack = [];
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape) { result += ch; escape = false; continue; }
    if (ch === '\\' && inString) { result += ch; escape = true; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString) { result += ch; continue; }
    if (ch === '{' || ch === '[') { stack.push(ch); result += ch; continue; }
    if (ch === '}' || ch === ']') {
      while (stack.length && closerFor[stack[stack.length - 1]] !== ch) {
        result += closerFor[stack.pop()];
      }
      if (stack.length) stack.pop();
      result += ch;
      continue;
    }
    result += ch;
  }

  if (inString) result += '"';
  while (stack.length) result += closerFor[stack.pop()];

  return result;
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
    try {
      const repaired = JSON.parse(repairTruncatedJSON(jsonStr));
      logger.warn(`safeParseJSON: repaired truncated JSON (original error: ${parseErr.message})`);
      return repaired;
    } catch {
      // Repair didn't help — fall through to the original, more useful error.
    }
    throw new Error(
      `safeParseJSON: JSON.parse failed at character position ${jsonStart}–${jsonEnd}.\n` +
      `Parse error: ${parseErr.message}\n` +
      `Extracted JSON string:\n${jsonStr.slice(0, 1000)}\n` +
      `Full raw text (first 800 chars):\n${raw.slice(0, 800)}`
    );
  }
}

function parseEvaluationResponse(rawText) {
  let parsed;
  try {
    parsed = safeParseJSON(rawText);
  } catch (error) {
    return {
      evaluation: normalizeEvaluation({}, 'AI evaluation response could not be parsed. Answer recorded for retry.'),
      error,
    };
  }

  const candidate = parsed?.evaluation && typeof parsed.evaluation === 'object'
    ? parsed.evaluation
    : parsed;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {
      evaluation: normalizeEvaluation({}, 'AI evaluation response had an invalid schema. Answer recorded for retry.'),
      error: new Error('Evaluation response must be a JSON object'),
    };
  }

  const evaluation = normalizeEvaluation(candidate);
  return {
    evaluation,
    // `candidate` is returned so callers can read the turn-control fields the
    // model returns alongside the score (isFollowUp / nextInterviewerResponse)
    // instead of hardcoding them — see the /interview-turn branch below.
    candidate,
    error: evaluation.evaluationStatus === 'completed'
      ? null
      : new Error('Evaluation response requires a score in [0,100] and non-empty feedback'),
  };
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

  // The notebook server exposes only /runsync, so the native-endpoint POST
  // below always 404s there. Remembering that after the first probe saves a
  // wasted round trip on every subsequent call — the notebook log showed
  // `POST /interview-turn 404` immediately before each `POST /runsync 200`,
  // and over an ngrok tunnel that round trip costs real latency on every
  // question generated and every answer scored.
  if (colabRunsyncOnly) {
    return callColabRunsyncFallback(gemmaUrl, endpoint, payload, timeoutMs);
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
      if (!colabRunsyncOnly) {
        colabRunsyncOnly = true;
        logger.info('[gemmaService] native endpoints 404 — routing all further calls straight to /runsync');
      }
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
 * POSTs to the Colab /runsync router with the same retry-on-5xx/429 policy
 * callRunPod already has. The direct-fetch path above has no retry of its
 * own (only TimeoutError/AbortError get retried in callGemma), so a
 * transient 503 here used to fail the candidate's turn outright — observed
 * live during testing (ngrok interstitial 503 mid-interview left one
 * question unscored, which nulled the whole interview's overall score).
 */
async function postRunsync(runsyncUrl, body, timeoutMs, attempt = 0) {
  const res = await fetch(runsyncUrl, {
    method: 'POST',
    headers: HEADERS(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const retryable = res.status >= 500 || res.status === 429;
    if (retryable && attempt < MAX_RETRIES) {
      const text = await res.text();
      logger.warn(`[gemmaService] Colab runsync ${res.status} on ${body.endpoint}, retry ${attempt + 1}/${MAX_RETRIES}: ${text.slice(0, 120)}`);
      await sleep(RETRY_DELAY_MS * (attempt + 1));
      return postRunsync(runsyncUrl, body, timeoutMs, attempt + 1);
    }
    const text = await res.text();
    throw new Error(`Gemma Colab runsync error! status: ${res.status} — ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Universal Colab runsync router fallback that maps high-level requests to
 * the fine-tuned model tasks (/ask_technical_question, /open_mock_interview_session, etc.)
 */
async function callColabRunsyncFallback(gemmaUrl, endpoint, payload, timeoutMs) {
  const runsyncUrl = new URL('runsync', gemmaUrl.endsWith('/') ? gemmaUrl : `${gemmaUrl}/`).href;
  const joinList = (list) => (Array.isArray(list) ? list.filter(Boolean).join('; ') : '');

  if (endpoint === '/generate-questions') {
    // The notebook has no real batch endpoint, so a "batch" of N questions
    // becomes N sequential /generate-question calls here. `timeoutMs` is the
    // budget the caller gave the WHOLE batch (runQuestionGenerationPipeline
    // passes REMAINING_QUESTIONS_TIMEOUT_MS, 60s) — handing that same 60s to
    // EACH sub-call meant an N-question batch had no real ceiling at all
    // (5 questions × up to 60s = 300s+, confirmed live: an interview sat at
    // "generating-remaining" for 7+ minutes). A shared deadline means the
    // batch as a whole respects the caller's budget: once it's spent, the
    // remaining slots come back as empty questions, which the caller already
    // knows how to turn into a fallback question — same safety net as a
    // single slow item, just applied to the batch instead of each item.
    const requests = Array.isArray(payload?.requests) ? payload.requests : [];
    const deadline = Date.now() + timeoutMs;
    const generatedQuestions = [];
    for (const req of requests) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        generatedQuestions.push({ question: '', expectedAnswer: '' });
        continue;
      }
      const singleQ = await callColabRunsyncFallback(gemmaUrl, '/generate-question', req, remaining);
      generatedQuestions.push(singleQ);
    }
    return { questions: generatedQuestions };
  }

  if (endpoint === '/feedback') {
    // Report generation doesn't fit the candidate/specialization schema the
    // other tasks below get remapped into (it needs the whole interview
    // transcript), so pass the endpoint and payload straight through to the
    // worker's own /feedback route instead of translating it.
    const data = await postRunsync(runsyncUrl, { endpoint: '/feedback', payload }, timeoutMs);
    if (data?.output?.error) {
      throw new Error(`Gemma Colab worker error: ${data.output.error}`);
    }
    // Same wrapper shape as every other runsync task — the model's JSON is
    // embedded as text in output.response, not already-parsed.
    const rawText = data?.output?.response || '';
    return safeParseJSON(rawText);
  }

  if (endpoint === '/parse') {
    // Job description / resume parsing has its own dedicated task on the
    // notebook (build_parse_prompt) — it used to fall through to the
    // generic branch below and get sent as '/ask_technical_question',
    // which silently made every interview with a resume or job description
    // lose all candidate-background context (proven live: a real
    // company interview's stored roleProfile was literally the model's
    // reply to a mis-routed "ask a technical question" prompt).
    const data = await postRunsync(runsyncUrl, {
      endpoint: '/parse',
      payload: {
        job_description: (payload?.job_description || '').slice(0, 6000),
        resume_text: (payload?.resume_text || '').slice(0, 6000),
        role: payload?.role || 'Technology',
      },
    }, timeoutMs);
    if (data?.output?.error) {
      throw new Error(`Gemma Colab worker error: ${data.output.error}`);
    }
    const rawText = data?.output?.response || '';
    return safeParseJSON(rawText);
  }

  if (endpoint === '/generate-question') {
    const targetSkill = String(payload?.targetSkill || '').trim();
    const supportingSkills = Array.isArray(payload?.supportingSkills)
      ? payload.supportingSkills.filter(Boolean).map((s) => String(s).trim()).filter(Boolean)
      : [];
    const focusSkills = targetSkill
      ? [targetSkill]
      : supportingSkills.slice(0, 1);
    const data = await postRunsync(runsyncUrl, {
      endpoint: '/ask_technical_question',
      payload: {
        language: (payload?.language || 'english').toLowerCase() === 'somali' ? 'so' : 'en',
        // Keep the broader role/specialization here; the notebook prompt uses
        // focus_skills to pin the exact technology and otherwise blends every
        // raw context field into one overstuffed question.
        specialization: payload?.jobRole || payload?.role || payload?.domain || targetSkill || 'Technology',
        focus_skills: focusSkills,
        supporting_skills: supportingSkills,
        difficulty: payload?.difficulty || 'mid',
        category: payload?.category || 'general',
        responsibilities: payload?.responsibilities || [],
        candidate_experience: payload?.candidateExperience || [],
        candidate_projects: payload?.candidateProjects || [],
        candidate_education: payload?.candidateEducation || [],
        candidate_certifications: payload?.candidateCertifications || [],
        job_description: (payload?.jobDescription || '').slice(0, 3000),
        resume_text: (payload?.resumeText || '').slice(0, 3000),
        previous_questions: Array.isArray(payload?.previous_questions) ? payload.previous_questions : [],
        rejected_question: payload?.rejected_question || '',
      },
    }, timeoutMs);
    const rawText = data?.output?.response || data?.output?.question || data?.response || data?.question || '';
    return {
      question: rawText,
      expectedAnswer: `Candidate explains core concepts for ${targetSkill || focusSkills[0] || payload?.jobRole || payload?.domain || 'the role'}.`,
      category: payload?.category || 'conceptual',
      difficulty: payload?.difficulty || 'medium',
    };
  }

  let taskName = '/ask_technical_question';
  const category = (payload?.category || '').toLowerCase();
  const isHiring = payload?.sessionMode === 'company';
  if (endpoint === '/interview-turn') {
    taskName = '/score_candidate_answer';
  } else if (category === 'intro') {
    taskName = isHiring ? '/open_hiring_interview_session' : '/open_mock_interview_session';
  } else if (category === 'outro') {
    taskName = isHiring ? '/close_hiring_interview_session' : '/close_mock_interview_session';
  }

  // Question-gen payloads carry these at the top level; scoring payloads
  // nest them under roleProfile (see compactRoleProfile) — check both shapes
  // so the candidate's resume-derived background reaches this fallback path
  // the same way it already reaches the RunPod worker.
  const candidateBackground = payload?.roleProfile || payload || {};

  const runsyncBody = {
    endpoint: taskName,
    payload: {
      candidate_name: payload?.candidateName || payload?.candidate_name || 'Candidate',
      language: (payload?.language || 'english').toLowerCase() === 'somali' ? 'so' : 'en',
      specialization: payload?.targetSkill || payload?.jobRole || payload?.role || payload?.domain || 'Technology',
      difficulty: payload?.difficulty || 'mid',
      question: payload?.currentQuestion?.text || payload?.question || '',
      answer: payload?.candidateAnswer || payload?.answer || '',
      question_id: payload?.currentQuestion?.id || '',
      expected_answer: payload?.currentQuestion?.expectedAnswer || '',
      category: payload?.currentQuestion?.category || 'general',
      candidate_experience: joinList(candidateBackground.candidateExperience),
      candidate_education: joinList(candidateBackground.candidateEducation),
      candidate_projects: joinList(candidateBackground.candidateProjects),
      candidate_certifications: joinList(candidateBackground.candidateCertifications),
      // Previously dropped here even though generateInterviewQuestions
      // prepares them — the model was only ever told the specialization
      // name and difficulty, with no job/resume context to draw a
      // specific question from.
      job_description: (payload?.jobDescription || '').slice(0, 3000),
      resume_text: (payload?.resumeText || '').slice(0, 3000),
      responsibilities: joinList(payload?.responsibilities),
      supporting_skills: joinList(payload?.supportingSkills),
    },
  };

  const data = await postRunsync(runsyncUrl, runsyncBody, timeoutMs);
  const rawText = data?.output?.response || data?.output?.question || data?.response || data?.question || '';

  if (endpoint === '/interview-turn') {
    const isSomali = (payload?.language || '').toLowerCase() === 'somali';
    const { evaluation, candidate, error: parseError } = parseEvaluationResponse(rawText);

    // The scoring task returns isFollowUp/nextInterviewerResponse alongside the
    // score. These used to be hardcoded to `false` + a canned line here, which
    // meant a follow-up could never fire on this path no matter what the model
    // decided — a partial answer was always accepted and moved past.
    // The fine-tuned /score_candidate_answer task names these
    // needsFollowUp/followUpTarget (see the notebook's ClarityEvaluationOutput),
    // NOT isFollowUp/nextInterviewerResponse. Reading only the latter meant a
    // follow-up could never fire on the Colab path — every partial/unclear
    // answer was silently accepted and the interview jumped to the next
    // question (the "clarification is ignored" bug). Accept both shapes.
    const modelWantsFollowUp = candidate?.isFollowUp === true || candidate?.needsFollowUp === true;
    const followUpTarget = typeof candidate?.followUpTarget === 'string'
      ? candidate.followUpTarget.trim()
      : '';
    const modelNextResponse = (typeof candidate?.nextInterviewerResponse === 'string'
      && candidate.nextInterviewerResponse.trim())
      ? candidate.nextInterviewerResponse.trim()
      : (modelWantsFollowUp && followUpTarget)
        ? (isSomali
          ? `Fadlan wax dheeraad ah nooga sheeg ${followUpTarget}.`
          : `Could you tell me a bit more about ${followUpTarget}?`)
        : '';
    const nextInterviewerResponse = isValidInterviewerResponse(modelNextResponse, isSomali)
      ? modelNextResponse
      : modelWantsFollowUp
        ? (isSomali
          ? 'Fadlan si faahfaahsan u sharax habkaaga.'
          : 'Could you explain your approach in a little more detail?')
        : (isSomali
          ? 'Mahadsanid. Aan u gudubno mawduuca xiga.'
          : 'Thank you. Let us move on to the next question.');
    // Only honour a follow-up when the turn actually scored — asking a
    // follow-up off a failed/unparseable evaluation would loop the candidate
    // on a question we never managed to grade.
    const isFollowUp = modelWantsFollowUp && evaluation.evaluationStatus === 'completed';

    const logEvaluation = parseError ? logger.warn.bind(logger) : logger.info.bind(logger);
    logEvaluation(JSON.stringify({
      event: 'colab_score_parsed',
      task: 'score_candidate_answer',
      score: evaluation.score,
      evaluationStatus: evaluation.evaluationStatus,
      isFollowUp,
      parseError: parseError?.message || null,
      rawResponsePreview: IS_PROD ? undefined : rawText.slice(0, 500),
    }));

    return {
      evaluation,
      nextInterviewerResponse,
      isFollowUp,
      isTopicComplete: !isFollowUp,
      evaluationStatus: evaluation.score !== null ? 'ok' : 'failed',
    };
  }

  return data?.output || data;
}


/* ─── Generate Interview Questions ────────────────────────
 *   Endpoint: /generate-question (called multiple times for multiple questions)
 *   Payload:  { language, domain, role, category }
 */
// No intro/outro slots: every question is a genuine, model-generated
// technical/topic question. The spoken greeting and farewell are handled by
// the frontend engine, so a separate non-evaluable intro/outro question is
// both hardcoded and unnecessary. Fallback only — callers normally pass
// `_forcedCategory` (see interviewController.js's own copy of this cycle);
// this covers the rare caller that doesn't (benchmark script, tests).
const CATEGORY_CYCLE = ['core skills', 'motivation', 'applied knowledge', 'culture fit', 'debugging', 'past experience'];

function resolveQuestionCategory(absoluteIndex) {
  return CATEGORY_CYCLE[absoluteIndex % CATEGORY_CYCLE.length];
}

const generateInterviewQuestions = async (domain, difficulty, count = 1, context = {}) => {
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
  const requests = [];

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

  // Falling back to the specialization NAME itself as the "target skill"
  // produces generic questions ("What is frontend development?"); expand it
  // into its concrete subtopics instead so there's still something specific
  // to test. Computed unconditionally (not just when no skills exist) so a
  // multi-specialization pick ("Frontend Development & Backend Development")
  // still contributes topics even when the candidate also typed focus skills.
  const specializationSubtopics = expandSpecializationSubtopics(
    String(jobRole || '').split(/&|,|\+/).map((s) => s.trim())
  );

  // Priority: candidate-typed focus skills > resume/JD-derived skills, with
  // specialization subtopics for the OTHER selected specializations appended
  // (not substituted) so every picked specialization still gets covered.
  // Previously specializationSubtopics was dropped entirely whenever any
  // explicit/resume skill existed — confirmed live: typing one focus skill
  // ("React") under a "Frontend Development & Backend Development" pick made
  // every single question target React and backend was never asked about.
  const primarySkills = explicitFocusSkills.length ? explicitFocusSkills
    : uniqueSkills.length ? uniqueSkills
    : [];
  const targetPool = [
    ...primarySkills,
    ...specializationSubtopics.filter((topic) => !primarySkills.includes(topic.toLowerCase())),
  ];

  console.log(`\n[gemmaService] 🎯 Fetching ${count} interview questions...`);
  if (targetPool.length) console.log(`[gemmaService] 📋 Target skills: ${targetPool.join(', ')}`);

  const totalCount = _forcedCount ?? count;

  // Generate questions one by one with appropriate categories
  for (let i = 0; i < count; i++) {
    const absoluteIndex = _forcedIndex !== undefined ? _forcedIndex : _startIndex + i;
    const category = _forcedCategory || resolveQuestionCategory(absoluteIndex);

    // Pin this question slot to one specific skill so the model doesn't fall back to generic phrasing.
    // Rotate through the skill list by index so each question targets a different skill.
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

    requests.push({ payload, category, absoluteIndex, targetSkill });
  }

  // Every slot is generated by the model (with per-slot retry). No batch
  // endpoint: RunPod's /generate-questions ignores per-item language, and on
  // the Colab worker it is sequential single calls anyway — so one uniform,
  // concurrency-capped path per question is both simpler and correct for both
  // languages. An unfillable slot is left with empty text; the caller fails
  // generation loudly rather than substituting a template.
  await mapWithConcurrency(requests, SOMALI_GEN_CONCURRENCY, async (req) => {
    const q = await generateValidQuestion(req.payload, language, requestTimeoutMs);
    questions.push({
      text: q.text,
      category: req.category,
      difficulty: difficulty || 'medium',
      expectedAnswer: q.expectedAnswer,
      order: req.absoluteIndex,
    });
  });

  questions.sort((a, b) => a.order - b.order);

  // De-duplicate against earlier slots by asking the MODEL again for the
  // clashing slot (passing the seen questions so the prompt steers away),
  // never by substituting a template. A slot that still clashes or comes back
  // empty is left empty so the caller fails loudly instead of shipping a repeat.
  const seen = [];
  for (const q of questions) {
    if (q.text && seen.some((s) => isSimilarQuestionText(q.text, s))) {
      const req = requests.find((r) => r.absoluteIndex === q.order);
      const retry = req
        ? await generateValidQuestion(
            { ...req.payload, rejected_question: q.text, previous_questions: seen.map((t) => ({ question: t })) },
            language,
            requestTimeoutMs,
          )
        : { text: '', expectedAnswer: '' };
      const usable = retry.text && !seen.some((s) => isSimilarQuestionText(retry.text, s));
      q.text = usable ? retry.text : '';
      q.expectedAnswer = usable ? retry.expectedAnswer : '';
    }
    if (q.text) seen.push(q.text);
  }

  logger.info(`Generated ${questions.length} questions for ${domain}/${difficulty}`);
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
    difficulty,
    difficultyLabel: toDifficultyLabel(difficulty),
    currentQuestion: currentQuestion
      ? {
          text: currentQuestion.text || '',
          id: currentQuestion.id || currentQuestion._id || '',
          expectedAnswer: currentQuestion.expectedAnswer || '',
          category: currentQuestion.category || 'general',
          difficulty: currentQuestion.difficulty || difficulty,
        }
      : {},
    roleProfile: compactRoleProfile(roleProfile),
    // Required by the Colab /score_candidate_answer adapter. The primary
    // RunPod worker can read the last conversation turn, but the Colab task
    // accepts a dedicated answer field; omitting this made every candidate
    // look as though they submitted the same empty answer.
    candidateAnswer,
  };

  logger.info(JSON.stringify({
    event: 'evaluation_request',
    questionId: payload.currentQuestion.id || null,
    language,
    category: payload.currentQuestion.category || 'general',
    answerLength: candidateAnswer.length,
    hasExpectedAnswer: Boolean(payload.currentQuestion.expectedAnswer),
  }));

  const result = await callGemma('/interview-turn', payload, 0, INTERVIEW_TURN_TIMEOUT_MS);

  const evaluation = normalizeEvaluation({
    ...(result.evaluation || {}),
    evaluationStatus: result.evaluationStatus,
  });

  const isFollowUp = Boolean(result.isFollowUp);
  const nextInterviewerResponse = isValidInterviewerResponse(result.nextInterviewerResponse, language === 'somali')
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
  isPlaceholderAnswer,
  trimConversationHistory,
  compactRoleProfile,
  normalizeEvaluation,
  parseEvaluationResponse,
  isValidGeneratedQuestion,
  isQuestionAboutTargetSkill,
  isValidInterviewerResponse,
  checkGemmaStatus,
  warmGemma,
  expandSpecializationSubtopics,
  _circuit: circuit,
};
