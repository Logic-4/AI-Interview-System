const DIFFICULTY_LABELS = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
};

/**
 * Job.experienceLevel is already the junior/mid/senior/lead enum used
 * throughout the app (Interview.difficulty, Question.difficulty). We reuse
 * it directly rather than introducing a separate numeric years field —
 * this just derives the display label the fine-tuned model's prompt expects.
 */
function deriveDifficulty(experienceLevel) {
  const difficulty = (experienceLevel || 'mid').toLowerCase();
  return {
    difficulty,
    difficultyLabel: DIFFICULTY_LABELS[difficulty] || 'Mid',
  };
}

/**
 * Aggregates a Job posting + an Application's parsed resume into the
 * structured context consumed by services/gemmaService.js
 * (generateInterviewQuestions's `context` param and parseJobDescription),
 * and by Interview.create() when scheduling an interview from an application.
 */
function buildInterviewPayload(job, application = null) {
  if (!job) {
    throw new Error('buildInterviewPayload requires a Job document');
  }

  const { difficulty, difficultyLabel } = deriveDifficulty(job.experienceLevel);
  const focusSkills = job.focusSkills?.length ? job.focusSkills : (job.requiredSkills || []);

  return {
    // Interview.create() fields
    type: job.interviewType || 'mixed',
    difficulty,
    language: (job.interviewLanguage || 'English').toLowerCase(),
    jobRole: job.targetJobRole || job.title,
    title: job.title,
    jobDescription: job.description || '',
    focusSkills,
    duration: job.durationMinutes,

    // Job-derived interview configuration
    numberOfQuestions: job.numberOfQuestions,
    passingScoreThreshold: job.passingScoreThreshold,

    // Candidate context
    candidateName: application?.candidateName || '',
    resumeText: application?.resumeText || '',

    // System-prompt-facing difficulty parameter for the fine-tuned Gemma model
    difficultyLabel,
  };
}

module.exports = {
  deriveDifficulty,
  buildInterviewPayload,
};
