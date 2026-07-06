const Interview = require('../models/Interview');
const Question = require('../models/Question');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { parseJobDescription, generateInterviewQuestions, processInterviewTurn } = require('../services/gemmaService');
const { transcribeAudio } = require('../services/somaliSpeechService');
const { uploadAudio } = require('../services/blobService');
const logger = require('../utils/logger');
const {
  isDuplicateOfExisting,
  ensureInterviewerPromptInHistory,
} = require('../utils/questionHelpers');

/* ─── Normalize interview difficulty → question difficulty ── */
const DIFFICULTY_MAP = {
  junior: 'easy',
  mid: 'medium',
  senior: 'hard',
  lead: 'hard',
};

function toQuestionDifficulty(val) {
  return DIFFICULTY_MAP[val] || val || 'medium';
}

/* ─── Category cycles by interview type ─────────────────── */
const CATEGORY_CYCLES = {
  hr: ['motivation', 'strengths/weaknesses', 'culture fit', 'experience'],
  technical: ['core skills', 'scenario tasks', 'debugging', 'fundamentals'],
  behavioral: ['STAR-based situation', 'past experience', 'problem solving'],
  default: ['conceptual', 'situational', 'behavioral', 'technical'],
};

function getCategoryForIndex(i, totalCount, interviewType) {
  if (i === 0) return 'intro';
  if (i === totalCount - 1) return 'outro';
  const cycle = CATEGORY_CYCLES[(interviewType || 'mixed').toLowerCase()] || CATEGORY_CYCLES.default;
  return cycle[(i - 1) % cycle.length];
}

/**
 * Generates remaining questions in the background after the first question
 * has already been created and the response has been sent to the client.
 * Updates the interview record incrementally as each question is saved.
 */
async function generateRemainingQuestionsInBackground(interview, context, startIdx, totalCount) {
  const CONCURRENCY = 3;

  try {
    const { type, domain, difficulty, jobRole, jobDescription, resumeText, focusSkills, roleProfile, language, candidateName } = context;

    logger.info(`[BG] Starting background generation for interview ${interview._id} — questions ${startIdx + 1} to ${totalCount} (concurrency ${CONCURRENCY})`);

    const freshInterview = await Interview.findById(interview._id).select('roleProfile').lean();
    if (freshInterview?.roleProfile) {
      context.roleProfile = freshInterview.roleProfile;
    }

    async function generateOne(i) {
      const category = getCategoryForIndex(i, totalCount, type);

      try {
        const [aiQ] = await generateInterviewQuestions(type, domain, difficulty, 1, {
          jobRole, jobDescription, resumeText, focusSkills, roleProfile, language, candidateName,
          _forcedCategory: category,
          _forcedIndex: i,
          _forcedCount: totalCount,
        });

        if (aiQ && aiQ.text) {
          const existing = await Question.find({ interview: interview._id }).select('text').lean();
          if (isDuplicateOfExisting(aiQ.text, existing)) {
            logger.warn(`[BG] Skipping duplicate question ${i + 1} for interview ${interview._id}`);
            return;
          }

          const question = await Question.create({
            interview: interview._id,
            text: aiQ.text,
            category,
            difficulty: toQuestionDifficulty(aiQ.difficulty || difficulty),
            expectedAnswer: aiQ.expectedAnswer || '',
            order: i,
          });

          await Interview.findByIdAndUpdate(interview._id, {
            $push: { questions: question._id },
          });

          if (i === 0) {
            await Interview.findByIdAndUpdate(interview._id, {
              $push: {
                conversationHistory: {
                  role: 'interviewer',
                  content: question.text,
                  timestamp: new Date()
                }
              }
            });
          }

          logger.info(`[BG] Question ${i + 1}/${totalCount} saved for interview ${interview._id}`);
        }
      } catch (qErr) {
        logger.warn(`[BG] Question ${i + 1} generation failed for ${interview._id}: ${qErr.message}`);
      }
    }

    const indices = [];
    for (let i = startIdx; i < totalCount; i++) indices.push(i);

    let cursor = 0;
    async function worker() {
      while (cursor < indices.length) {
        const i = indices[cursor++];
        await generateOne(i);
      }
    }

    const workers = Math.min(CONCURRENCY, indices.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));

    await Interview.findByIdAndUpdate(interview._id, { questionsReady: true });
    logger.info(`[BG] All ${totalCount} questions ready for interview ${interview._id}`);
  } catch (err) {
    logger.error(`[BG] Background question generation failed for ${interview._id}: ${err.message}`);
    await Interview.findByIdAndUpdate(interview._id, { questionsReady: true }).catch(() => {});
  }
}

