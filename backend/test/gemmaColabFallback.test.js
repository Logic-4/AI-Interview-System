const test = require('node:test');
const assert = require('node:assert/strict');

// Deliberately NOT api.runpod.ai — this is the "Colab dev tier" URL shape
// (see .env's OPTION A), which routes /interview-turn through
// callColabRunsyncFallback instead of callRunPod. getGemmaBaseUrl() reads
// this once at module load, so it must be set before requiring the service.
process.env.GEMMA_API_URL = 'https://example-colab-tunnel.ngrok-free.dev';
delete process.env.RUNPOD_API_URL;
process.env.GEMMA_CIRCUIT_OPEN_MS = '60000';

const gemma = require('../services/gemmaService');
const { calculateOverallScore } = require('../utils/evaluation');

function resetCircuit() {
  gemma._circuit.failures = 0;
  gemma._circuit.openUntil = 0;
  gemma._circuit.reason = '';
}

function mockFetch({ score, feedback, inspectPayload }) {
  return async (url, options) => {
    const u = String(url);
    if (u.endsWith('/interview-turn')) {
      // The direct custom-endpoint POST 404s on a generic Colab runsync
      // router — this is what triggers callColabRunsyncFallback.
      return new Response(JSON.stringify({ detail: 'not found' }), { status: 404 });
    }
    if (u.endsWith('/runsync')) {
      const body = JSON.parse(options.body);
      assert.equal(body.endpoint, '/score_candidate_answer');
      inspectPayload?.(body.payload);
      return Response.json({
        output: { response: JSON.stringify({ score, feedback, strengths: [], improvements: [], suggestedAnswer: '' }) },
      });
    }
    throw new Error(`Unexpected fetch to ${u}`);
  };
}

test('Colab fallback: a well-formed score/feedback pair is parsed through', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  global.fetch = mockFetch({
    score: 78,
    feedback: 'Solid grasp of the core concept, missed one edge case.',
    inspectPayload(payload) {
      assert.equal(payload.question, 'What is a closure?');
      assert.equal(payload.answer, 'A function bundled with its lexical scope.');
      assert.equal(payload.expected_answer, 'A closure retains access to its lexical scope.');
      assert.equal(payload.category, 'core skills');
    },
  });
  try {
    const result = await gemma.processInterviewTurn(
      [{ role: 'interviewer', content: 'What is a closure?' }],
      'engineering', 'Backend Engineer', 'english',
      {
        currentQuestion: {
          text: 'What is a closure?',
          expectedAnswer: 'A closure retains access to its lexical scope.',
          category: 'core skills',
        },
        candidateAnswer: 'A function bundled with its lexical scope.',
      }
    );
    assert.equal(result.evaluation.score, 78);
    assert.equal(result.evaluation.evaluationStatus, 'completed');
    assert.match(result.evaluation.feedback, /edge case/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Colab fallback: an out-of-range hallucinated score is rejected, not clamped', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  global.fetch = mockFetch({ score: 99999, feedback: 'Great answer!' });
  try {
    const result = await gemma.processInterviewTurn(
      [{ role: 'interviewer', content: 'What is a closure?' }],
      'engineering', 'Backend Engineer', 'english',
      { currentQuestion: { text: 'What is a closure?' }, candidateAnswer: 'A function bundled with its lexical scope.' }
    );
    // Must NOT silently become 100 (clamped) — a wild hallucination is unscored.
    assert.equal(result.evaluation.score, null);
    assert.equal(result.evaluation.evaluationStatus, 'failed');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Colab fallback: unparseable output is not displayed as candidate feedback or given a score', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    const u = String(url);
    if (u.endsWith('/interview-turn')) return new Response(JSON.stringify({ detail: 'not found' }), { status: 404 });
    if (u.endsWith('/runsync')) {
      return Response.json({ output: { response: 'The candidate demonstrated a reasonable understanding overall.' } });
    }
    throw new Error(`Unexpected fetch to ${u}`);
  };
  try {
    const result = await gemma.processInterviewTurn(
      [{ role: 'interviewer', content: 'What is a closure?' }],
      'engineering', 'Backend Engineer', 'english',
      { currentQuestion: { text: 'What is a closure?' }, candidateAnswer: 'A function bundled with its lexical scope.' }
    );
    assert.equal(result.evaluation.score, null);
    assert.match(result.evaluation.feedback, /could not be parsed/i);
    assert.doesNotMatch(result.evaluation.feedback, /reasonable understanding/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Colab fallback keeps five different answers and their evaluations independent', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  const fixtures = new Map([
    ['excellent answer', 94],
    ['correct but incomplete answer', 76],
    ['partially correct answer', 53],
    ['incorrect answer', 18],
    ['irrelevant answer', 4],
  ]);
  global.fetch = async (url, options) => {
    const u = String(url);
    if (u.endsWith('/interview-turn')) return new Response('{}', { status: 404 });
    const { payload } = JSON.parse(options.body);
    const score = fixtures.get(payload.answer);
    return Response.json({
      output: {
        response: JSON.stringify({
          score,
          feedback: `Feedback for: ${payload.answer}`,
          strengths: score >= 70 ? ['Relevant concept'] : [],
          improvements: score < 70 ? ['Correct the missing concept'] : [],
          suggestedAnswer: 'A stronger answer.',
        }),
      },
    });
  };

  try {
    const scores = [];
    for (const answer of fixtures.keys()) {
      const result = await gemma.processInterviewTurn(
        [{ role: 'interviewer', content: 'Explain the concept.' }],
        'engineering', 'Engineer', 'english',
        { currentQuestion: { text: 'Explain the concept.' }, candidateAnswer: answer }
      );
      scores.push(result.evaluation.score);
      assert.equal(result.evaluation.feedback, `Feedback for: ${answer}`);
    }
    assert.deepEqual(scores, [94, 76, 53, 18, 4]);
    assert.equal(calculateOverallScore(scores.map((score) => ({
      isAnswered: true,
      evaluationStatus: 'completed',
      score,
    }))), 49);
  } finally {
    global.fetch = originalFetch;
  }
});

// The Colab path used to hardcode isFollowUp:false and a canned
// nextInterviewerResponse, so a follow-up could never fire no matter what the
// model decided — a partial answer was always accepted and moved past.
test('Colab fallback: the model\'s follow-up decision is honoured, not hardcoded', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    const u = String(url);
    if (u.endsWith('/interview-turn')) {
      return new Response(JSON.stringify({ detail: 'not found' }), { status: 404 });
    }
    if (u.endsWith('/runsync')) {
      assert.equal(JSON.parse(options.body).endpoint, '/score_candidate_answer');
      return Response.json({
        output: {
          response: JSON.stringify({
            score: 55,
            feedback: 'Partly right — named the mechanism but not the trade-off.',
            strengths: ['Named the mechanism'],
            improvements: ['Cover the write-cost trade-off'],
            suggestedAnswer: 'An index trades write cost for read speed.',
            isFollowUp: true,
            nextInterviewerResponse: 'What does that cost you on writes?',
          }),
        },
      });
    }
    throw new Error(`Unexpected fetch to ${u}`);
  };
  try {
    const result = await gemma.processInterviewTurn(
      [{ role: 'interviewer', content: 'What is a database index?' }],
      'engineering', 'Backend Engineer', 'english',
      { currentQuestion: { text: 'What is a database index?' }, candidateAnswer: 'It makes lookups faster.' }
    );
    assert.equal(result.isFollowUp, true, 'model asked for a follow-up but it was dropped');
    assert.equal(result.nextInterviewerResponse, 'What does that cost you on writes?');
    assert.equal(result.evaluation.score, 55);
  } finally {
    global.fetch = originalFetch;
  }
});

