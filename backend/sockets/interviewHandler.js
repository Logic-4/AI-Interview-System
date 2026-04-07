const Session = require('../models/Session');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const logger = require('../utils/logger');

/**
 * Handle live interview session socket events
 * @param {Server} io - Socket.io server instance
 */
const registerInterviewHandlers = (io) => {
  const interviewNamespace = io.of('/interview');

  interviewNamespace.on('connection', (socket) => {
    logger.info(`🔌 Interview socket connected: ${socket.id} (user: ${socket.userId})`);

    /**
     * Join an interview session
     */
    socket.on('join-session', async (data) => {
      try {
        const { interviewId } = data;

        // Verify interview belongs to user
        const interview = await Interview.findOne({
          _id: interviewId,
          user: socket.userId,
        }).populate('questions');

        if (!interview) {
          socket.emit('error', { message: 'Interview not found' });
          return;
        }

        // Create session record
        const session = await Session.create({
          interview: interviewId,
          user: socket.userId,
          socketId: socket.id,
          status: 'active',
          events: [{ type: 'joined', data: { interviewId }, timestamp: new Date() }],
        });

        // Join socket room
        socket.join(`interview:${interviewId}`);
        socket.interviewId = interviewId;
        socket.sessionId = session._id;

        socket.emit('session-joined', {
          sessionId: session._id,
          interview,
          currentQuestionIndex: 0,
        });

        logger.info(`User ${socket.userId} joined interview ${interviewId}`);
      } catch (error) {
        logger.error(`Join session error: ${error.message}`);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    /**
     * Move to next question
     */
    socket.on('next-question', async (data) => {
      try {
        const { questionIndex } = data;

        if (socket.sessionId) {
          await Session.findByIdAndUpdate(socket.sessionId, {
            currentQuestionIndex: questionIndex,
            $push: {
              events: {
                type: 'next-question',
                data: { questionIndex },
                timestamp: new Date(),
              },
            },
          });
        }

        socket.emit('question-changed', { questionIndex });
      } catch (error) {
        logger.error(`Next question error: ${error.message}`);
        socket.emit('error', { message: 'Failed to change question' });
      }
    });

    /**
     * Submit an answer in real-time
     */
    socket.on('submit-answer', async (data) => {
      try {
        const { questionId, answer, timeSpent } = data;

        const question = await Question.findById(questionId);
        if (question) {
          question.userAnswer = answer;
          question.timeSpent = timeSpent || 0;
          question.isAnswered = true;
          await question.save();

          // Log event
          if (socket.sessionId) {
            await Session.findByIdAndUpdate(socket.sessionId, {
              $push: {
                events: {
                  type: 'answer-submitted',
                  data: { questionId, timeSpent },
                  timestamp: new Date(),
                },
              },
            });
          }

          socket.emit('answer-received', {
            questionId,
            status: 'saved',
          });
        }
      } catch (error) {
        logger.error(`Submit answer error: ${error.message}`);
        socket.emit('error', { message: 'Failed to submit answer' });
      }
    });

    /**
     * Timer tick — keep server aware of elapsed time
     */
    socket.on('timer-tick', async (data) => {
      const { elapsed, remaining } = data;

      // Broadcast to room (for potential observers)
      if (socket.interviewId) {
        socket.to(`interview:${socket.interviewId}`).emit('timer-update', {
          elapsed,
          remaining,
        });
      }

      // Auto-complete if time runs out
      if (remaining <= 0) {
        socket.emit('time-expired');
      }
    });

    /**
     * Complete the interview session
     */
    socket.on('interview-complete', async () => {
      try {
        if (socket.interviewId) {
          const interview = await Interview.findById(socket.interviewId).populate('questions');

          if (interview && interview.status === 'in-progress') {
            // Calculate score
            const answered = interview.questions.filter((q) => q.isAnswered);
            const avgScore = answered.length > 0
              ? Math.round(answered.reduce((s, q) => s + (q.score || 0), 0) / answered.length)
              : 0;

            interview.status = 'completed';
            interview.overallScore = avgScore;
            await interview.save();
          }

          // Update session
          if (socket.sessionId) {
            await Session.findByIdAndUpdate(socket.sessionId, {
              status: 'completed',
              disconnectedAt: new Date(),
              $push: {
                events: {
                  type: 'completed',
                  data: {},
                  timestamp: new Date(),
                },
              },
            });
          }

          socket.emit('interview-completed', {
            interviewId: socket.interviewId,
            status: 'completed',
          });

          socket.leave(`interview:${socket.interviewId}`);
          logger.info(`Interview ${socket.interviewId} completed via socket`);
        }
      } catch (error) {
        logger.error(`Interview complete error: ${error.message}`);
        socket.emit('error', { message: 'Failed to complete interview' });
      }
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', async (reason) => {
      logger.info(`🔌 Socket disconnected: ${socket.id} — reason: ${reason}`);

      try {
        if (socket.sessionId) {
          await Session.findByIdAndUpdate(socket.sessionId, {
            status: 'disconnected',
            disconnectedAt: new Date(),
            $push: {
              events: {
                type: 'disconnected',
                data: { reason },
                timestamp: new Date(),
              },
            },
          });
        }
      } catch (error) {
        logger.error(`Disconnect handler error: ${error.message}`);
      }
    });
  });
};

module.exports = { registerInterviewHandlers };
