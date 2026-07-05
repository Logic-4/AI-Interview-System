const QuestionBank = require('../models/QuestionBank');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateInterviewQuestions } = require('../services/gemmaService');
const logger = require('../utils/logger');

/**
 * @desc    Create a question in the bank
 * @route   POST /api/v1/questions
 * @access  Private/Admin
 */
const createQuestion = async (req, res, next) => {
  try {
    const question = await QuestionBank.create({
      ...req.body,
      createdBy: req.user._id,
    });

    ApiResponse.created(res, { question }, 'Question added to bank');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all questions from the bank
 * @route   GET /api/v1/questions
 * @access  Private
 */
const getQuestions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };
    if (req.query.domain) filter.domain = req.query.domain;
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.category) filter.category = { $regex: req.query.category, $options: 'i' };
    if (req.query.search) {
      filter.text = { $regex: req.query.search, $options: 'i' };
    }

    const [questions, total] = await Promise.all([
      QuestionBank.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email'),
      QuestionBank.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, questions, {
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
 * @desc    Get single question from bank
 * @route   GET /api/v1/questions/:id
 * @access  Private
 */
const getQuestion = async (req, res, next) => {
  try {
    const question = await QuestionBank.findById(req.params.id).populate('createdBy', 'name email');

    if (!question) {
      return next(ApiError.notFound('Question not found'));
    }

    ApiResponse.success(res, { question });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a question
 * @route   PUT /api/v1/questions/:id
 * @access  Private/Admin
 */
const updateQuestion = async (req, res, next) => {
  try {
    const allowedFields = ['text', 'category', 'domain', 'difficulty', 'type', 'sampleAnswer', 'tags', 'isActive'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const question = await QuestionBank.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!question) {
      return next(ApiError.notFound('Question not found'));
    }

    ApiResponse.success(res, { question }, 'Question updated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a question from bank
 * @route   DELETE /api/v1/questions/:id
 * @access  Private/Admin
 */
const deleteQuestion = async (req, res, next) => {
  try {
    const question = await QuestionBank.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!question) {
      return next(ApiError.notFound('Question not found'));
    }

    ApiResponse.success(res, null, 'Question removed from bank');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate questions using AI and add to bank
 * @route   POST /api/v1/questions/generate
 * @access  Private/Admin
 */
const generateQuestions = async (req, res, next) => {
  try {
    const { type, domain, difficulty, count = 5 } = req.body;

    let aiQuestions;
    try {
      aiQuestions = await generateInterviewQuestions(type, domain, difficulty, count, { jobRole: req.body.jobRole });
    } catch (aiError) {
      logger.warn(`AI question generation failed: ${aiError.message}`);
      return next(ApiError.badRequest('AI question generation failed. Please try again or add questions manually.'));
    }

    const questions = await QuestionBank.insertMany(
      aiQuestions.map((q) => ({
        text: q.text,
        category: q.category,
        domain,
        difficulty: q.difficulty,
        type,
        sampleAnswer: q.expectedAnswer,
        createdBy: req.user._id,
      }))
    );

    logger.info(`${questions.length} questions generated and added to bank`);

    ApiResponse.created(res, { questions, count: questions.length }, 'Questions generated and added to bank');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQuestion,
  getQuestions,
  getQuestion,
  updateQuestion,
  deleteQuestion,
  generateQuestions,
};
