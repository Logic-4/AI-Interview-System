const Feedback = require('../models/Feedback');
const Interview = require('../models/Interview');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateComprehensiveFeedback } = require('../services/openaiService');
const logger = require('../utils/logger');

/**
 * @desc    Get feedback for a specific interview
 * @route   GET /api/v1/feedback/:interviewId
 * @access  Private
 */
const getFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findOne({
      interview: req.params.interviewId,
      user: req.user._id,
    }).populate('interview', 'title type domain difficulty status overallScore');

    if (!feedback) {
      return next(ApiError.notFound('Feedback not found for this interview'));
    }

    ApiResponse.success(res, { feedback });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate AI feedback for a completed interview
 * @route   POST /api/v1/feedback/:interviewId/generate
 * @access  Private
 */
const generateFeedback = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.interviewId,
      user: req.user._id,
      status: 'completed',
    }).populate('questions');

    if (!interview) {
      return next(ApiError.notFound('Completed interview not found'));
    }

    // Check if feedback already exists
    const existingFeedback = await Feedback.findOne({ interview: interview._id });
    if (existingFeedback) {
      return ApiResponse.success(res, { feedback: existingFeedback }, 'Feedback already exists');
    }

    // Generate comprehensive AI feedback
    let aiFeedback;
    try {
      aiFeedback = await generateComprehensiveFeedback(interview);
    } catch (aiError) {
      logger.warn(`AI feedback generation failed: ${aiError.message}`);
      // Fallback feedback
      aiFeedback = {
        overallScore: interview.overallScore || 0,
        categories: {
          communication: { score: 0, feedback: 'AI feedback unavailable' },
          technicalAccuracy: { score: 0, feedback: 'AI feedback unavailable' },
          problemSolving: { score: 0, feedback: 'AI feedback unavailable' },
          codeQuality: { score: 0, feedback: 'AI feedback unavailable' },
          confidence: { score: 0, feedback: 'AI feedback unavailable' },
        },
        strengths: ['Completed the interview'],
        improvements: ['AI feedback will be available when OpenAI API is configured'],
        detailedFeedback: 'Comprehensive AI feedback is unavailable at this time.',
        recommendations: ['Retry feedback generation once API is configured'],
      };
    }

    // Create feedback document
    const feedback = await Feedback.create({
      interview: interview._id,
      user: req.user._id,
      overallScore: aiFeedback.overallScore,
      categories: aiFeedback.categories,
      strengths: aiFeedback.strengths,
      improvements: aiFeedback.improvements,
      detailedFeedback: aiFeedback.detailedFeedback,
      recommendations: aiFeedback.recommendations,
    });

    // Update interview with overall score
    interview.overallScore = aiFeedback.overallScore;
    await interview.save();

    logger.info(`Feedback generated for interview ${interview._id}`);

    ApiResponse.created(res, { feedback }, 'AI feedback generated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user progress over time
 * @route   GET /api/v1/feedback/progress
 * @access  Private
 */
const getUserProgress = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { period = '30d' } = req.query;

    // Calculate date range
    const periodMap = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
    const days = periodMap[period] || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Aggregate progress data
    const progress = await Feedback.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $sort: { createdAt: 1 },
      },
      {
        $project: {
          overallScore: 1,
          'categories.communication.score': 1,
          'categories.technicalAccuracy.score': 1,
          'categories.problemSolving.score': 1,
          'categories.codeQuality.score': 1,
          'categories.confidence.score': 1,
          createdAt: 1,
        },
      },
    ]);

    // Calculate averages per category
    const categoryAverages = await Feedback.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          avgOverall: { $avg: '$overallScore' },
          avgCommunication: { $avg: '$categories.communication.score' },
          avgTechnical: { $avg: '$categories.technicalAccuracy.score' },
          avgProblemSolving: { $avg: '$categories.problemSolving.score' },
          avgCodeQuality: { $avg: '$categories.codeQuality.score' },
          avgConfidence: { $avg: '$categories.confidence.score' },
          count: { $sum: 1 },
        },
      },
    ]);

    const averages = categoryAverages[0] || {};

    ApiResponse.success(res, {
      period,
      timeline: progress,
      averages: {
        overall: Math.round(averages.avgOverall || 0),
        communication: Math.round(averages.avgCommunication || 0),
        technicalAccuracy: Math.round(averages.avgTechnical || 0),
        problemSolving: Math.round(averages.avgProblemSolving || 0),
        codeQuality: Math.round(averages.avgCodeQuality || 0),
        confidence: Math.round(averages.avgConfidence || 0),
      },
      totalInterviewsReviewed: averages.count || 0,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFeedback,
  generateFeedback,
  getUserProgress,
};
