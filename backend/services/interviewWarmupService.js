const logger = require('../utils/logger');
const { warmGemma } = require('./gemmaService');
const { warmSpeechService } = require('./somaliSpeechService');

// This is an application freshness hint, not proof that a zero-active-worker
// RunPod endpoint is still alive. Live interviews use forced heartbeats.
const WARM_TTL_MS = Math.max(60_000, Number(process.env.INTERVIEW_WARM_TTL_MS || 2 * 60 * 1000));

const createServiceState = () => ({
  status: 'idle',
  variant: null,
  startedAt: null,
  completedAt: null,
  readyUntil: null,
  error: '',
});

const state = {
  gemma: createServiceState(),
  speech: createServiceState(),
};

let activeWarmup = null;
let warmers = {
  gemma: warmGemma,
  speech: warmSpeechService,
};

function expireStaleServices(now = Date.now()) {
  for (const service of Object.values(state)) {
    if (service.status === 'ready' && service.readyUntil && new Date(service.readyUntil).getTime() <= now) {
      Object.assign(service, createServiceState());
    }
  }
}

function snapshot() {
  expireStaleServices();
  const services = JSON.parse(JSON.stringify(state));
  const values = Object.values(services);
  let status = 'idle';
  if (values.some((service) => service.status === 'warming')) status = 'warming';
  else if (values.every((service) => service.status === 'ready')) status = 'ready';
  else if (values.some((service) => service.status === 'failed')) status = 'failed';

  return {
    status,
    ttlMs: WARM_TTL_MS,
    services,
  };
}

async function runServiceWarmup(name, requestId, language) {
  const service = state[name];
  const startedAt = Date.now();
  service.status = 'warming';
  service.startedAt = new Date(startedAt).toISOString();
  service.completedAt = null;
  service.readyUntil = null;
  service.error = '';

  try {
    await warmers[name](requestId, language);
    const completedAt = Date.now();
    service.status = 'ready';
    service.variant = name === 'speech' ? language : null;
    service.completedAt = new Date(completedAt).toISOString();
    service.readyUntil = new Date(completedAt + WARM_TTL_MS).toISOString();
    logger.info(JSON.stringify({
      event: 'interview_service_warmup_complete',
      service: name,
      requestId,
      totalMs: completedAt - startedAt,
    }));
  } catch (error) {
    service.status = 'failed';
    service.completedAt = new Date().toISOString();
    service.error = String(error?.message || error).slice(0, 300);
    logger.warn(JSON.stringify({
      event: 'interview_service_warmup_failed',
      service: name,
      requestId,
      totalMs: Date.now() - startedAt,
      message: service.error,
    }));
  }
}

function startInterviewWarmup({ requestId = 'interview-warmup', force = false, language = 'all' } = {}) {
  const normalizedLanguage = ['english', 'somali'].includes(String(language).toLowerCase())
    ? String(language).toLowerCase()
    : 'all';
  expireStaleServices();
  if (activeWarmup) return { started: false, ...snapshot() };

  const names = Object.keys(state).filter((name) => (
    force
    || state[name].status !== 'ready'
    || (name === 'speech' && state[name].variant !== normalizedLanguage)
  ));
  if (!names.length) return { started: false, ...snapshot() };

  for (const name of names) {
    state[name].status = 'warming';
    state[name].error = '';
  }

  activeWarmup = Promise.all(names.map((name) => runServiceWarmup(name, requestId, normalizedLanguage)))
    .finally(() => {
      activeWarmup = null;
    });

  return { started: true, ...snapshot() };
}

function getInterviewWarmupStatus() {
  return snapshot();
}

function resetForTest() {
  Object.assign(state.gemma, createServiceState());
  Object.assign(state.speech, createServiceState());
  activeWarmup = null;
  warmers = { gemma: warmGemma, speech: warmSpeechService };
}

module.exports = {
  startInterviewWarmup,
  getInterviewWarmupStatus,
  _getActiveWarmup: () => activeWarmup,
  _setWarmersForTest: (nextWarmers) => { warmers = nextWarmers; },
  _resetForTest: resetForTest,
};
