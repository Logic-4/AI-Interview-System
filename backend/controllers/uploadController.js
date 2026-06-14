const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { uploadRecording, uploadAudio, uploadAvatar } = require('../services/blobService');

/**
 * @desc    Upload an interview recording
 * @route   POST /api/v1/uploads/recording/:interviewId
 * @access  Private
 */
const uploadInterviewRecording = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(ApiError.badRequest('Please upload a video/audio file'));
    }

    const result = await uploadRecording(
      req.file.buffer,
      req.user._id.toString(),
      req.params.interviewId
    );

    ApiResponse.success(res, { recording: result }, 'Recording uploaded');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload an audio answer
 * @route   POST /api/v1/uploads/audio/:questionId
 * @access  Private
 */
const uploadAudioAnswer = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(ApiError.badRequest('Please upload an audio file'));
    }

    const result = await uploadAudio(
      req.file.buffer,
      req.user._id.toString(),
      req.params.questionId
    );

    ApiResponse.success(res, { audio: result }, 'Audio uploaded');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload user avatar
 * @route   POST /api/v1/uploads/avatar
 * @access  Private
 */
const uploadUserAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(ApiError.badRequest('Please upload an image file'));
    }

    const result = await uploadAvatar(req.file.buffer, req.user._id.toString());

    ApiResponse.success(res, { avatar: result }, 'Avatar uploaded');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadInterviewRecording,
  uploadAudioAnswer,
  uploadUserAvatar,
};
