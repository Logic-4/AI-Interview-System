const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEvaluation, calculateOverallScore } = require('../utils/evaluation');

test('keeps an explicit zero as a valid completed evaluation', () => {
  const result = normalizeEvaluation({ score: 0, feedback: 'Incorrect answer' });
  assert.equal(result.score, 0);
  assert.equal(result.evaluationStatus, 'completed');
});

test('does not convert a missing model score into zero', () => {
  const result = normalizeEvaluation({}, 'Evaluation unavailable');
  assert.equal(result.score, null);
  assert.equal(result.evaluationStatus, 'failed');
});

test('overall score includes valid zeroes and excludes failed evaluations', () => {
  const score = calculateOverallScore([
    { isAnswered: true, evaluationStatus: 'completed', score: 0 },
    { isAnswered: true, evaluationStatus: 'completed', score: 80 },
    { isAnswered: true, evaluationStatus: 'failed', score: null },
  ]);
  assert.equal(score, 40);
});

test('overall score remains null when no answer was successfully evaluated', () => {
  assert.equal(calculateOverallScore([{ isAnswered: true, evaluationStatus: 'failed', score: null }]), null);
});
