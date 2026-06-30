const Interview = require('../models/Interview');
const Question = require('../models/Question');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { parseJobDescription, generateInterviewQuestions, processInterviewTurn } = require('../services/kaggleService');
const { transcribeAudio } = require('../services/somaliSpeechService');
const { uploadAudio } = require('../services/blobService');
const logger = require('../utils/logger');

/**
 * @desc    Create a new interview with AI-generated questions
 * @route   POST /api/v1/interviews
 * @access  Private
 */
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

const createInterview = async (req, res, next) => {
  try {
    const { title, type, difficulty, domain, duration, scheduledAt, jobRole, focusSkills, jobDescription, resumeText, language } = req.body;

    // Create interview
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
    });

    // Parse job description if provided (Step 2)
    let roleProfile = null;
    if (jobDescription && jobDescription.trim()) {
      try {
        roleProfile = await parseJobDescription(jobDescription, jobRole || domain);
        interview.roleProfile = roleProfile;
        await interview.save();
        logger.info(`Job description parsed for interview ${interview._id}`);
      } catch (parseError) {
        logger.warn(`Job description parsing failed, continuing: ${parseError.message}`);
      }
    }

    // Generate AI questions (Step 3)
    const questionCount = Math.max(1, Math.min(Math.floor((duration || 30) / 2.5), 16));
    let aiQuestions = [];

    aiQuestions = await generateInterviewQuestions(type, domain, difficulty, questionCount, {
      jobRole,
      jobDescription,
      resumeText,
      focusSkills,
      roleProfile,
      language: interview.language,
      candidateName: req.user.name,
    });

    // Create question documents
    const questions = await Question.insertMany(
      aiQuestions.map((q, index) => ({
        interview: interview._id,
        text: q.text,
        category: q.category,
        difficulty: toQuestionDifficulty(q.difficulty),
        expectedAnswer: q.expectedAnswer,
        order: index,
      }))
    );

    // Initialize conversation history with a system prompt and the first question
    const conversationHistory = [
      {
        role: 'system',
        content: `Interview started. Role: ${jobRole || domain}. Language: ${interview.language}. Domain: ${domain}.`,
        timestamp: new Date()
      }
    ];

    if (questions.length > 0) {
      conversationHistory.push({
        role: 'interviewer',
        content: questions[0].text,
        timestamp: new Date()
      });
    }

    // Update interview with question references and history
    interview.questions = questions.map((q) => q._id);
    interview.conversationHistory = conversationHistory;
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

    // Ensure the current question's text is in the conversation history.
    // (Only the first question is seeded at creation time — subsequent questions
    //  must be injected here so the AI model has full context of what was asked.)
    const lastInterviewerMsg = [...interview.conversationHistory]
      .reverse()
      .find(m => m.role === 'interviewer');

    if (!lastInterviewerMsg || lastInterviewerMsg.content !== question.text) {
      interview.conversationHistory.push({
        role: 'interviewer',
        content: question.text,
        timestamp: new Date()
      });
    }

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

    if (transcribedAnswer) {
      try {
        const turnResult = await processInterviewTurn(
          interview.conversationHistory, 
          interview.domain, 
          interview.jobRole, 
          interview.language,
          interview.type
        );
        
        if (turnResult.evaluation) {
          evaluation = {
            score: turnResult.evaluation.score || 0,
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

      } catch (aiError) {
        logger.warn(`AI turn processing failed: ${aiError.message}`);
        evaluation.feedback = 'AI evaluation unavailable. Answer recorded for manual review.';
      }
    }

    // Only update the question record when the topic is complete (not a follow-up).
    // During follow-ups (e.g. user asked for clarification), we preserve the original
    // answer and keep the question open for the real answer.
    if (!isFollowUp) {
      // Append follow-up answers to the main answer if there were previous attempts
      if (question.userAnswer && question.userAnswer.trim()) {
        question.userAnswer = question.userAnswer + '\n\n[Follow-up answer]: ' + transcribedAnswer;
      } else {
        question.userAnswer = transcribedAnswer;
      }
      question.audioUrl = audioUrl;
      question.score = typeof evaluation.score === 'number' ? evaluation.score : null;
      question.aiFeedback = evaluation.feedback;
      question.timeSpent = (question.timeSpent || 0) + (timeSpent || 0);
      question.isAnswered = true;
      await question.save();
    }

    // Check if we reached the maximum duration (in minutes) to end interview naturally
    const interviewStartTime = interview.startedAt ? new Date(interview.startedAt).getTime() : new Date().getTime();
    const currentTime = new Date().getTime();
    const elapsedMinutes = (currentTime - interviewStartTime) / 60000;
    
    const timeLimitReached = elapsedMinutes >= (interview.duration || 30);

    // Add the AI's conversational response to history for context tracking
    if (timeLimitReached && !isFollowUp) {
      // Time is up and we just finished a topic — override with wrap-up message
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
      isTimeUp
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

    // Cascade delete: questions, feedback, then the interview itself
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
 * @desc    Retry-evaluate a question answer (Step 7: Practice Loop)
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

    // Verify interview belongs to user
    const interview = await Interview.findOne({
      _id: interviewId,
      user: req.user._id,
    });

    if (!interview) {
      return next(ApiError.notFound('Interview not found'));
    }

    // Find the question
    const question = await Question.findOne({
      _id: questionId,
      interview: interviewId,
    });

    if (!question) {
      return next(ApiError.notFound('Question not found'));
    }

    // Build a minimal conversation history for re-evaluation
    const retryHistory = [
      { role: 'interviewer', content: question.text },
      { role: 'candidate', content: retryAnswer },
    ];

    const turnResult = await processInterviewTurn(
      retryHistory, interview.domain, interview.jobRole, interview.language, interview.type
    );

    const evaluation = turnResult.evaluation || { score: 0, feedback: '', strengths: [], improvements: [], suggestedAnswer: '' };

    // Store retry attempt on the question
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

    // Delete feedback associated with the interview
    await Feedback.deleteMany({ interview: interview._id });

    // Reset all questions linked to this interview
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

    // Re-initialize conversation history with a system prompt and the first question
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

    const populated = await Interview.findById(interview._id).populate('questions');

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