// The real fine-tuned /score_candidate_answer task names these fields
// needsFollowUp/followUpTarget (not isFollowUp/nextInterviewerResponse). If the
// adapter only reads the latter, follow-ups never fire on the live path.
test('Colab fallback: honours the notebook\'s needsFollowUp/followUpTarget fields', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith('/interview-turn')) {
      return new Response(JSON.stringify({ detail: 'not found' }), { status: 404 });
    }
    if (u.endsWith('/runsync')) {
      return Response.json({
        output: {
          response: JSON.stringify({
            score: 55,
            feedback: 'Named the mechanism but not the trade-off.',
            needsFollowUp: true,
            followUpTarget: 'the write-cost trade-off',
          }),
        },
      });
    }
    throw new Error(`Unexpected fetch to ${u}`);
  };
  try {
    const result = await gemma.processInterviewTurn(
      [{ role: 'interviewer', content: 'What is a database index?' }],
      'engineering', 'Backend Engineer', 'english',
      { currentQuestion: { text: 'What is a database index?' }, candidateAnswer: 'It makes lookups faster.' }
    );
    assert.equal(result.isFollowUp, true, 'needsFollowUp:true was dropped');
    assert.match(result.nextInterviewerResponse, /write-cost trade-off/);
    assert.equal(result.evaluation.score, 55);
  } finally {
    global.fetch = originalFetch;
  }
});

// A follow-up off an evaluation we could not grade would loop the candidate on
// a question that never scored, so it must be suppressed.
test('Colab fallback: no follow-up is asked when the evaluation itself failed', async () => {
  resetCircuit();
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith('/interview-turn')) {
      return new Response(JSON.stringify({ detail: 'not found' }), { status: 404 });
    }
    if (u.endsWith('/runsync')) {
      return Response.json({
        output: { response: JSON.stringify({ score: null, feedback: '', isFollowUp: true, nextInterviewerResponse: 'Tell me more?' }) },
      });
    }
    throw new Error(`Unexpected fetch to ${u}`);
  };
  try {
    const result = await gemma.processInterviewTurn(
      [{ role: 'interviewer', content: 'What is a database index?' }],
      'engineering', 'Backend Engineer', 'english',
      { currentQuestion: { text: 'What is a database index?' }, candidateAnswer: 'It makes lookups faster.' }
    );
    assert.equal(result.evaluation.evaluationStatus, 'failed');
    assert.equal(result.isFollowUp, false, 'asked a follow-up off an ungraded turn');
  } finally {
    global.fetch = originalFetch;
  }
});
