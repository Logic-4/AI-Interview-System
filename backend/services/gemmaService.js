const logger = require('../utils/logger');
const SystemConfig = require('../models/SystemConfig');
const { isSimilarQuestionText } = require('../utils/questionHelpers');
const { normalizeEvaluation } = require('../utils/evaluation');

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
// Scoring one already-recorded answer doesn't need the same budget as a
// cold-start question-generation call — a tighter timeout here keeps the
// worst case under the frontend's per-call submitAnswer timeout.
const INTERVIEW_TURN_TIMEOUT_MS = Number(process.env.INTERVIEW_TURN_TIMEOUT_MS || 45000);
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

function isQuestionAboutTargetSkill(question, targetSkill) {
  if (!targetSkill) return true;
  return String(question).toLowerCase().includes(String(targetSkill).toLowerCase());
}

// Reject any response that has zero Somali function-word signal. Blacklisting
// English starters missed real-world worker output like "Open Mock Interview
// Session..." (task-name echo) and "Please tell me..." / "Today we'll...".
// A positive-signal check is much more robust: real Somali has at least one
// of these tokens within the first ~20 words. If none appear, treat as not
// Somali regardless of what English starter it opens with.
const SOMALI_TOKEN_RE = /\b(waa|ma|iyo|oo|ah|ku|la|ka|aad|aan|waxaan|waxaa|waxaad|sidee|sida|maxaad|maxaa|xaggee|xaggeed|ayaad|khibrad|noo|tusaale|sharax|kartaa|leedahay|adeegsan|ula|marka|markaad|shaqada|shaqo)\b/i;
function looksSomali(text) {
  return SOMALI_TOKEN_RE.test(String(text || '').slice(0, 400));
}
function looksEnglish(text) {
  // Kept for backwards compatibility with callers — a Somali response with
  // no Somali signal is treated as English (the concrete failure mode we hit
  // when the fine-tuned worker echoes English task-name text instead of a
  // real Somali question).
  return !looksSomali(text);
}

// 12 templates each (doubled from 6) so a full-length interview has more
// room before it has to repeat one verbatim — see buildQuestionFallback.
const FALLBACK_TEMPLATES_EN = [
  (s) => `How would you apply ${s} in a practical project?`,
  (s) => `What challenges have you faced working with ${s}?`,
  (s) => `Can you describe a real-world scenario where ${s} was critical to the outcome?`,
  (s) => `How do you stay current with best practices in ${s}?`,
  (s) => `Walk me through your approach to debugging an issue related to ${s}.`,
  (s) => `What trade-offs do you consider when using ${s}?`,
  (s) => `What's a mistake you made early on with ${s}, and what did it teach you?`,
  (s) => `How would you explain ${s} to a junior teammate who's never used it?`,
  (s) => `What tools or resources do you rely on most when working with ${s}?`,
  (s) => `How do you decide when ${s} is the right choice versus an alternative?`,
  (s) => `What does a well-designed solution involving ${s} look like to you?`,
  (s) => `Tell me about a time you had to optimize something related to ${s}.`,
];
const FALLBACK_TEMPLATES_SO = [
  (s) => `Sidee ayaad ${s} ugu adeegsan lahayd mashruuc dhab ah?`,
  (s) => `Waa maxay caqabadaha ugu waaweyn ee aad la kulantay markaad la shaqeynaysay ${s}?`,
  (s) => `Ma tusaale ka bixin kartaa xaalad ${s} muhiim ku ahayd natiijadeeda?`,
  (s) => `Sidee ayaad ula socotaa horumarka cusub ee ${s}?`,
  (s) => `Sidee ayaad u xallisaa cilladaha la xiriira ${s}?`,
  (s) => `Maxaa muhiim ah oo aad tixgelisid markaad isticmaalayso ${s}?`,
  (s) => `Waa maxay khalad aad samaysay markii aad bilowday inaad isticmaasho ${s}, maxaadna ka bartay?`,
  (s) => `Sidee ayaad ${s} ugu sharxi lahayd qof cusub oo aan weligiis isticmaalin?`,
  (s) => `Waa maxay qalabka ama agabka aad ugu isticmaasho ${s}?`,
  (s) => `Sidee ayaad u go'aamisaa marka ${s} ay tahay xulashada saxda ah?`,
  (s) => `Sideed u qeexi lahayd xalka wanaagsan ee ku lug leh ${s}?`,
  (s) => `Noo sheeg mar aad u baahatay inaad hagaajiso wax la xiriira ${s}.`,
];

