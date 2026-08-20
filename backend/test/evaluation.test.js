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

test('overall score includes valid zeroes when every answered question is evaluated', () => {
  const score = calculateOverallScore([
    { isAnswered: true, evaluationStatus: 'completed', score: 0 },
    { isAnswered: true, evaluationStatus: 'completed', score: 80 },
  ]);
  assert.equal(score, 40);
});

test('overall score remains null instead of averaging only surviving evaluations', () => {
  assert.equal(calculateOverallScore([
    { isAnswered: true, evaluationStatus: 'completed', score: 45 },
    { isAnswered: true, evaluationStatus: 'failed', score: null },
  ]), null);
});

test('overall score remains null when no answer was successfully evaluated', () => {
  assert.equal(calculateOverallScore([{ isAnswered: true, evaluationStatus: 'failed', score: null }]), null);
});

test('a failed transcription does not null the score of otherwise-scored answers', () => {
  // The exact loop bug: one unscorable transcription_failed answer used to
  // make the whole interview score null forever (feedback endpoint 400 loop).
  const score = calculateOverallScore([
    { isAnswered: true, evaluationStatus: 'completed', score: 70 },
    { isAnswered: true, evaluationStatus: 'completed', score: 90 },
    { isAnswered: true, evaluationStatus: 'transcription_failed', score: null },
    { isAnswered: true, evaluationStatus: 'invalid', score: null },
  ]);
  assert.equal(score, 80);
});

test('rejects an out-of-range hallucinated score instead of clamping it', () => {
  const result = normalizeEvaluation({ score: 5000, evaluationStatus: 'ok' });
  assert.equal(result.score, null);
  assert.equal(result.evaluationStatus, 'failed');
});

test('tolerates a quoted numeric score from the model', () => {
  const result = normalizeEvaluation({ score: '85', feedback: 'Correct concept.', evaluationStatus: 'ok' });
  assert.equal(result.score, 85);
  assert.equal(result.evaluationStatus, 'completed');
});

test('collapses a custom status like placeholder to failed (not a valid Question enum value)', () => {
  const result = normalizeEvaluation({ score: 0, feedback: 'No answer.', evaluationStatus: 'placeholder' });
  assert.equal(result.evaluationStatus, 'failed');
});

test('truncates feedback and suggestedAnswer to 350 chars, caps strengths/improvements at 3', () => {
  const long = 'x'.repeat(500);
  const result = normalizeEvaluation({
    score: 90,
    evaluationStatus: 'ok',
    feedback: long,
    suggestedAnswer: long,
    strengths: ['a', 'b', 'c', 'd'],
    improvements: ['a', 'b', 'c', 'd'],
  });
  assert.equal(result.feedback.length, 350);
  assert.equal(result.suggestedAnswer.length, 350);
  assert.equal(result.strengths.length, 3);
  assert.equal(result.improvements.length, 3);
});

test('does not accept a score without question-specific reasoning', () => {
  const result = normalizeEvaluation({ score: 78, evaluationStatus: 'ok' });
  assert.equal(result.score, null);
  assert.equal(result.evaluationStatus, 'failed');
  assert.match(result.feedback, /valid score and explanation/i);
});
