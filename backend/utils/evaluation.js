/**
 * Normalizes a raw evaluation object from the AI service into a consistent shape.
 * Single source of truth — both gemmaService.processInterviewTurn and the
 * interview controller call this same function (evaluations pass through it
 * more than once in that pipeline; the logic here is idempotent).
 *
 * Status mapping:
 *   'ok'        (Python worker success)  → 'completed'
 *   'completed' (already normalized)     → 'completed'
 *   anything else with a valid score     → 'completed'
 *   no valid score, or a custom status   → 'failed'
 *   (e.g. 'placeholder') with no score      (Question.evaluationStatus is a
 *                                            strict enum — it has no slot for
 *                                            ad-hoc statuses like that)
 */
function normalizeEvaluation(raw = {}, failureFeedback = '') {
  // A valid score must be present and coerce to a finite number in [0, 100].
  // We used to silently clamp — that let hallucinated -1e6 or 500 become
  // 0/100 and count as a real answered question. In a hiring context that is
  // unacceptable, so an out-of-range (or missing) score is no score at all.
  // Number(...) tolerates a model that quoted its score ("85") without
  // weakening the range check — Number(null) is 0 and would slip through,
  // so null/undefined is excluded before coercion.
  const rawScore = raw.score != null ? Number(raw.score) : NaN;
  const hasValidScore = Number.isFinite(rawScore) && rawScore >= 0 && rawScore <= 100;
  const incomingStatus = raw.evaluationStatus;
  const statusIsSuccess = incomingStatus === 'ok' || incomingStatus === 'completed';
  const feedback = [raw.feedback, raw.reasoning, raw.actionableFeedback]
    .find((value) => typeof value === 'string' && value.trim())?.trim() || '';
  const hasCompleteEvaluation = hasValidScore && Boolean(feedback);
  const stringList = (value) => Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3)
    : [];
  return {
    score: hasCompleteEvaluation ? Math.round(rawScore) : null,
    feedback: (feedback || failureFeedback || 'AI evaluation did not return a valid score and explanation.').slice(0, 350),
    strengths: stringList(raw.strengths),
    improvements: stringList(raw.improvements || raw.missingOrIncorrect),
    suggestedAnswer: (typeof raw.suggestedAnswer === 'string' ? raw.suggestedAnswer : '').slice(0, 350),
    // Mark completed only when score is valid AND status signals success.
    // Fall back to 'completed' if status is absent but score is present (backwards compat).
    evaluationStatus: hasCompleteEvaluation && (statusIsSuccess || !incomingStatus) ? 'completed' : 'failed',
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
 * Calculates the average only when every answered question has a completed
 * evaluation. A partial average is misleading (one surviving 45 used to make
 * an entire interview appear to have scored 45).
 */
function calculateOverallScore(questions = []) {
  const answered = questions.filter((question) => question?.isAnswered);
  const evaluated = answered.filter(isScorable);
  if (!evaluated.length) return null;
  if (evaluated.length !== answered.length) return null;
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
  const answered = list.filter((q) => q?.isAnswered);
  const evaluationComplete = answered.length > 0 && scorable.length === answered.length;
  const overall = evaluationComplete
    ? Math.round(scorable.reduce((sum, q) => sum + q.score, 0) / scorable.length)
    : null;
  return {
    overallScore: overall,
    totalQuestions: list.length,
    answeredCount: answered.length,
    scoredCount: scorable.length,
    failedCount: failed.length,
    pendingCount: pending.length,
    hasAnyValidScore: scorable.length > 0,
    evaluationComplete,
  };
}

module.exports = { normalizeEvaluation, calculateOverallScore, isScorable, summarizeEvaluations };
