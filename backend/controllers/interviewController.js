const Interview = require('../models/Interview');
const Question = require('../models/Question');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { parseJobDescription, generateInterviewQuestions, processInterviewTurn } = require('../services/gemmaService');
const { transcribeAudio, synthesizeSpeech } = require('../services/somaliSpeechService');
const { uploadAudio } = require('../services/blobService');
const logger = require('../utils/logger');
const { stageTimer } = require('../middleware/requestContext');
const {
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

function buildFallbackFirstQuestion(interview, context) {
  const role = interview.jobRole || interview.domain || 'this role';
  const name = context.candidateName || 'Candidate';
  const isSomali = String(interview.language).toLowerCase() === 'somali';
  return {
    text: isSomali
      ? `Salaan ${name}. Fadlan si kooban isu bar oo sharax khibraddaada la xiriirta shaqada ${role}?`
      : `Hi ${name}. Could you briefly introduce yourself and describe your experience relevant to the ${role} role?`,
    category: 'intro',
    difficulty: interview.difficulty,
    expectedAnswer: isSomali
      ? 'Musharraxu wuxuu soo koobayaa khibraddiisa, xirfadaha muhiimka ah, iyo xiriirka ay la leeyihiin shaqada.'
      : 'The candidate summarizes relevant experience, key skills, and fit for the role.',
    order: 0,
  };
}

const activeGenerations = new Map();

async function assertInterviewStillExists(interviewId) {
  const exists = await Interview.exists({ _id: interviewId });
  if (!exists) {
    const error = new Error('Interview generation was cancelled');
    error.code = 'GENERATION_CANCELLED';
    throw error;
  }
}

async function saveGeneratedQuestion(interviewId, aiQuestion, order, fallbackDifficulty) {
  if (!aiQuestion?.text) return null;
  let question;
  try {
    question = await Question.findOneAndUpdate(
      { interview: interviewId, order },
      {
        $setOnInsert: {
          interview: interviewId,
          text: aiQuestion.text,
          category: aiQuestion.category || 'general',
          difficulty: toQuestionDifficulty(aiQuestion.difficulty || fallbackDifficulty),
          expectedAnswer: aiQuestion.expectedAnswer || '',
          order,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    question = await Question.findOne({ interview: interviewId, order });
  }
  if (!question) return null;
  await Interview.findByIdAndUpdate(interviewId, { $addToSet: { questions: question._id } });
  return question;
}

async function runQuestionGenerationPipeline(interviewId, context) {
  const interview = await Interview.findById(interviewId);
  if (!interview || interview.questionsReady || interview.status === 'cancelled') return;

  const totalCount = interview.expectedQuestionCount > 0
    ? interview.expectedQuestionCount
    : Math.max(1, Math.min(Math.floor((interview.duration || 30) / 2.5), 16));
  const startedAt = Date.now();
  await Interview.findByIdAndUpdate(interviewId, {
    generationStatus: 'generating-first',
    generationError: '',
    generationStartedAt: new Date(),
    expectedQuestionCount: totalCount,
  });

  try {
    const existingFirst = await Question.findOne({ interview: interviewId, order: 0 });
    let firstQuestion = existingFirst;
    if (!firstQuestion) {
      let generatedFirst;
      try {
        [generatedFirst] = await generateInterviewQuestions(
          interview.type,
          interview.domain,
          interview.difficulty,
          1,
          {
            ...context,
            _forcedCategory: getCategoryForIndex(0, totalCount, interview.type),
            _forcedIndex: 0,
            _forcedCount: totalCount,
            requestTimeoutMs: Number(process.env.FIRST_QUESTION_TIMEOUT_MS || 4500),
          }
        );
      } catch (error) {
        logger.warn(JSON.stringify({
          event: 'first_question_model_fallback',
          requestId: context.requestId,
          interviewId: String(interviewId),
          message: error.message,
        }));
        generatedFirst = buildFallbackFirstQuestion(interview, context);
      }
      await assertInterviewStillExists(interviewId);
      firstQuestion = await saveGeneratedQuestion(interviewId, generatedFirst, 0, interview.difficulty);
    }
    if (!firstQuestion) throw new Error('The model did not return a valid first question');

    await Interview.findOneAndUpdate(
      { _id: interviewId, 'conversationHistory.content': { $ne: firstQuestion.text } },
      {
        $push: {
          conversationHistory: {
            role: 'interviewer',
            content: firstQuestion.text,
            timestamp: new Date(),
          },
        },
      }
    );
    await Interview.findByIdAndUpdate(interviewId, {
      firstQuestionReadyAt: new Date(),
      generationStatus: totalCount > 1 ? 'generating-remaining' : 'ready',
    });
    logger.info(JSON.stringify({
      event: 'first_question_ready',
      requestId: context.requestId,
      interviewId: String(interviewId),
      totalMs: Date.now() - startedAt,
    }));

    void synthesizeSpeech(firstQuestion.text, interview.language, { requestId: context.requestId })
      .catch((error) => logger.warn(JSON.stringify({
        event: 'first_question_tts_prefetch_failed',
        requestId: context.requestId,
        interviewId: String(interviewId),
        message: error.message,
      })));

    if (totalCount > 1) {
      const generatedRemaining = await generateInterviewQuestions(
        interview.type,
        interview.domain,
        interview.difficulty,
        totalCount - 1,
        {
          ...context,
          _startIndex: 1,
          _forcedCount: totalCount,
          requestTimeoutMs: Number(process.env.REMAINING_QUESTIONS_TIMEOUT_MS || 60000),
        }
      );
      await assertInterviewStillExists(interviewId);
      for (const generated of generatedRemaining) {
        await saveGeneratedQuestion(interviewId, generated, generated.order, interview.difficulty);
      }
    }

    const savedCount = await Question.countDocuments({ interview: interviewId });
    const complete = savedCount >= totalCount;
    await Interview.findByIdAndUpdate(interviewId, {
      questionsReady: complete,
      generationStatus: complete ? 'ready' : 'partial',
      generationError: complete ? '' : `Only ${savedCount} of ${totalCount} questions were generated`,
      generationCompletedAt: new Date(),
    });
    logger.info(JSON.stringify({
      event: 'question_generation_complete',
      requestId: context.requestId,
      interviewId: String(interviewId),
      expectedCount: totalCount,
      savedCount,
      totalMs: Date.now() - startedAt,
    }));
  } catch (error) {
    if (error.code === 'GENERATION_CANCELLED') {
      logger.info(JSON.stringify({ event: 'question_generation_cancelled', requestId: context.requestId, interviewId: String(interviewId) }));
      return;
    }
    const savedCount = await Question.countDocuments({ interview: interviewId }).catch(() => 0);
    await Interview.findByIdAndUpdate(interviewId, {
      questionsReady: false,
      generationStatus: savedCount > 0 ? 'partial' : 'failed',
      generationError: error.message.slice(0, 500),
      generationCompletedAt: new Date(),
    }).catch(() => {});
    logger.error(JSON.stringify({
      event: 'question_generation_failed',
      requestId: context.requestId,
      interviewId: String(interviewId),
      savedCount,
      totalMs: Date.now() - startedAt,
      message: error.message,
    }));
  }
}

function ensureQuestionGeneration(interview, context) {
  const key = String(interview._id);
  if (activeGenerations.has(key)) return activeGenerations.get(key);
  const task = runQuestionGenerationPipeline(interview._id, context)
    .finally(() => activeGenerations.delete(key));
  activeGenerations.set(key, task);
  return task;
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
    const rawGenerationKey = String(req.get('idempotency-key') || '').trim();
    const generationKey = /^[A-Za-z0-9._:-]{1,128}$/.test(rawGenerationKey) ? rawGenerationKey : undefined;

    if (generationKey) {
      const existing = await Interview.findOne({ user: req.user._id, generationKey }).populate({
        path: 'questions',
        options: { sort: { order: 1 } },
      });
      if (existing) {
        return ApiResponse.success(res, { interview: existing }, 'Existing interview returned for idempotent request');
      }
    }

    const totalQuestionCount = Math.max(1, Math.min(Math.floor((duration || 30) / 2.5), 16));
    const stopCreateDb = stageTimer(req, 'db_create_interview');

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
      generationStatus: 'queued',
      generationKey,
      expectedQuestionCount: totalQuestionCount,
    });
    stopCreateDb();

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

    const stopUserDb = stageTimer(req, 'db_update_user');
    await User.findByIdAndUpdate(req.user._id, { $inc: { interviewCount: 1 } });
    stopUserDb();

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
      requestId: req.requestId,
    };
    // Fire-and-forget — do NOT await
    ensureQuestionGeneration(interview, bgContext)
      .catch(err => logger.error(`[BG] Unhandled error in background generation: ${err.message}`));
  } catch (error) {
    if (error.code === 11000 && req.get('idempotency-key')) {
      const existing = await Interview.findOne({
        user: req.user?._id,
        generationKey: String(req.get('idempotency-key')).trim(),
      }).populate({ path: 'questions', options: { sort: { order: 1 } } }).catch(() => null);
      if (existing) return ApiResponse.success(res, { interview: existing }, 'Existing interview returned for idempotent request');
    }
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
    const stopDb = stageTimer(req, 'db_get_interview');
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate({
        path: 'questions',
        options: { sort: { order: 1 } }
      })
      .populate('feedback');
    stopDb();

    if (!interview) {
      return next(ApiError.notFound('Interview not found'));
    }

    if (!interview.questionsReady && (!interview.generationStatus || ['queued', 'generating-first', 'generating-remaining'].includes(interview.generationStatus))) {
      void ensureQuestionGeneration(interview, {
        jobRole: interview.jobRole,
        jobDescription: interview.jobDescription,
        resumeText: interview.resumeText,
        focusSkills: interview.focusSkills,
        roleProfile: interview.roleProfile,
        language: interview.language,
        candidateName: req.user.name,
        requestId: req.requestId,
      });
    }

    ApiResponse.success(res, { interview });
  } catch (error) {
    next(error);
  }
};