/**
 * @desc    Create a new interview — responds immediately, generating all questions
 *          in the background.
 * @route   POST /api/v1/interviews
 * @access  Private
 */
const createInterview = async (req, res, next) => {
  try {
    const { title, type, difficulty, domain, duration, scheduledAt, jobRole, focusSkills, jobDescription, resumeText, language } = req.body;

    const totalQuestionCount = Math.max(1, Math.min(Math.floor((duration || 30) / 2.5), 16));

    // ── Step 1: Create the interview record immediately ──────────────────────
    const interview = await Interview.create({
      user: req.user._id,
      title,
      type,
      difficulty,
      domain,
      language: language || 'english',
      duration: duration || 30,
      scheduledAt: scheduledAt || new Date(),
      jobRole: jobRole || '',
      focusSkills: focusSkills || [],
      jobDescription: jobDescription || '',
      resumeText: resumeText || '',
      questionsReady: false,
      expectedQuestionCount: totalQuestionCount,
    });

    // ── Step 2: Parse job description asynchronously (non-blocking) ───────────
    let roleProfile = null;
    if (jobDescription && jobDescription.trim()) {
      parseJobDescription(jobDescription, jobRole || domain)
        .then(async (parsed) => {
          await Interview.findByIdAndUpdate(interview._id, { roleProfile: parsed });
          logger.info(`Job description parsed for interview ${interview._id}`);
        })
        .catch((parseError) => {
          logger.warn(`Job description parsing failed for ${interview._id}: ${parseError.message}`);
        });
    }

    // ── Step 3: Seed conversation history and save ───────────────────────────
    const conversationHistory = [
      {
        role: 'system',
        content: `Interview started. Role: ${jobRole || domain}. Language: ${interview.language}. Domain: ${domain}.`,
        timestamp: new Date()
      }
    ];

    interview.conversationHistory = conversationHistory;
    await interview.save();

    await User.findByIdAndUpdate(req.user._id, { $inc: { interviewCount: 1 } });

    // ── Step 4: Respond immediately ──────────────────────────────────────────
    const populatedInterview = await Interview.findById(interview._id).populate({
      path: 'questions',
      options: { sort: { order: 1 } }
    });
    logger.info(`Interview created: ${interview._id} by user ${req.user._id} — responding immediately, all ${totalQuestionCount} questions generating in background`);
    ApiResponse.created(res, { interview: populatedInterview }, 'Interview created — questions generating');

    // ── Step 5: Generate remaining questions in the background ───────────────
    const bgContext = {
      type, domain, difficulty, jobRole, jobDescription, resumeText,
      focusSkills, roleProfile, language: interview.language,
      candidateName: req.user.name,
    };
    // Fire-and-forget — do NOT await
    generateRemainingQuestionsInBackground(interview, bgContext, 0, totalQuestionCount)
      .catch(err => logger.error(`[BG] Unhandled error in background generation: ${err.message}`));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all interviews for current user
 * @route   GET /api/v1/interviews
 * @access  Private
 */
const getInterviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.domain) filter.domain = req.query.domain;
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;

    const [interviews, total] = await Promise.all([
      Interview.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-transcription'),
      Interview.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, interviews, {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single interview with questions and feedback
 * @route   GET /api/v1/interviews/:id
 * @access  Private
 */
const getInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate({
        path: 'questions',
        options: { sort: { order: 1 } }
      })
      .populate('feedback');

    if (!interview) {
      return next(ApiError.notFound('Interview not found'));
    }

    ApiResponse.success(res, { interview });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Start an interview session
 *          Accepts both 'scheduled' and 'in-progress' statuses so that refreshing
 *          during an active session doesn't break the flow.
 * @route   PUT /api/v1/interviews/:id/start
 * @access  Private
 */
const startInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!interview) {
      return next(ApiError.notFound('Interview not found'));
    }

    if (interview.status !== 'scheduled' && interview.status !== 'in-progress') {
      return next(ApiError.badRequest(`Cannot start interview with status '${interview.status}'`));
    }

    if (interview.status === 'scheduled') {
      interview.status = 'in-progress';
      await interview.save();
    }

    const populated = await Interview.findById(interview._id).populate({
      path: 'questions',
      options: { sort: { order: 1 } }
    });

    ApiResponse.success(res, { interview: populated }, 'Interview started');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit an answer for a question
 * @route   PUT /api/v1/interviews/:interviewId/questions/:questionId/answer
 * @access  Private
 */
const submitAnswer = async (req, res, next) => {
  try {
    const { interviewId, questionId } = req.params;
    const { userAnswer, timeSpent, activePromptText } = req.body;

    // Verify interview belongs to user
    const interview = await Interview.findOne({
      _id: interviewId,
      user: req.user._id,
      status: { $in: ['in-progress', 'scheduled'] },
    });

    if (!interview) {
      return next(ApiError.notFound('Active interview not found'));
    }

    // Coerce scheduled → in-progress on first answer
    if (interview.status === 'scheduled') {
      interview.status = 'in-progress';
    }

    // Find the question
    const question = await Question.findOne({
      _id: questionId,
      interview: interviewId,
    });

    if (!question) {
      return next(ApiError.notFound('Question not found'));
    }

    // Handle audio upload if present
    let audioUrl = '';
    let transcribedAnswer = userAnswer || '';

    if (req.file) {
      try {
        const audioResult = await uploadAudio(req.file.buffer, req.user._id.toString(), questionId);
        audioUrl = audioResult.url;
      } catch (uploadError) {
        logger.warn(`Audio upload failed, continuing with transcription: ${uploadError.message}`);
      }

      // Transcribe audio if no text answer provided
      if (!userAnswer) {
        try {
          transcribedAnswer = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype);
        } catch (transcriptionError) {
          logger.warn(`Somali audio transcription failed: ${transcriptionError.message}`);
          return next(ApiError.badRequest('Could not transcribe the Somali audio answer. Please try recording again.'));
        }
      }
    }

    const lastInterviewerMsg = [...interview.conversationHistory]
      .reverse()
      .find(m => m.role === 'interviewer');

    const promptForAnswer = (activePromptText || lastInterviewerMsg?.content || question.text || '').trim();
    ensureInterviewerPromptInHistory(interview.conversationHistory, promptForAnswer);

    // Append candidate's answer to conversation history
    interview.conversationHistory.push({
      role: 'candidate',
      content: transcribedAnswer,
      timestamp: new Date()
    });

    // Process interview turn dynamically (evaluate + next question)
    let evaluation = { score: 0, feedback: '', strengths: [], improvements: [], suggestedAnswer: '' };
    let nextInterviewerResponse = "Thank you. Let's move on to the next topic.";
    let isFollowUp = false;
    let answeredCandidateQuestion = false;

    if (transcribedAnswer) {
      try {
        const turnResult = await processInterviewTurn(
          interview.conversationHistory,
          interview.domain,
          interview.jobRole,
          interview.language,
          interview.type,
          {
            difficulty: interview.difficulty || 'mid',
            currentQuestion: {
              text: promptForAnswer || question.text,
              expectedAnswer: question.expectedAnswer || '',
              category: question.category || 'general',
              difficulty: question.difficulty || interview.difficulty || 'mid',
            },
            roleProfile: interview.roleProfile || null,
            candidateAnswer: transcribedAnswer,
          }
        );

        if (turnResult.evaluation) {
          evaluation = {
            score: turnResult.evaluation.score ?? 0,
            feedback: turnResult.evaluation.feedback || '',
            strengths: turnResult.evaluation.strengths || [],
            improvements: turnResult.evaluation.improvements || [],
            suggestedAnswer: turnResult.evaluation.suggestedAnswer || '',
          };
        }

        if (turnResult.nextInterviewerResponse) {
          nextInterviewerResponse = turnResult.nextInterviewerResponse;
        }
        isFollowUp = turnResult.isFollowUp || false;
        answeredCandidateQuestion = Boolean(turnResult.answeredCandidateQuestion);

      } catch (aiError) {
        logger.warn(`AI turn processing failed: ${aiError.message}`);
        evaluation.feedback = 'AI evaluation unavailable. Answer recorded for manual review.';
      }
    }

    // Persist answer text on every turn (including follow-ups); score only when topic completes.
    if (question.userAnswer && question.userAnswer.trim()) {
      question.userAnswer = question.userAnswer + '\n\n[Follow-up answer]: ' + transcribedAnswer;
    } else {
      question.userAnswer = transcribedAnswer;
    }
    if (audioUrl) question.audioUrl = audioUrl;
    question.timeSpent = (question.timeSpent || 0) + (timeSpent || 0);

    if (!isFollowUp) {
      question.score = typeof evaluation.score === 'number' ? evaluation.score : null;
      question.aiFeedback = evaluation.feedback;
      question.isAnswered = true;
    }
    await question.save();

    // Check if we reached the maximum duration (in minutes) to end interview naturally
    const interviewStartTime = interview.startedAt ? new Date(interview.startedAt).getTime() : new Date(interview.createdAt).getTime();
    const currentTime = new Date().getTime();
    const elapsedMinutes = (currentTime - interviewStartTime) / 60000;

    const timeLimitReached = elapsedMinutes >= (interview.duration || 30);

    if (timeLimitReached && !isFollowUp) {
      nextInterviewerResponse = "We are out of time. Thank you for completing this interview. You can now submit and complete the session.";
    }

    interview.conversationHistory.push({
      role: 'interviewer',
      content: nextInterviewerResponse,
      timestamp: new Date()
    });

    await interview.save();

    const isTimeUp = timeLimitReached && !isFollowUp;

    ApiResponse.success(res, {
      question,
      evaluation,
      followUpText: isFollowUp ? nextInterviewerResponse : null,
      isFollowUp,
      isTimeUp,
      answeredCandidateQuestion,
    }, 'Answer submitted and evaluated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete an interview (idempotent — safe to call twice)
 * @route   PUT /api/v1/interviews/:id/complete
 * @access  Private
 */
const completeInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate({
      path: 'questions',
      options: { sort: { order: 1 } }
    });

    if (!interview) {
      return next(ApiError.notFound('Interview not found'));
    }

    // Idempotent — if already completed return the existing data.
    // This handles race conditions when the frontend fires completeInterview from both
    // the engine wrapUp and the manual "End Interview" button simultaneously.
    if (interview.status === 'completed') {
      logger.info(`Interview ${interview._id} already completed — returning existing data`);
      return ApiResponse.success(res, { interview }, 'Interview already completed');
    }

    if (interview.status !== 'in-progress') {
      return next(ApiError.badRequest(`Cannot complete interview with status '${interview.status}'`));
    }

    const answeredQuestions = interview.questions.filter((q) => q.isAnswered && q.score !== null);
    const overallScore = answeredQuestions.length > 0
      ? Math.round(answeredQuestions.reduce((sum, q) => sum + q.score, 0) / answeredQuestions.length)
      : 0;

    interview.status = 'completed';
    interview.overallScore = overallScore;

    if (req.body.visualMetrics) {
      interview.visualMetrics = req.body.visualMetrics;
    }

    await interview.save();

    logger.info(`Interview completed: ${interview._id} — score: ${overallScore}`);

    ApiResponse.success(res, { interview }, 'Interview completed');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an interview and all associated data
 * @route   DELETE /api/v1/interviews/:id
 * @access  Private
 */
const deleteInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!interview) {
      return next(ApiError.notFound('Interview not found'));
    }

    await Promise.all([
      Question.deleteMany({ interview: interview._id }),
      require('../models/Feedback').deleteMany({ interview: interview._id }),
    ]);

    await Interview.findByIdAndDelete(interview._id);

    logger.info(`Interview deleted: ${interview._id} by user ${req.user._id}`);
    ApiResponse.success(res, null, 'Interview and all associated data deleted');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Retry-evaluate a question answer (Practice Loop)
 * @route   POST /api/v1/interviews/:interviewId/questions/:questionId/retry
 * @access  Private
 */
const retryEvaluate = async (req, res, next) => {
  try {
    const { interviewId, questionId } = req.params;
    const { retryAnswer } = req.body;

    if (!retryAnswer || !retryAnswer.trim()) {
      return next(ApiError.badRequest('Please provide a retry answer'));
    }

    const interview = await Interview.findOne({
      _id: interviewId,
      user: req.user._id,
    });

    if (!interview) {
      return next(ApiError.notFound('Interview not found'));
    }

    const question = await Question.findOne({
      _id: questionId,
      interview: interviewId,
    });

    if (!question) {
      return next(ApiError.notFound('Question not found'));
    }

    const retryHistory = [
      { role: 'interviewer', content: question.text },
      { role: 'candidate', content: retryAnswer },
    ];

    const turnResult = await processInterviewTurn(
      retryHistory,
      interview.domain,
      interview.jobRole,
      interview.language,
      interview.type,
      {
        difficulty: interview.difficulty || 'mid',
        currentQuestion: {
          text: question.text,
          expectedAnswer: question.expectedAnswer || '',
          category: question.category || 'general',
          difficulty: question.difficulty || interview.difficulty || 'mid',
        },
        roleProfile: interview.roleProfile || null,
        candidateAnswer: retryAnswer,
      }
    );

    const evaluation = turnResult.evaluation || { score: 0, feedback: '', strengths: [], improvements: [], suggestedAnswer: '' };

    question.retryAnswers.push({
      answer: retryAnswer,
      score: typeof evaluation.score === 'number' ? evaluation.score : null,
      feedback: evaluation.feedback || '',
      strengths: evaluation.strengths || [],
      improvements: evaluation.improvements || [],
      suggestedAnswer: evaluation.suggestedAnswer || '',
    });
    await question.save();

    logger.info(`Retry evaluated for question ${questionId} — score: ${evaluation.score}`);

    ApiResponse.success(res, { evaluation }, 'Retry answer evaluated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset interview status and answers to restart the session
 * @route   PUT /api/v1/interviews/:id/reset
 * @access  Private
 */
const resetInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!interview) {
      return next(ApiError.notFound('Interview not found'));
    }

    await Feedback.deleteMany({ interview: interview._id });

    await Question.updateMany(
      { interview: interview._id },
      {
        $set: {
          userAnswer: '',
          audioUrl: '',
          score: null,
          aiFeedback: '',
          timeSpent: 0,
          isAnswered: false,
          retryAnswers: [],
        }
      }
    );

    const conversationHistory = [
      {
        role: 'system',
        content: `Interview started. Role: ${interview.jobRole || interview.domain}. Language: ${interview.language}. Domain: ${interview.domain}.`,
        timestamp: new Date()
      }
    ];

    if (interview.questions && interview.questions.length > 0) {
      const firstQuestion = await Question.findOne({ interview: interview._id }).sort({ order: 1 });
      if (firstQuestion) {
        conversationHistory.push({
          role: 'interviewer',
          content: firstQuestion.text,
          timestamp: new Date()
        });
      }
    }

    interview.status = 'scheduled';
    interview.overallScore = null;
    interview.startedAt = undefined;
    interview.completedAt = undefined;
    interview.conversationHistory = conversationHistory;

    await interview.save();

    const populated = await Interview.findById(interview._id).populate({
      path: 'questions',
      options: { sort: { order: 1 } }
    });

    logger.info(`Interview reset: ${interview._id} by user ${req.user._id}`);
    ApiResponse.success(res, { interview: populated }, 'Interview reset successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInterview,
  getInterviews,
  getInterview,
  startInterview,
  submitAnswer,
  completeInterview,
  deleteInterview,
  retryEvaluate,
  resetInterview,
};
