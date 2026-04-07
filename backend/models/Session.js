const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: [true, 'Interview reference is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    socketId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'disconnected'],
      default: 'active',
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    disconnectedAt: {
      type: Date,
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
    },
    events: [
      {
        type: {
          type: String,
          required: true,
        },
        data: {
          type: mongoose.Schema.Types.Mixed,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    metadata: {
      userAgent: String,
      ipAddress: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
sessionSchema.index({ interview: 1, user: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ socketId: 1 });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
