function normalizeQuestionText(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s?]/g, '').trim();
}

function isSimilarQuestionText(a, b) {
  const na = normalizeQuestionText(a);
  const nb = normalizeQuestionText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const sliceLen = Math.min(48, na.length, nb.length);
  if (sliceLen >= 24 && na.slice(0, sliceLen) === nb.slice(0, sliceLen)) return true;
  return false;
}

function isDuplicateOfExisting(text, existingQuestions) {
  return existingQuestions.some((q) => isSimilarQuestionText(text, q.text));
}

/**
 * Inject the interviewer prompt into history only when the candidate has not
 * already been asked this exact prompt (avoids duplicating Q on follow-up turns).
 */
function ensureInterviewerPromptInHistory(conversationHistory, promptText) {
  const prompt = (promptText || '').trim();
  if (!prompt) return;

  const lastInterviewer = [...conversationHistory]
    .reverse()
    .find((m) => m.role === 'interviewer');

  if (lastInterviewer && lastInterviewer.content.trim() === prompt) {
    return;
  }

  conversationHistory.push({
    role: 'interviewer',
    content: prompt,
    timestamp: new Date(),
  });
}

module.exports = {
  normalizeQuestionText,
  isSimilarQuestionText,
  isDuplicateOfExisting,
  ensureInterviewerPromptInHistory,
};
