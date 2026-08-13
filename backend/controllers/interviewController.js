const Interview = require('../models/Interview');
const Question = require('../models/Question');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const Application = require('../models/Application');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { parseJobDescription, generateInterviewQuestions, processInterviewTurn, isPlaceholderAnswer } = require('../services/gemmaService');
const { transcribeAudio } = require('../services/somaliSpeechService');
const { uploadAudio, deleteBlobUrls } = require('../services/blobService');
const logger = require('../utils/logger');
const { stageTimer } = require('../middleware/requestContext');
const {
  ensureInterviewerPromptInHistory,
} = require('../utils/questionHelpers');
const { normalizeEvaluation, calculateOverallScore, isScorable, summarizeEvaluations } = require('../utils/evaluation');
const {
  startInterviewWarmup,
  getInterviewWarmupStatus,
  awaitCurrentWarmup,
} = require('../services/interviewWarmupService');
const { requiresVerification } = require('./verificationController');
const { requiresRecording, uploadChunk: uploadRecordingChunkBuffer, finalizeRecording } = require('../services/recordingService');

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// How early a candidate may enter a company-scheduled interview ahead of its
// scheduledAt time. Kept in sync with the frontend waiting-room countdown.
const EARLY_JOIN_WINDOW_MS = 15 * 60 * 1000;

// After the scheduled slot ends we still allow a small grace so a candidate
// who arrived on time but hit a network hiccup can rejoin.
const LATE_JOIN_GRACE_MS = 10 * 60 * 1000;

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
  technical: ['core skills', 'applied knowledge', 'debugging', 'fundamentals'],
  behavioral: ['STAR-based situation', 'past experience', 'problem solving'],
  'system-design': ['architecture overview', 'scalability', 'trade-offs', 'component design'],
  mixed: ['core skills', 'motivation', 'applied knowledge', 'culture fit', 'debugging', 'past experience'],
  default: ['conceptual', 'situational', 'behavioral', 'technical'],
};

function getCategoryForIndex(i, totalCount, interviewType) {
  if (i === 0) return 'intro';
  if (i === totalCount - 1) return 'outro';
  const key = (interviewType || 'mixed').toLowerCase();
  const cycle = CATEGORY_CYCLES[key] ?? CATEGORY_CYCLES.default;
  return cycle[(i - 1) % cycle.length];
}

function buildFallbackFirstQuestion(interview, context) {
  const role = interview.jobRole || interview.domain || 'this role';
  const domain = interview.domain || 'this field';
  const isSomali = String(interview.language).toLowerCase() === 'somali';
  const isPractice = !interview.company;

  const skills = context?.roleProfile?.requiredSkills || [];
  const topSkill = skills[0] || '';

  let text;
  if (isPractice) {
    if (isSomali) {
      text = topSkill
        ? `Noo sheeg khibraddaada la xiriirta ${topSkill} iyo sida aad ugu adeegsatay ${domain}.`
        : `Noo sheeg khibraddaada iyo waxa aad ka taqaanno ${domain}. Sidee ayaad u bilowday xirfaddan?`;
    } else {
      text = topSkill
        ? `Tell me about your experience with ${topSkill} and how you've used it in ${domain}.`
        : `Tell me about your background in ${domain}. How did you get started in this field?`;
    }
  } else {
    if (isSomali) {
      text = topSkill
        ? `Maxaad ka garanaysaa ${topSkill} iyo sida aad u isticmaali lahayd shaqada ${role}?`
        : `Maxaa kuu keenay inaad codsi u gudbiso xagga shaqada ${role}? Noo sheeg wax ka yar khibraddaada la xiriirta ${domain}.`;
    } else {
      text = topSkill
        ? `What has been your most hands-on experience working with ${topSkill} in a ${role} context?`
        : `What drew you to applying for this ${role} position, and what relevant experience are you bringing?`;
    }
  }

  return {
    text,
    category: 'intro',
    difficulty: interview.difficulty,
    expectedAnswer: isSomali
      ? 'Musharraxu wuxuu sharaxaa khibradiisa iyo aqoontiisa xirfadda.'
      : 'The candidate describes their background and relevant experience.',
    order: 0,
  };
}

