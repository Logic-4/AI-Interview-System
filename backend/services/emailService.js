const logger = require('../utils/logger');

const sendEmail = async ({ to, subject, html, text }) => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim();
  if (!apiKey || !from) throw new Error('Resend email is not configured');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || `Resend returned HTTP ${response.status}`;
    logger.error(`Email delivery failed: ${message}`);
    throw new Error(message);
  }
  logger.info(`Email delivered to ${to}: ${subject}`);
  return { success: true, messageId: payload.id };
};

const sendVerificationEmail = async (user, verificationToken) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
  return sendEmail({
    to: user.email,
    subject: 'InterviewAI - Verify Your Email',
    html: `<h1>Welcome to InterviewAI!</h1><p>Hi ${user.name},</p><p>Please verify your email:</p><p><a href="${verificationUrl}">Verify Email</a></p>`,
    text: `Verify your email: ${verificationUrl}`,
  });
};

const sendInterviewCompletionEmail = async (user, interview, score) => sendEmail({
  to: user.email,
  subject: `Interview Complete - Score: ${score}/100`,
  html: `<h1>Interview Results</h1><p>Hi ${user.name},</p><p>Your ${interview.type} interview is complete.</p><h2>Overall Score: ${score}/100</h2>`,
  text: `Your interview score: ${score}/100. Log in to see detailed feedback.`,
});

const sendPasswordResetEmail = async (user, resetToken) => {
  const clientUrl = String(process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim();
  const resetUrl = `${clientUrl}/reset-password/${resetToken}`;
  return sendEmail({
    to: user.email,
    subject: 'InterviewAI - Password Reset Request',
    html: `<h1>Password Reset</h1><p>Hi ${user.name},</p><p>You requested a password reset.</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link expires in one hour.</p>`,
    text: `Reset your password: ${resetUrl}\nThis link expires in one hour.`,
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendInterviewCompletionEmail,
  sendPasswordResetEmail,
};
