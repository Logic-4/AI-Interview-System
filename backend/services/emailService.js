const logger = require('../utils/logger');

/**
 * Email service placeholder
 * In production, integrate with SendGrid, Mailgun, or AWS SES
 */

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    // TODO: Integrate with email provider (SendGrid, Mailgun, etc.)
    logger.info(`📧 Email sent to ${to}: ${subject}`);

    // Placeholder — log email in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Email body: ${text || html}`);
    }

    return { success: true, messageId: `dev_${Date.now()}` };
  } catch (error) {
    logger.error(`Email send failed: ${error.message}`);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

const sendVerificationEmail = async (user, verificationToken) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

  return sendEmail({
    to: user.email,
    subject: 'InterviewAI Pro — Verify Your Email',
    html: `
      <h1>Welcome to InterviewAI Pro!</h1>
      <p>Hi ${user.name},</p>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verificationUrl}" style="padding: 10px 20px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    `,
    text: `Verify your email: ${verificationUrl}`,
  });
};

const sendInterviewCompletionEmail = async (user, interview, score) => {
  return sendEmail({
    to: user.email,
    subject: `Interview Complete — Score: ${score}/100`,
    html: `
      <h1>Interview Results</h1>
      <p>Hi ${user.name},</p>
      <p>Your ${interview.type} interview for ${interview.domain} has been completed.</p>
      <h2>Overall Score: ${score}/100</h2>
      <p>Log in to see your detailed feedback and recommendations.</p>
    `,
    text: `Your interview score: ${score}/100. Log in to see detailed feedback.`,
  });
};

const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

  return sendEmail({
    to: user.email,
    subject: 'InterviewAI — Password Reset Request',
    html: `
      <h1>Password Reset</h1>
      <p>Hi ${user.name},</p>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a>
      <p style="margin-top:16px;color:#666;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      <p style="margin-top:24px;font-size:12px;color:#999;">Reset URL: ${resetUrl}</p>
    `,
    text: `Reset your password: ${resetUrl}\nThis link expires in 1 hour.`,
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendInterviewCompletionEmail,
  sendPasswordResetEmail,
};