// Deterministic per-slot template pick instead of a module-level shared
// counter (the old design leaked state across concurrent interviews AND
// still repeated within one interview after 6 slots — a real 30-minute,
// single-specialization interview asked "Walk me through your approach to
// debugging an issue related to cybersecurity" twice, verbatim, in live
// testing). `index` should be the question's own position so two different
// interviews generating concurrently never interfere with each other.
function buildQuestionFallback({ targetSkill, jobRole, domain, language, index = 0 }) {
  const subject = targetSkill || jobRole || domain || 'this field';
  const isSomali = String(language).toLowerCase() === 'somali';
  const templates = isSomali ? FALLBACK_TEMPLATES_SO : FALLBACK_TEMPLATES_EN;
  return templates[((index % templates.length) + templates.length) % templates.length](subject);
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
    const requests = Array.isArray(payload?.requests) ? payload.requests : [];
    const generatedQuestions = [];
    for (const req of requests) {
      const singleQ = await callColabRunsyncFallback(gemmaUrl, '/generate-question', req, timeoutMs);
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
      interview_type: payload?.type || 'technical',
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

  if (endpoint === '/generate-question') {
    return {
      question: rawText,
      expectedAnswer: `Candidate explains core concepts for ${runsyncBody.payload.specialization}.`,
      category: payload?.category || 'conceptual',
      difficulty: payload?.difficulty || 'medium',
    };
  }

  if (endpoint === '/interview-turn') {
    const isSomali = (payload?.language || '').toLowerCase() === 'somali';
    const { evaluation, error: parseError } = parseEvaluationResponse(rawText);

    const logEvaluation = parseError ? logger.warn.bind(logger) : logger.info.bind(logger);
    logEvaluation(JSON.stringify({
      event: 'colab_score_parsed',
      task: 'score_candidate_answer',
      score: evaluation.score,
      evaluationStatus: evaluation.evaluationStatus,
      parseError: parseError?.message || null,
      rawResponsePreview: IS_PROD ? undefined : rawText.slice(0, 500),
    }));

    return {
      evaluation,
      nextInterviewerResponse: isSomali
        ? 'Mahadsanid. Aan u gudubno mawduuca xiga.'
        : 'Thank you. Let us move on to the next question.',
      isFollowUp: false,
      isTopicComplete: true,
      evaluationStatus: evaluation.score !== null ? 'ok' : 'failed',
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
  const singleRequests = [];

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

    // ponytail: RunPod's batch endpoint (/generate-questions) doesn't respect
    // per-item language, so Somali always fell through to English. The single
    // /generate-question call below is proven to honor language — use it for
    // every question when Somali instead of batching.
    if (count > 1 && String(language).toLowerCase() !== 'somali') {
      batchRequests.push({ payload, category, absoluteIndex });
      continue;
    }

    singleRequests.push({ payload, category, absoluteIndex, targetSkill });
  }

  if (singleRequests.length) {
    // Somali (or a lone single-question call) — these can't use the batch
    // endpoint, so run them through a concurrency-capped runner instead of
    // one at a time. For a single request this is equivalent to a plain await.
    await mapWithConcurrency(singleRequests, SOMALI_GEN_CONCURRENCY, async (req) => {
      const result = await callGemma('/generate-question', req.payload, 0, requestTimeoutMs || TIMEOUT_MS);
      const qText = result.question || result.text || '';

      const isIntroOutro = req.category === 'intro' || req.category === 'outro';
      const isSomali = String(language).toLowerCase() === 'somali';
      // ponytail: used to also gate on isQuestionAboutTargetSkill(qText, req.targetSkill)
      // (a literal substring match) — that rejected genuinely on-topic model
      // questions that just didn't repeat the skill name verbatim ("What
      // techniques improve SPA performance?" for "frontend development"),
      // discarding ~94% of real generated questions in live testing. Shape
      // and language validity are enough; trust the prompt's own targetSkill
      // instruction to keep the model on-topic.
      const isValidQuestion = isValidGeneratedQuestion(qText)
        && !(isSomali && looksEnglish(qText));
      if (isValidQuestion) {
        questions.push({
          text: qText.trim(),
          category: req.category,
          difficulty: difficulty || 'medium',
          expectedAnswer: result.expectedAnswer || result.expected_answer || result.answer || '',
          order: req.absoluteIndex,
        });
      } else {
        // Log why we're throwing away model output so the next test run tells
        // us whether the worker returned English (looksSomali=false), invalid
        // shape (isValidGeneratedQuestion=false), or off-target text.
        logger.warn(JSON.stringify({
          event: 'somali_question_rejected',
          category: req.category,
          absoluteIndex: req.absoluteIndex,
          targetSkill: req.targetSkill,
          isSomaliInterview: isSomali,
          shapeValid: isValidGeneratedQuestion(qText),
          looksSomali: isSomali ? looksSomali(qText) : null,
          matchesTargetSkill: req.targetSkill
            ? isQuestionAboutTargetSkill(qText, req.targetSkill)
            : null,
          rawTextPreview: String(qText || '').slice(0, 200),
        }));
        if (isIntroOutro) {
          // Model output unusable — let the caller's dedicated fallback handle this
          questions.push({
            text: '',
            category: req.category,
            difficulty: difficulty || 'medium',
            expectedAnswer: '',
            order: req.absoluteIndex,
          });
        } else {
          questions.push({
            text: buildQuestionFallback({ targetSkill: req.targetSkill, jobRole, domain, language, index: req.absoluteIndex }),
            category: req.category,
            difficulty: difficulty || 'medium',
            expectedAnswer: '',
            order: req.absoluteIndex,
          });
        }
      }
    });
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
      // ponytail: see the matching note in the single-request path above —
      // the literal isQuestionAboutTargetSkill substring check is dropped.
      const isValidQuestion = isValidGeneratedQuestion(qText);
      questions.push({
        text: isValidQuestion
          ? qText.trim()
          : isIntroOutro ? '' : buildQuestionFallback({ targetSkill, jobRole, domain, language, index: meta.absoluteIndex }),
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
      q.text = buildQuestionFallback({ targetSkill: altSkill, jobRole, domain, language, index: q.order + seen.length + 6 });
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
    interviewType: type,
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
  _circuit: circuit,
};