const getInterviewProgress = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id })
      .select('questionsReady generationStatus generationError expectedQuestionCount firstQuestionReadyAt generationCompletedAt questions')
      .populate({ path: 'questions', options: { sort: { order: 1 } } });
    if (!interview) return next(ApiError.notFound('Interview not found'));
    ApiResponse.success(res, { interview });
  } catch (error) {
    next(error);
  }
};

const retryQuestionGeneration = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) return next(ApiError.notFound('Interview not found'));
    if (interview.questionsReady) return ApiResponse.success(res, { interview }, 'Questions are already ready');

    interview.generationStatus = 'queued';
    interview.generationError = '';
    await interview.save();
    void ensureQuestionGeneration(interview, {
      jobRole: interview.jobRole,
      jobDescription: interview.jobDescription,
      resumeText: interview.resumeText,
      focusSkills: interview.focusSkills,
      roleProfile: interview.roleProfile,
      language: interview.language,
      candidateName: req.user.name,
      requestId: req.requestId,
    });
    ApiResponse.success(res, { interview }, 'Question generation retry started', 202);
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

    if (!interview.questions?.length) {
      return next(ApiError.serviceUnavailable(
        interview.generationStatus === 'failed'
          ? 'Question generation failed. Retry generation before starting.'
          : 'The first question is still being prepared. Retry shortly.'
      ));
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
  getInterviewProgress,
  retryQuestionGeneration,
  startInterview,
  submitAnswer,
  completeInterview,
  deleteInterview,
  retryEvaluate,
  resetInterview,
};
