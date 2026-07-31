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
  const hasValidScore = typeof raw.score === 'number' && Number.isFinite(raw.score);
  // Accept 'ok' from the Python worker as a successful evaluation status
  const incomingStatus = raw.evaluationStatus;
  const statusIsSuccess = incomingStatus === 'ok' || incomingStatus === 'completed';
  return {
    score: hasValidScore ? Math.max(0, Math.min(100, raw.score)) : null,
    feedback: raw.feedback || failureFeedback,
    strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
    suggestedAnswer: raw.suggestedAnswer || '',
    // Mark completed only when score is valid AND status signals success.
    // Fall back to 'completed' if status is absent but score is present (backwards compat).
    evaluationStatus: hasValidScore && (statusIsSuccess || !incomingStatus) ? 'completed' : 'failed',
  };
}

/**
 * Calculates the average score across all completed, answered questions.
 * Questions with null scores (failed evaluations or pending follow-ups) are excluded.
 */
function calculateOverallScore(questions = []) {
  const evaluated = questions.filter(
    (q) =>
      q.isAnswered &&
      q.evaluationStatus === 'completed' &&
      typeof q.score === 'number' &&
      Number.isFinite(q.score)
  );
  if (!evaluated.length) return null;
  return Math.round(evaluated.reduce((sum, q) => sum + q.score, 0) / evaluated.length);
}

module.exports = { normalizeEvaluation, calculateOverallScore };
