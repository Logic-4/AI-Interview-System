const test = require('node:test');
const assert = require('node:assert/strict');

process.env.RUNPOD_API_URL = 'https://api.runpod.ai/v2/test-endpoint';
process.env.RUNPOD_API_KEY = 'test-key';
process.env.GEMMA_CIRCUIT_OPEN_MS = '60000';

const gemma = require('../services/gemmaService');

function resetCircuit() {
  gemma._circuit.failures = 0;
  gemma._circuit.openUntil = 0;
  gemma._circuit.reason = '';
}

test('uses one worker request for a batch of later questions', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    return Response.json({
      status: 'COMPLETED',
      output: {
        questions: body.input.payload.requests.map((item, index) => ({
          question: `Question ${index + 1} about ${item.category}?`,
          expectedAnswer: 'Expected',
        })),
      },
    });
  };
  try {
    const result = await gemma.generateInterviewQuestions('technical', 'technology', 'mid', 4, {
      jobRole: 'React developer',
      language: 'english',
      _startIndex: 1,
      _forcedCount: 5,
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].input.endpoint, '/generate-questions');
    assert.deepEqual(result.map((question) => question.order), [1, 2, 3, 4]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('opens the model circuit immediately for a missing endpoint', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ detail: 'endpoint not found' }), { status: 404 });
  };
  try {
    await assert.rejects(
      gemma.generateInterviewQuestions('technical', 'technology', 'mid', 1, { jobRole: 'Developer' }),
      /404/
    );
    await assert.rejects(
      gemma.generateInterviewQuestions('technical', 'technology', 'mid', 1, { jobRole: 'Developer' }),
      (error) => error.code === 'GEMMA_CIRCUIT_OPEN'
    );
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
    resetCircuit();
  }
});

test('passes structured resume, title, skills, and timing context to question generation', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  let workerPayload;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    workerPayload = body.input.payload;
    return Response.json({
      status: 'COMPLETED',
      output: { question: 'How did you apply Node.js in your payments project?', expectedAnswer: 'Project evidence' },
    });
  };
  try {
    await gemma.generateInterviewQuestions('technical', 'finance', 'senior', 1, {
      title: 'Senior Payments Engineer',
      jobRole: 'Backend Engineer',
      duration: 45,
      scheduledAt: '2026-08-01T09:00:00.000Z',
      focusSkills: ['Node.js'],
      jobDescription: 'Build reliable payment services.',
      resumeText: 'Built a payment reconciliation service.',
      roleProfile: {
        requiredSkills: ['Node.js'],
        candidateSkills: ['PostgreSQL'],
        candidateExperience: ['Led payment reconciliation delivery'],
        candidateProjects: ['Settlement monitoring platform'],
      },
    });

    assert.equal(workerPayload.interviewTitle, 'Senior Payments Engineer');
    assert.equal(workerPayload.durationMinutes, 45);
    assert.equal(workerPayload.scheduledAt, '2026-08-01T09:00:00.000Z');
    assert.deepEqual(workerPayload.candidateExperience, ['Led payment reconciliation delivery']);
    assert.deepEqual(workerPayload.candidateProjects, ['Settlement monitoring platform']);
    assert.deepEqual(workerPayload.skills.sort(), ['node.js', 'postgresql']);
    assert.match(workerPayload.resumeText, /reconciliation/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('duplicate-question helper rejects repeated normalized prompts', () => {
  const { isDuplicateOfExisting } = require('../utils/questionHelpers');
  assert.equal(isDuplicateOfExisting('Explain React hooks?', [{ text: '  Explain React hooks?  ' }]), true);
  assert.equal(isDuplicateOfExisting('Describe a production outage.', [{ text: 'Explain React hooks?' }]), false);
});
