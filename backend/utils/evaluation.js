function normalizeEvaluation(raw = {}, failureFeedback = '') {
  const hasValidScore = typeof raw.score === 'number' && Number.isFinite(raw.score);
  return {
    score: hasValidScore ? Math.max(0, Math.min(100, raw.score)) : null,
    feedback: raw.feedback || failureFeedback,
    strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
    suggestedAnswer: raw.suggestedAnswer || '',
    evaluationStatus: hasValidScore ? 'completed' : 'failed',
  };
}

function calculateOverallScore(questions = []) {
  const evaluated = questions.filter((question) =>
    question.isAnswered &&
    question.evaluationStatus === 'completed' &&
    typeof question.score === 'number' &&
    Number.isFinite(question.score)
  );
  if (!evaluated.length) return null;
  return Math.round(evaluated.reduce((sum, question) => sum + question.score, 0) / evaluated.length);
}

module.exports = { normalizeEvaluation, calculateOverallScore };
