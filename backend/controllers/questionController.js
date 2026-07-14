const QuestionBank = require('../models/QuestionBank');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

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

module.exports = {
  getQuestions,
  getQuestion,
};
