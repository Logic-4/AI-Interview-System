const test = require('node:test');
const assert = require('node:assert/strict');

const warmup = require('../services/interviewWarmupService');

test.afterEach(() => warmup._resetForTest());

test('deduplicates concurrent warmup calls and keeps both services ready', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const calls = { gemma: 0, speech: 0 };

  warmup._setWarmersForTest({
    gemma: async () => { calls.gemma += 1; await gate; },
    speech: async () => { calls.speech += 1; await gate; },
  });

  const first = warmup.startInterviewWarmup({ requestId: 'first' });
  const runningTask = warmup._getActiveWarmup();
  const second = warmup.startInterviewWarmup({ requestId: 'second' });

  assert.equal(first.started, true);
  assert.equal(first.status, 'warming');
  assert.equal(second.started, false);
  assert.equal(second.status, 'warming');
  assert.deepEqual(calls, { gemma: 1, speech: 1 });

  release();
  await runningTask;

  const ready = warmup.getInterviewWarmupStatus();
  assert.equal(ready.status, 'ready');
  assert.equal(ready.services.gemma.status, 'ready');
  assert.equal(ready.services.speech.status, 'ready');
  assert.ok(new Date(ready.services.gemma.readyUntil) > new Date(ready.services.gemma.completedAt));

  const cached = warmup.startInterviewWarmup({ requestId: 'within-ttl' });
  assert.equal(cached.started, false);
  assert.deepEqual(calls, { gemma: 1, speech: 1 });
});

test('reports the real provider error without hiding the healthy service', async () => {
  warmup._setWarmersForTest({
    gemma: async () => {},
    speech: async () => { throw new Error('RunPod speech worker ran out of GPU memory'); },
  });

  warmup.startInterviewWarmup({ requestId: 'failure' });
  await warmup._getActiveWarmup();

  const status = warmup.getInterviewWarmupStatus();
  assert.equal(status.status, 'failed');
  assert.equal(status.services.gemma.status, 'ready');
  assert.equal(status.services.speech.status, 'failed');
  assert.match(status.services.speech.error, /GPU memory/);
});

test('warmup controller returns 202 before provider work completes', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  warmup._setWarmersForTest({
    gemma: async () => gate,
    speech: async () => gate,
  });

  const { warmInterviewServices } = require('../controllers/interviewController');
  const response = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await warmInterviewServices(
    { requestId: 'http-202', query: {}, user: { _id: 'user-1' } },
    response,
    (error) => { throw error; }
  );

  assert.equal(response.statusCode, 202);
  assert.equal(response.body.data.warmup.status, 'warming');
  assert.equal(response.body.data.warmup.started, true);

  release();
  await warmup._getActiveWarmup();
});