const activeGenerations = new Map();

// Max wall-clock time for the whole generation pipeline (env-tunable).
// Somali and cold-start RunPod can be slow; beyond this we fill with fallbacks.
const MAX_GENERATION_TOTAL_MS = Number(process.env.MAX_GENERATION_TOTAL_MS || 120000);

async function fillRemainingWithFallbacks(interviewId, interview, totalCount, context) {
  try {
    const existingOrders = new Set(
      (await Question.find({ interview: interviewId }, 'order').lean()).map(q => q.order)
    );
    const isSomali = String(interview.language || '').toLowerCase() === 'somali';
    const domain = interview.domain || 'general';
    const role = interview.jobRole || domain;

    const FALLBACK_EN = [
      (i, r) => `Walk me through how you would approach a complex problem in ${r}.`,
      (i, r) => `Describe a challenging situation you faced and how you resolved it.`,
      (i, r) => `What relevant skills or experience do you bring to a ${r} role?`,
      (i, r) => `How do you stay current with developments in your field?`,
      (i, r) => `Can you give an example of working under tight deadlines in ${r}?`,
    ];
    const FALLBACK_SO = [
      (i, r) => `Sidee ayaad u xallin lahayd dhibaato adag oo la xiriirta ${r}?`,
      (i, r) => `Sharax xaaladda adag ee aad la kulantay iyo sida aad u xaltay.`,
      (i, r) => `Waa maxay xirfadaha ugu muhiimsan ee aad u leedahay shaqada ${r}?`,
      (i, r) => `Sidee ayaad ula socotaa horumarka xirfaddaada?`,
      (i, r) => `Tusaale ka bixi sida aad ugu shaqeysay xaalad waqtigu kooban yahay.`,
    ];
    const templates = isSomali ? FALLBACK_SO : FALLBACK_EN;
    const outroText = isSomali
      ? 'Ma jiraan wax aad jeclaan lahayd inaad ku darto ka hor inta aanan wareysiga soo gabagabeynin?'
      : 'Is there anything you would like to add before we wrap up?';

    for (let i = 0; i < totalCount; i++) {
      if (existingOrders.has(i)) continue;
      const isOutro = i === totalCount - 1;
      const text = isOutro ? outroText : templates[i % templates.length](i, role);
      await saveGeneratedQuestion(interviewId, {
        text,
        category: isOutro ? 'outro' : 'conceptual',
        difficulty: interview.difficulty || 'medium',
        expectedAnswer: '',
        order: i,
      }, i, interview.difficulty);
    }

    const savedCount = await Question.countDocuments({ interview: interviewId });
    await Interview.findByIdAndUpdate(interviewId, {
      questionsReady: savedCount >= totalCount,
      generationStatus: savedCount >= totalCount ? 'ready' : 'partial',
      generationError: savedCount >= totalCount ? '' : `Timeout: only ${savedCount}/${totalCount} generated`,
      generationCompletedAt: new Date(),
    });
    logger.info(`[pipeline] fallback-fill completed ${savedCount}/${totalCount} for ${interviewId}`);
  } catch (err) {
    logger.error(`[pipeline] fallback-fill failed for ${interviewId}: ${err.message}`);
  }
}

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
  const generationContext = {
    ...context,
    title: context.title || interview.title,
    duration: context.duration || interview.duration,
    scheduledAt: context.scheduledAt || interview.scheduledAt,
    jobRole: context.jobRole || interview.jobRole,
    jobDescription: context.jobDescription || interview.jobDescription,
    resumeText: context.resumeText || interview.resumeText,
    focusSkills: context.focusSkills || interview.focusSkills,
    roleProfile: context.roleProfile || interview.roleProfile,
    language: context.language || interview.language,
    isPractice: !interview.company,
  };

  // Sequence: kick warmup first, then wait up to 5s for it before firing the
  // first `/generate-question`. On a cold RunPod endpoint this ensures the
  // worker is spinning up in parallel with our own prep, so the generate call
  // lands on a warm worker instead of triggering a second independent cold
  // start. The wait is capped so a hung warmup never blocks generation.
  try {
    startInterviewWarmup({
      requestId: context.requestId || `pipeline-warmup-${interviewId}`,
      language: generationContext.language,
    });
  } catch (warmErr) {
    logger.warn(`[pipeline] warmup kick failed for ${interviewId}: ${warmErr.message}`);
  }
  // RunPod cold starts for the fine-tuned Gemma model routinely take 15–30s.
  // A 5s cap meant the first /generate-question call itself paid the cold-start
  // bill — so we wait longer (env-tunable) before firing generation.
  // ponytail: was 20000 — too long, first question paid cold-start anyway. 8s is enough for warm workers.
  const warmupWaitMs = Number(process.env.PIPELINE_WARMUP_WAIT_MS || 8000);
  const warmupWait = await awaitCurrentWarmup(warmupWaitMs);
  if (warmupWait.waited) {
    logger.info(JSON.stringify({
      event: 'pipeline_warmup_awaited',
      requestId: context.requestId,
      interviewId: String(interviewId),
      elapsedMs: warmupWait.elapsedMs,
      timedOut: warmupWait.timedOut,
    }));
  }

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
    if (!generationContext.roleProfile
      && (generationContext.jobDescription?.trim() || generationContext.resumeText?.trim())) {
      try {
        generationContext.roleProfile = await parseJobDescription(
          generationContext.jobDescription || '',
          generationContext.jobRole || interview.domain,
          generationContext.resumeText || '',
          { title: generationContext.title }
        );
        await Interview.findByIdAndUpdate(interviewId, { roleProfile: generationContext.roleProfile });
        logger.info(`Interview context parsed before question generation for ${interviewId}`);
      } catch (parseError) {
        logger.warn(`Interview context parsing failed for ${interviewId}: ${parseError.message}`);
      }
    }

    const existingFirst = await Question.findOne({ interview: interviewId, order: 0 });
    let firstQuestion = existingFirst;
    if (!firstQuestion) {
      let generatedFirst = null;
      try {
        [generatedFirst] = await generateInterviewQuestions(
          interview.type,
          interview.domain,
          interview.difficulty,
          1,
          {
            ...generationContext,
            _forcedCategory: getCategoryForIndex(0, totalCount, interview.type),
            _forcedIndex: 0,
            _forcedCount: totalCount,
            requestTimeoutMs: Number(process.env.FIRST_QUESTION_TIMEOUT_MS || 30000),
          }
        );
      } catch (error) {
        logger.warn(JSON.stringify({
          event: 'first_question_model_fallback',
          requestId: context.requestId,
          interviewId: String(interviewId),
          message: error.message,
        }));
      }

      if (!generatedFirst?.text) {
        generatedFirst = buildFallbackFirstQuestion(interview, generationContext);
      }
      await assertInterviewStillExists(interviewId);
      firstQuestion = await saveGeneratedQuestion(interviewId, generatedFirst, 0, interview.difficulty);
    }
    if (!firstQuestion) throw new Error('The model did not return a valid first question');

    // Fire DB housekeeping and remaining-question generation concurrently
    const dbHousekeeping = Promise.all([
      Interview.findOneAndUpdate(
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
      ),
      Interview.findByIdAndUpdate(interviewId, {
        firstQuestionReadyAt: new Date(),
        generationStatus: totalCount > 1 ? 'generating-remaining' : 'ready',
      }),
    ]);
    logger.info(JSON.stringify({
      event: 'first_question_ready',
      requestId: context.requestId,
      interviewId: String(interviewId),
      totalMs: Date.now() - startedAt,
    }));

    if (totalCount > 1) {
      const [, generatedRemaining] = await Promise.all([
        dbHousekeeping,
        generateInterviewQuestions(
          interview.type,
          interview.domain,
          interview.difficulty,
          totalCount - 1,
          {
            ...generationContext,
            _startIndex: 1,
            _forcedCount: totalCount,
            requestTimeoutMs: Number(process.env.REMAINING_QUESTIONS_TIMEOUT_MS || 60000),
          }
        ),
      ]);
      await assertInterviewStillExists(interviewId);
      for (const generated of generatedRemaining) {
        if (!generated.text && generated.category === 'outro') {
          const isSomali = String(interview.language).toLowerCase() === 'somali';
          generated.text = isSomali
            ? 'Ma jiraan wax aad jeclaan lahayd inaad ku darto ama aad na waydiiso ka hor inta aanan wareysiga soo gabagabeynin?'
            : 'Is there anything you would like to add or ask us before we wrap up the interview?';
          generated.expectedAnswer = isSomali
            ? 'Musharraxu wuxuu soo gabagabeeynayaa qodobbo muhiim ah ama wuxuu weydiin su\'aalo macquul ah.'
            : 'The candidate wraps up with relevant points or asks thoughtful questions.';
        }
        if (generated.text) {
          await saveGeneratedQuestion(interviewId, generated, generated.order, interview.difficulty);
        }
      }
    } else {
      await dbHousekeeping;
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

  const totalCount = interview.expectedQuestionCount > 0
    ? interview.expectedQuestionCount
    : Math.max(1, Math.min(Math.floor((interview.duration || 30) / 2.5), 16));

  const timeoutHandle = setTimeout(() => {
    logger.warn(`[pipeline] generation timed out after ${MAX_GENERATION_TOTAL_MS}ms for ${interview._id} — filling with fallbacks`);
    void fillRemainingWithFallbacks(interview._id, interview, totalCount, context);
  }, MAX_GENERATION_TOTAL_MS);

  const task = runQuestionGenerationPipeline(interview._id, context)
    .finally(() => {
      clearTimeout(timeoutHandle);
      activeGenerations.delete(key);
    });
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
    startInterviewWarmup({
      requestId: req.requestId || 'create-interview-warmup',
      language: req.body.language || 'english',
    });
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
      company: req.user.company || null,
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
      focusSkills, language: interview.language,
      title: interview.title,
      duration: interview.duration,
      scheduledAt: interview.scheduledAt,
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

const warmInterviewServices = async (req, res, next) => {
  try {
    const warmup = startInterviewWarmup({
      requestId: req.requestId || `warmup-${req.user._id}`,
      force: req.query.force === 'true',
      language: req.query.language,
    });
    ApiResponse.success(res, { warmup }, 'Interview services are warming in the background', 202);
  } catch (error) {
    next(error);
  }
};

const getWarmupStatus = async (_req, res, next) => {
  try {
    ApiResponse.success(res, { warmup: getInterviewWarmupStatus() });
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
    if (req.query.search) filter.title = { $regex: escapeRegex(req.query.search.trim()), $options: 'i' };

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

    // Scheduling window gatekeeper — a company-scheduled interview only
    // becomes active a short window before its scheduled time, so candidates
    // cannot start early. Personal (non-tenant) interviews are unaffected
    // since they are created and started by the same person on demand.
    if (interview.company && interview.scheduledAt) {
      const scheduledMs = new Date(interview.scheduledAt).getTime();
      const opensAt = scheduledMs - EARLY_JOIN_WINDOW_MS;
      const closesAt = scheduledMs + ((interview.duration || 30) * 60 * 1000) + LATE_JOIN_GRACE_MS;
      const now = Date.now();
      if (now < opensAt) {
        return next(
          ApiError.forbidden(
            `This interview is not open yet. It becomes available at ${new Date(opensAt).toISOString()}.`
          )
        );
      }
      if (now > closesAt && interview.status === 'scheduled') {
        interview.status = 'cancelled';
        await interview.save();
        return next(
          ApiError.forbidden(
            'This interview window has closed. The candidate did not join in time. Contact the hiring team to reschedule.'
          )
        );
      }
    }

    // Identity checkpoint gatekeeper — tenant interviews must clear the
    // lobby face match before the candidate can enter the live session.
    // Candidates may retry as many times as needed (no attempt cap), so the
    // only terminal state that blocks entry here is 'passed' being absent.
    if (requiresVerification(interview) && interview.identityVerification?.status !== 'passed') {
      return next(ApiError.forbidden('Identity verification is required before starting this interview.'));
    }

    // Re-verify the linked application is still approved — the company may
    // have revoked approval or rejected the candidate after the interview was
    // scheduled and before the candidate joined.
    if (interview.company) {
      const linkedApplication = await Application.findOne({
        interview: interview._id,
        company: interview.company,
      }).select('approvalStatus status').lean();
      if (linkedApplication && linkedApplication.approvalStatus !== 'approved') {
        return next(ApiError.forbidden('Your application is no longer approved for this interview.'));
      }
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
 * @desc    Upload one chunk of the live full-session webcam recording.
 *          Chunks are small, immutable, and byte-concatenated back into a
 *          single recording once the interview completes (see
 *          services/recordingService.js).
 * @route   POST /api/v1/interviews/:id/recording/chunk
 * @access  Private
 */
const uploadRecordingChunk = async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) {
      return next(ApiError.badRequest('A recording chunk file is required'));
    }

    const index = Number(req.body.index);
    if (!Number.isInteger(index) || index < 0) {
      return next(ApiError.badRequest('A valid chunk index is required'));
    }

    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) return next(ApiError.notFound('Interview not found'));

    if (!requiresRecording(interview)) {
      // Not an error — just a no-op for interviews that don't need a session
      // recording (e.g. personal practice interviews).
      return ApiResponse.success(res, { stored: false }, 'Recording not required for this interview');
    }

    if (interview.status !== 'in-progress') {
      return next(ApiError.badRequest(`Cannot upload a recording chunk while interview status is '${interview.status}'`));
    }

    const url = await uploadRecordingChunkBuffer(req.file.buffer, req.user._id.toString(), interview._id.toString(), index);

    if (!interview.recordingChunks.some((c) => c.index === index)) {
      interview.recordingChunks.push({ index, url });
    }
    interview.recordingStatus = 'recording';
    await interview.save();

    ApiResponse.success(res, { stored: true, index }, 'Recording chunk stored');
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

    // Enforce the same gates as /start — otherwise a candidate can call
    // submitAnswer directly and bypass identity + scheduling windows.
    if (interview.company && interview.scheduledAt) {
      const opensAt = new Date(interview.scheduledAt).getTime() - EARLY_JOIN_WINDOW_MS;
      if (Date.now() < opensAt) {
        return next(ApiError.forbidden('This interview is not open yet.'));
      }
    }
    if (requiresVerification(interview) && interview.identityVerification?.status !== 'passed') {
      return next(ApiError.forbidden('Identity verification is required before submitting answers.'));
    }

    // Coerce scheduled → in-progress on first answer
    if (interview.status === 'scheduled') {
      interview.status = 'in-progress';
      if (!interview.startedAt) interview.startedAt = new Date();
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

    let transcriptionFailed = false;
    if (req.file) {
      try {
        const audioResult = await uploadAudio(req.file.buffer, req.user._id.toString(), questionId);
        audioUrl = audioResult.url;
      } catch (uploadError) {
        logger.warn(`Audio upload failed, continuing with transcription: ${uploadError.message}`);
      }

      // Transcribe audio if no text answer provided. STT outages must NOT
      // block a live interview — the candidate already spoke the answer, so
      // we persist the audio and flag the turn for re-transcription rather
      // than failing the whole submission.
      if (!userAnswer) {
        try {
          transcribedAnswer = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype, interview.language);
        } catch (transcriptionError) {
          logger.warn(`${interview.language} audio transcription failed: ${transcriptionError.message}`);
          transcribedAnswer = '';
          transcriptionFailed = true;
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
    let evaluation = { score: null, feedback: '', strengths: [], improvements: [], suggestedAnswer: '', evaluationStatus: 'pending' };
    let nextInterviewerResponse = "Thank you. Let's move on to the next topic.";
    let isFollowUp = false;
    let answeredCandidateQuestion = false;

    if (transcriptionFailed) {
      evaluation.feedback = 'Speech-to-text was unavailable — the audio is stored for re-transcription.';
      evaluation.evaluationStatus = 'transcription_failed';
    } else if (transcribedAnswer && !isPlaceholderAnswer(transcribedAnswer)) {
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
          evaluation = normalizeEvaluation(turnResult.evaluation);
        }

        if (turnResult.nextInterviewerResponse) {
          nextInterviewerResponse = turnResult.nextInterviewerResponse;
        }
        isFollowUp = turnResult.isFollowUp || false;
        answeredCandidateQuestion = Boolean(turnResult.answeredCandidateQuestion);

      } catch (aiError) {
        logger.warn(`AI turn processing failed: ${aiError.message}`);
        evaluation.feedback = 'AI evaluation unavailable. Answer recorded for retry.';
        evaluation.evaluationStatus = 'failed';
      }
    } else {
      evaluation.feedback = 'No substantive answer was provided.';
      evaluation.evaluationStatus = 'invalid';
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
      // Topic is complete — commit final score and mark answered
      question.score = evaluation.evaluationStatus === 'completed' && typeof evaluation.score === 'number'
        ? evaluation.score
        : null;
      question.aiFeedback = evaluation.feedback;
      question.isAnswered = true;
      question.evaluationStatus = evaluation.evaluationStatus;
    } else {
      // Topic is still open (follow-up pending).
      // Save a tentative score so the question always has a value on record;
      // the next successful turn will overwrite it when the topic closes.
      if (evaluation.evaluationStatus === 'completed' && typeof evaluation.score === 'number') {
        question.score = evaluation.score;
        question.aiFeedback = evaluation.feedback;
      }
      question.evaluationStatus = 'pending';
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

    // A topic that entered follow-up mode but never closed can still hold a
    // valid tentative score. Promote it to 'completed' so it counts in the
    // final average instead of silently vanishing.
    const promotableFollowUps = (interview.questions || []).filter((q) =>
      q &&
      q.evaluationStatus === 'pending' &&
      typeof q.score === 'number' &&
      Number.isFinite(q.score) &&
      q.score >= 0 &&
      q.score <= 100 &&
      q.userAnswer &&
      q.userAnswer.trim()
    );
    for (const q of promotableFollowUps) {
      q.evaluationStatus = 'completed';
      q.isAnswered = true;
      await q.save();
    }

    const summary = summarizeEvaluations(interview.questions);
    const overallScore = summary.overallScore;

    // A live company interview with no substantive evaluations at all is not
    // a "candidate scored 0" — it's a platform failure or an abandoned session.
    // Keep the record but tag it so the company dashboard can distinguish.
    if (interview.company && !summary.hasAnyValidScore) {
      interview.completionFlag = 'no_valid_evaluations';
    } else {
      interview.completionFlag = 'ok';
    }

    interview.status = 'completed';
    interview.overallScore = overallScore;
    if (!interview.completedAt) interview.completedAt = new Date();

    // Reassemble the session recording, if the candidate's browser uploaded
    // any chunks during the live interview. Downloading and re-uploading
    // every chunk can be slow for a long/high-chunk-count session — that
    // must not delay the completion response itself (the frontend races a
    // fixed timeout against this call; a slow recording finalize made it
    // more likely to lose that race and land the candidate on a stale
    // "in-progress" state). Kick it off in the background after saving and
    // responding; a recording problem is not the candidate's fault and must
    // not stop their score from being saved or seen.
    const needsRecordingFinalize = requiresRecording(interview) && interview.recordingChunks?.length;
    if (needsRecordingFinalize) {
      interview.recordingStatus = 'processing';
    }

    await interview.save();

    // Propagate the finalized result to the linked Application so the
    // hiring team's dashboard sees the score/status without having to walk
    // the join in the UI. Never blocks completion — a link mismatch or
    // stale row must not roll back the interview record.
    if (interview.company) {
      try {
        const application = await Application.findOne({
          interview: interview._id,
          company: interview.company,
          candidate: interview.user,
        });
        if (application) {
          application.interviewStatus = 'completed';
          application.overallScore = interview.overallScore;
          if (
            application.status === 'interview_scheduled' ||
            application.status === 'applied' ||
            application.status === 'under_review'
          ) {
            application.status = 'interviewed';
          }
          await application.save();
          logger.info(`Application ${application._id} updated with interview ${interview._id} results`);
        } else {
          logger.warn(
            `Interview ${interview._id} completed but no matching Application found (company=${interview.company}, candidate=${interview.user}). Score will not appear in the pipeline until the link is repaired.`
          );
        }
      } catch (linkError) {
        logger.error(`Failed to sync application after interview ${interview._id}: ${linkError.message}`);
      }
    }

    logger.info(`Interview completed: ${interview._id} — score: ${overallScore}`);

    ApiResponse.success(res, { interview }, 'Interview completed');

    if (needsRecordingFinalize) {
      finalizeRecording(interview)
        .then(async ({ url, recovered, expected }) => {
          if (url) {
            if (recovered < expected) {
              logger.warn(`Interview ${interview._id} recording finalized with ${recovered}/${expected} chunks recovered`);
            }
            await Interview.findByIdAndUpdate(interview._id, {
              recordingUrl: url,
              recordingStatus: 'ready',
              recordingChunks: [],
            });
          } else {
            await Interview.findByIdAndUpdate(interview._id, { recordingStatus: 'failed' });
          }
        })
        .catch(async (error) => {
          logger.error(`Failed to finalize recording for interview ${interview._id}: ${error.message}`);
          await Interview.findByIdAndUpdate(interview._id, { recordingStatus: 'failed' }).catch(() => {});
        });
    }
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

    // Company-scheduled live interviews are not personal training records —
    // candidates cannot delete them from their history.
    if (interview.company) {
      return next(ApiError.forbidden('Scheduled interviews cannot be deleted by candidates.'));
    }

    const audioUrls = await Question.find({ interview: interview._id }).distinct('audioUrl');
    const chunkUrls = (interview.recordingChunks || []).map((c) => c.url);
    await deleteBlobUrls([interview.recordingUrl, ...chunkUrls, ...audioUrls]);

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
 * @desc    Retry evaluation of the answer already stored for a question
 * @route   POST /api/v1/interviews/:interviewId/questions/:questionId/evaluate
 * @access  Private
 */
const reevaluateAnswer = async (req, res, next) => {
  try {
    const { interviewId, questionId } = req.params;
    const interview = await Interview.findOne({ _id: interviewId, user: req.user._id });
    if (!interview) return next(ApiError.notFound('Interview not found'));

    const question = await Question.findOne({ _id: questionId, interview: interviewId });
    if (!question) return next(ApiError.notFound('Question not found'));
    if (!question.userAnswer || !question.userAnswer.trim() || isPlaceholderAnswer(question.userAnswer)) {
      question.evaluationStatus = 'invalid';
      question.score = null;
      await question.save();
      return next(ApiError.badRequest('This question has no substantive answer to evaluate'));
    }

    let turnResult;
    try {
      turnResult = await processInterviewTurn(
        [
          { role: 'interviewer', content: question.text },
          { role: 'candidate', content: question.userAnswer },
        ],
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
          candidateAnswer: question.userAnswer,
        }
      );
    } catch (error) {
      question.evaluationStatus = 'failed';
      question.score = null;
      question.aiFeedback = 'AI evaluation is still unavailable. Please retry shortly.';
      await question.save();
      return next(ApiError.serviceUnavailable('AI evaluation is unavailable. Please retry shortly.'));
    }

    const evaluation = turnResult?.evaluation || {};
    if (typeof evaluation.score !== 'number') {
      question.evaluationStatus = 'failed';
      question.score = null;
      question.aiFeedback = evaluation.feedback || 'The model did not return a valid score.';
      await question.save();
      return next(ApiError.serviceUnavailable('The evaluation did not return a valid score. Please retry.'));
    }

    question.score = evaluation.score;
    question.aiFeedback = evaluation.feedback || '';
    question.evaluationStatus = 'completed';
    question.isAnswered = true;
    await question.save();

    if (interview.status === 'completed') {
      const scoredQuestions = await Question.find({
        interview: interview._id,
        isAnswered: true,
        evaluationStatus: 'completed',
        score: { $ne: null },
      }).select('score');
      interview.overallScore = calculateOverallScore(scoredQuestions.map((item) => ({
        isAnswered: true,
        evaluationStatus: 'completed',
        score: item.score,
      })));
      await interview.save();
      await Feedback.deleteMany({ interview: interview._id });
    }

    ApiResponse.success(res, {
      question,
      evaluation: {
        score: evaluation.score,
        feedback: evaluation.feedback || '',
        strengths: evaluation.strengths || [],
        improvements: evaluation.improvements || [],
        suggestedAnswer: evaluation.suggestedAnswer || '',
        evaluationStatus: 'completed',
      },
    }, 'Answer evaluated');
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

    // The Practice Loop lets candidates re-answer for extra feedback — that is
    // strictly a training feature, not something you can do inside a live hire.
    if (interview.company) {
      return next(ApiError.forbidden('Practice retries are not allowed on scheduled interviews.'));
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

    const evaluation = turnResult.evaluation || { score: null, feedback: '', strengths: [], improvements: [], suggestedAnswer: '' };

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

    // Retake is a training-only feature — a live scheduled interview is
    // one-shot and its answers cannot be wiped by the candidate.
    if (interview.company) {
      return next(ApiError.forbidden('Scheduled interviews cannot be reset.'));
    }

    await Feedback.deleteMany({ interview: interview._id });

    const audioUrls = await Question.find({ interview: interview._id }).distinct('audioUrl');
    const chunkUrls = (interview.recordingChunks || []).map((c) => c.url);
    await deleteBlobUrls([interview.recordingUrl, ...chunkUrls, ...audioUrls]);

    await Question.updateMany(
      { interview: interview._id },
      {
        $set: {
          userAnswer: '',
          audioUrl: '',
          score: null,
          evaluationStatus: 'pending',
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
    interview.recordingUrl = '';
    interview.recordingChunks = [];
    interview.recordingStatus = 'none';
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

/**
 * @desc    Receive a proctoring violation event from the client
 * @route   POST /api/v1/interviews/:id/proctoring/event
 * @access  Private
 */
const reportProctoringEvent = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'in-progress',
    });

    if (!interview) {
      return next(ApiError.notFound('Active interview not found'));
    }

    const { type, details, strike } = req.body;

    const validTypes = ['tab_switch', 'window_blur', 'gaze_away', 'face_not_detected'];
    if (!type || !validTypes.includes(type)) {
      return next(ApiError.badRequest(`Invalid violation type. Must be one of: ${validTypes.join(', ')}`));
    }

    if (!interview.proctoring) {
      interview.proctoring = { enabled: true, strikes: 0, integrityScore: 100, violations: [], flaggedForReview: false };
    }

    interview.proctoring.enabled = true;
    interview.proctoring.violations.push({
      type,
      timestamp: new Date(),
      details: String(details || '').slice(0, 500),
      strike: null, // filled in below from the server-computed count
    });

    // Server-side strike accumulation — the client can send a strike hint
    // but we never trust it. A single strike per two same-type violations
    // (rounded up), capped at 3.
    const violations = interview.proctoring.violations || [];
    const groups = {};
    for (const v of violations) {
      groups[v.type] = (groups[v.type] || 0) + 1;
    }
    const computedStrikes = Math.min(
      3,
      Object.values(groups).reduce((sum, n) => sum + Math.ceil(n / 2), 0)
    );
    interview.proctoring.strikes = computedStrikes;
    interview.proctoring.violations[interview.proctoring.violations.length - 1].strike = computedStrikes;

    const totalViolations = violations.length;
    const penalty = Math.min(totalViolations * 2 + computedStrikes * 15, 100);
    interview.proctoring.integrityScore = Math.max(0, 100 - penalty);

    if (computedStrikes >= 3 || interview.proctoring.integrityScore < 40) {
      interview.proctoring.flaggedForReview = true;
    }

    await interview.save();

    logger.info(`Proctoring event for interview ${interview._id}: ${type} (strike ${computedStrikes})`);

    ApiResponse.success(res, {
      strikes: interview.proctoring.strikes,
      integrityScore: interview.proctoring.integrityScore,
      flaggedForReview: interview.proctoring.flaggedForReview,
    }, 'Proctoring event recorded');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInterview,
  warmInterviewServices,
  getWarmupStatus,
  getInterviews,
  getInterview,
  getInterviewProgress,
  retryQuestionGeneration,
  startInterview,
  uploadRecordingChunk,
  submitAnswer,
  completeInterview,
  deleteInterview,
  retryEvaluate,
  reevaluateAnswer,
  resetInterview,
  reportProctoringEvent,
  // Exported for cross-controller pre-generation on the company scheduling
  // path so candidates don't hit a cold RunPod worker on first visit.
  ensureQuestionGeneration,
};
