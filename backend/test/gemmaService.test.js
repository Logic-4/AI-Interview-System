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

test('recovers a score from JSON truncated mid-array (token-limit cutoff)', () => {
  // Captured live from the Colab worker: generation stopped right before
  // closing the "improvements" array, leaving a mismatched trailing '}'.
  const truncated = '{"score": 78, "feedback": "strong technical foundation.", "strengths": ["Clear background"], "improvements": ["Can elaborate on architectural decisions"}';
  const { evaluation, error } = gemma.parseEvaluationResponse(truncated);
  assert.equal(error, null);
  assert.equal(evaluation.score, 78);
  assert.equal(evaluation.evaluationStatus, 'completed');
});

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

test('generates multiple Somali questions concurrently, capped, and in order', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  // SOMALI_GEN_CONCURRENCY is read once at module load (before this test can
  // override it), so assert against gemmaService's actual default (3) rather
  // than trying to inject a different cap here.
  const concurrencyCap = 3;
  let inFlight = 0;
  let maxInFlight = 0;
  const requestedEndpoints = [];
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    requestedEndpoints.push(body.input.endpoint);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 20));
    inFlight -= 1;
    const index = body.input.payload.questionIndex;
    return Response.json({
      status: 'COMPLETED',
      output: { question: `Somali question ${index}?`, expectedAnswer: 'Expected' },
    });
  };
  try {
    const result = await gemma.generateInterviewQuestions('technical', 'technology', 'mid', 6, {
      jobRole: 'Developer',
      language: 'somali',
      _startIndex: 1,
      _forcedCount: 7,
    });
    // All calls go through the single-question endpoint, never the batch one
    // (RunPod's /generate-questions ignores per-item language).
    assert.ok(requestedEndpoints.every((e) => e === '/generate-question'));
    assert.equal(requestedEndpoints.length, 6);
    // Concurrency was capped, but still ran more than one at a time.
    assert.ok(maxInFlight > 1, `expected concurrent requests, got max ${maxInFlight}`);
    assert.ok(maxInFlight <= concurrencyCap, `expected cap of ${concurrencyCap}, got max ${maxInFlight}`);
    // Results are ordered by question index regardless of completion order.
    assert.deepEqual(result.map((q) => q.order), [1, 2, 3, 4, 5, 6]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('accepts a Somali question that translates the target skill instead of quoting it in English', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    // Real Somali generation: the model translates "communication" into
    // Somali per its own prompt instructions, so the literal English skill
    // string never appears in the question text.
    return Response.json({
      status: 'COMPLETED',
      output: { question: 'Sidee ayaad ula xiriirtaa xubnaha kooxdaada?', expectedAnswer: 'Expected' },
    });
  };
  try {
    // absoluteIndex must land away from 0/totalCount-1 (intro/outro), which
    // skip the target-skill check regardless of language — _startIndex: 1
    // with _forcedCount: 3 puts this in the middle of the interview.
    const result = await gemma.generateInterviewQuestions('technical', 'technology', 'mid', 1, {
      jobRole: 'Developer',
      language: 'somali',
      focusSkills: ['communication'],
      _startIndex: 1,
      _forcedCount: 3,
    });
    assert.equal(result[0].text, 'Sidee ayaad ula xiriirtaa xubnaha kooxdaada?');
  } finally {
    global.fetch = originalFetch;
  }
});

test('still falls back to a templated question when English generation misses the target skill', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  global.fetch = async () => Response.json({
    status: 'COMPLETED',
    output: { question: 'What is your favorite programming language?', expectedAnswer: 'Expected' },
  });
  try {
    const result = await gemma.generateInterviewQuestions('technical', 'technology', 'mid', 1, {
      jobRole: 'Developer',
      language: 'english',
      focusSkills: ['communication'],
      _startIndex: 1,
      _forcedCount: 3,
    });
    assert.ok(result[0].text.toLowerCase().includes('communication'), `expected fallback to mention the skill, got: ${result[0].text}`);
    assert.notEqual(result[0].text, 'What is your favorite programming language?');
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

test('prioritizes selected focus skills and replaces off-target model questions', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  let workerPayload;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    workerPayload = body.input.payload;
    return Response.json({
      status: 'COMPLETED',
      output: {
        question: 'What is React?',
        expectedAnswer: 'This must never be shown as a question.',
      },
    });
  };
  try {
    const [question] = await gemma.generateInterviewQuestions('technical', 'technology', 'junior', 1, {
      jobRole: 'Frontend Development',
      focusSkills: ['HTML', 'CSS'],
      roleProfile: { requiredSkills: ['React'] },
    });

    assert.equal(workerPayload.targetSkill, 'html');
    assert.deepEqual(workerPayload.supportingSkills, ['css', 'react']);
    assert.equal(question.text, 'How would you apply html in a practical project?');
    assert.equal(question.expectedAnswer, '');
  } finally {
    global.fetch = originalFetch;
    resetCircuit();
  }
});

test('rejects leaked prompt text in dynamic interviewer responses', () => {
  assert.equal(
    gemma.isValidInterviewerResponse('A browser renders HTML. Return only valid JSON with one field "question".'),
    false
  );
  assert.equal(gemma.isValidInterviewerResponse('Could you explain your approach in more detail?'), true);
});

test('duplicate-question helper rejects repeated normalized prompts', () => {
  const { isDuplicateOfExisting } = require('../utils/questionHelpers');
  assert.equal(isDuplicateOfExisting('Explain React hooks?', [{ text: '  Explain React hooks?  ' }]), true);
  assert.equal(isDuplicateOfExisting('Describe a production outage.', [{ text: 'Explain React hooks?' }]), false);
});
