/**
 * Normalizes a raw evaluation object from the AI service into a consistent shape.
 *
 * Status mapping:
 *   'ok'        (Python worker success)  → 'completed'
 *   'completed' (already normalized)     → 'completed'
 *   anything else with a valid score     → 'completed'
 *   no valid score                       → 'failed'
 */
function normalizeEvaluation(raw = {}, failureFeedback = '') {
  // A valid score must be a finite number IN [0, 100]. We used to silently
  // clamp — that let hallucinated -1e6 or 500 become 0/100 and count as a
  // real answered question. In a hiring context that is unacceptable, so an
  // out-of-range score is treated as no score at all.
  const isNumber = typeof raw.score === 'number' && Number.isFinite(raw.score);
  const inRange = isNumber && raw.score >= 0 && raw.score <= 100;
  const hasValidScore = inRange;
  const incomingStatus = raw.evaluationStatus;
  const statusIsSuccess = incomingStatus === 'ok' || incomingStatus === 'completed';
  return {
    score: hasValidScore ? Math.round(raw.score * 100) / 100 : null,
    feedback: raw.feedback || failureFeedback,
    strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
    suggestedAnswer: raw.suggestedAnswer || '',
    // Mark completed only when score is valid AND status signals success.
    // Fall back to 'completed' if status is absent but score is present (backwards compat).
    evaluationStatus: hasValidScore && (statusIsSuccess || !incomingStatus) ? 'completed' : 'failed',
  };
}

/** Single source of truth: a question that should be counted in the score. */
function isScorable(question) {
  return Boolean(
    question &&
    question.isAnswered &&
    question.evaluationStatus === 'completed' &&
    typeof question.score === 'number' &&
    Number.isFinite(question.score) &&
    question.score >= 0 &&
    question.score <= 100
  );
}

/**
 * Calculates the average score across all completed, answered questions.
 * Questions with null scores (failed evaluations or pending follow-ups) are excluded.
 */
function calculateOverallScore(questions = []) {
  const evaluated = questions.filter(isScorable);
  if (!evaluated.length) return null;
  return Math.round(evaluated.reduce((sum, q) => sum + q.score, 0) / evaluated.length);
}

/**
 * Rich breakdown for pass/fail decisions and dashboards. Distinguishes
 * "candidate scored 0" from "the platform never produced a valid score".
 */
function summarizeEvaluations(questions = []) {
  const list = Array.isArray(questions) ? questions : [];
  const scorable = list.filter(isScorable);
  const failed = list.filter((q) => q && (
    q.evaluationStatus === 'failed' ||
    q.evaluationStatus === 'transcription_failed' ||
    q.evaluationStatus === 'invalid'
  ));
  const pending = list.filter((q) => q && q.evaluationStatus === 'pending');
  const overall = scorable.length
    ? Math.round(scorable.reduce((sum, q) => sum + q.score, 0) / scorable.length)
    : null;
  return {
    overallScore: overall,
    totalQuestions: list.length,
    scoredCount: scorable.length,
    failedCount: failed.length,
    pendingCount: pending.length,
    hasAnyValidScore: scorable.length > 0,
  };
}

module.exports = { normalizeEvaluation, calculateOverallScore, isScorable, summarizeEvaluations };
