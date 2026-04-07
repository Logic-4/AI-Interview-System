const Interview = require('../models/Interview');
const Question = require('../models/Question');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateInterviewQuestions, evaluateAnswer, transcribeAudio } = require('../services/openaiService');
const { uploadAudio } = require('../services/cloudinaryService');
const logger = require('../utils/logger');

/**
 * @desc    Create a new interview with AI-generated questions
 * @route   POST /api/v1/interviews
 * @access  Private
 */
const createInterview = async (req, res, next) => {
  try {
    const { title, type, difficulty, domain, duration, scheduledAt } = req.body;

    // Create interview
    const interview = await Interview.create({
      user: req.user._id,
      title,
      type,
      difficulty,
      domain,
      duration: duration || 30,
      scheduledAt: scheduledAt || new Date(),
    });

    // Generate AI questions
    const questionCount = Math.min(Math.floor((duration || 30) / 5), 10);
    let aiQuestions = [];

    try {
      aiQuestions = await generateInterviewQuestions(type, domain, difficulty, questionCount);
    } catch (aiError) {
      logger.warn(`AI question generation failed, using fallback: ${aiError.message}`);
      // Fallback: create placeholder questions
      aiQuestions = Array.from({ length: questionCount }, (_, i) => ({
        text: `${type} question ${i + 1} for ${domain} at ${difficulty} level`,
        category: type,
        difficulty: 'medium',
        expectedAnswer: 'AI-generated answer will be available when OpenAI API is configured.',
      }));
    }

    // Create question documents
    const questions = await Question.insertMany(
      aiQuestions.map((q, index) => ({
        interview: interview._id,
        text: q.text,
        category: q.category,
        difficulty: q.difficulty,
        expectedAnswer: q.expectedAnswer,
        order: index,
      }))
    );

    // Update interview with question references
    interview.questions = questions.map((q) => q._id);
    await interview.save();

    // Increment user's interview count
    await User.findByIdAndUpdate(req.user._id, { $inc: { interviewCount: 1 } });

    // Populate for response
    const populatedInterview = await Interview.findById(interview._id).populate('questions');

    logger.info(`Interview created: ${interview._id} by user ${req.user._id}`);

    ApiResponse.created(res, { interview: populatedInterview }, 'Interview created with AI-generated questions');
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
      .populate('questions')
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

    if (interview.status !== 'scheduled') {
      return next(ApiError.badRequest(`Cannot start interview with status '${interview.status}'`));
    }

    interview.status = 'in-progress';
    await interview.save();

    const populated = await Interview.findById(interview._id).populate('questions');

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
    const { userAnswer, timeSpent } = req.body;

    // Verify interview belongs to user
    const interview = await Interview.findOne({
      _id: interviewId,
      user: req.user._id,
      status: 'in-progress',
    });

    if (!interview) {
      return next(ApiError.notFound('Active interview not found'));
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

        // Transcribe audio if no text answer provided
        if (!userAnswer) {
          transcribedAnswer = await transcribeAudio(req.file.buffer, req.file.originalname);
        }
      } catch (uploadError) {
        logger.warn(`Audio processing failed: ${uploadError.message}`);
      }
    }

    // Evaluate answer with AI
    let evaluation = { score: 0, feedback: '' };
    if (transcribedAnswer) {
      try {
        evaluation = await evaluateAnswer(question.text, question.expectedAnswer, transcribedAnswer);
      } catch (aiError) {
        logger.warn(`AI evaluation failed: ${aiError.message}`);
        evaluation = {
          score: 0,
          feedback: 'AI evaluation unavailable. Answer recorded for manual review.',
        };
      }
    }

    // Update question
    question.userAnswer = transcribedAnswer;
    question.audioUrl = audioUrl;
    question.score = evaluation.score;
    question.aiFeedback = evaluation.feedback;
    question.timeSpent = timeSpent || 0;
    question.isAnswered = true;
    await question.save();

    ApiResponse.success(res, {
      question,
      evaluation,
    }, 'Answer submitted and evaluated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete an interview
 * @route   PUT /api/v1/interviews/:id/complete
 * @access  Private
 */
const completeInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate('questions');

    if (!interview) {
      return next(ApiError.notFound('Interview not found'));
    }

    if (interview.status !== 'in-progress') {
      return next(ApiError.badRequest('Interview is not in progress'));
    }

    // Calculate overall score from question scores
    const answeredQuestions = interview.questions.filter((q) => q.isAnswered);
    const overallScore = answeredQuestions.length > 0
      ? Math.round(answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0) / answeredQuestions.length)
      : 0;

    interview.status = 'completed';
    interview.overallScore = overallScore;
    await interview.save();

    logger.info(`Interview completed: ${interview._id} — score: ${overallScore}`);

    ApiResponse.success(res, { interview }, 'Interview completed');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an interview (soft delete)
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

    interview.isDeleted = true;
    await interview.save();

    ApiResponse.success(res, null, 'Interview deleted');
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
};
