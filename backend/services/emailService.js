const logger = require('../utils/logger');

const DEFAULT_CLIENT_URL = 'http://localhost:3000';
const BRAND_PRIMARY = '#EE4264';
const BRAND_DARK = '#2F3446';

function getClientUrl() {
  return String(process.env.CLIENT_URL || DEFAULT_CLIENT_URL).split(',')[0].trim().replace(/\/$/, '');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getBrandConfig() {
  const clientUrl = getClientUrl();
  return {
    clientUrl,
    logoUrl: String(process.env.EMAIL_LOGO_URL || `${clientUrl}/ai-interview-logo.svg`).trim(),
    supportUrl: String(process.env.EMAIL_SUPPORT_URL || `${clientUrl}/contact`).trim(),
    supportEmail: String(process.env.EMAIL_SUPPORT_EMAIL || 'support@interviewsystem.app').trim(),
  };
}

function renderEmailLayout({ title, preheader, greeting, body, ctaLabel, ctaUrl, footerNote = '' }) {
  const brand = getBrandConfig();
  const safeCtaUrl = escapeHtml(ctaUrl);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f7f8fc;color:${BRAND_DARK};font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f8fc;padding:32px 12px;">
<tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e8ecf2;border-radius:18px;overflow:hidden;">
<tr><td style="height:7px;background:linear-gradient(90deg,${BRAND_PRIMARY},${BRAND_DARK});font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 34px 12px;text-align:center;"><img src="${escapeHtml(brand.logoUrl)}" width="72" height="72" alt="InterviewAI" style="display:inline-block;width:72px;height:72px;object-fit:contain;"></td></tr>
<tr><td style="padding:0 34px 34px;"><h1 style="margin:8px 0 18px;text-align:center;font-size:26px;line-height:1.25;color:${BRAND_DARK};">${escapeHtml(title)}</h1>
<p style="margin:0 0 18px;font-size:16px;line-height:1.6;">${greeting}</p>
${body}
${ctaLabel && ctaUrl ? `<p style="margin:28px 0;text-align:center;"><a href="${safeCtaUrl}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 26px;font-size:15px;font-weight:bold;">${escapeHtml(ctaLabel)}</a></p>` : ''}
<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#697386;">${footerNote}</p></td></tr>
<tr><td style="padding:22px 34px;background:#fafafa;border-top:1px solid #e8ecf2;text-align:center;color:#697386;font-size:12px;line-height:1.7;">InterviewAI &middot; <a href="${escapeHtml(brand.clientUrl)}" style="color:${BRAND_PRIMARY};">Visit website</a><br><a href="${escapeHtml(brand.supportUrl)}" style="color:${BRAND_PRIMARY};">Help and support</a> &middot; ${escapeHtml(brand.supportEmail)}</td></tr>
</table></td></tr></table></body></html>`;
}

const sendEmail = async ({ to, subject, html, text }) => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim();
  if (!apiKey || !from) throw new Error('Resend email is not configured');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
  const verificationUrl = `${getClientUrl()}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  return sendEmail({
    to: user.email,
    subject: 'InterviewAI - Verify Your Email',
    html: renderEmailLayout({
      title: 'Verify your email', preheader: 'Complete your InterviewAI account setup.',
      greeting: `Hi ${escapeHtml(user.name)},`,
      body: '<p style="margin:0;font-size:16px;line-height:1.6;">Please verify your email address to finish setting up your InterviewAI account.</p>',
      ctaLabel: 'Verify email', ctaUrl: verificationUrl,
      footerNote: 'If you did not create this account, you can safely ignore this message.',
    }),
    text: `Verify your InterviewAI email: ${verificationUrl}`,
  });
};

const sendInterviewCompletionEmail = async (user, interview, score) => sendEmail({
  to: user.email, subject: `Interview Complete - Score: ${score}/100`,
  html: renderEmailLayout({ title: 'Interview complete', preheader: `Your interview score is ${score}/100.`, greeting: `Hi ${escapeHtml(user.name)},`, body: `<p style="margin:0;font-size:16px;line-height:1.6;">Your ${escapeHtml(interview.type)} interview is complete.</p><p style="font-size:28px;font-weight:bold;color:${BRAND_PRIMARY};">${escapeHtml(score)}/100</p>`, footerNote: 'Sign in to InterviewAI to review your detailed feedback.' }),
  text: `Your interview score: ${score}/100. Log in to see detailed feedback.`,
});

const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${getClientUrl()}/reset-password/${encodeURIComponent(resetToken)}`;
  return sendEmail({
    to: user.email,
    subject: 'InterviewAI - Reset your password',
    html: renderEmailLayout({
      title: 'Reset your password', preheader: 'Use this secure link to choose a new InterviewAI password.',
      greeting: `Hi ${escapeHtml(user.name)},`,
      body: '<p style="margin:0;font-size:16px;line-height:1.6;">We received a request to reset the password for your InterviewAI account. Choose a new password using the button below.</p><p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#697386;">This link expires in one hour and can be used only once.</p>',
      ctaLabel: 'Reset password', ctaUrl: resetUrl,
      footerNote: 'If you did not request this change, no action is required. Your password will remain unchanged. For help, contact support.',
    }),
    text: `Hi ${user.name},\n\nReset your InterviewAI password: ${resetUrl}\n\nThis link expires in one hour and can be used only once. If you did not request this change, ignore this email.`,
  });
};

const sendGoogleSignInHelpEmail = async (user) => {
  const googleUrl = `${getClientUrl()}/login`;
  return sendEmail({
    to: user.email,
    subject: 'InterviewAI - Continue with Google',
    html: renderEmailLayout({
      title: 'Continue with Google', preheader: 'Your InterviewAI account uses Google sign-in.',
      greeting: `Hi ${escapeHtml(user.name)},`,
      body: '<p style="margin:0;font-size:16px;line-height:1.6;">Your InterviewAI account is connected to Google, so it does not have a separate InterviewAI password.</p><p style="margin:18px 0 0;font-size:16px;line-height:1.6;">Use the button below to sign in securely with Google.</p>',
      ctaLabel: 'Continue with Google', ctaUrl: googleUrl,
      footerNote: 'If you did not request this message, you can safely ignore it.',
    }),
    text: `Hi ${user.name},\n\nYour InterviewAI account uses Google sign-in. Continue with Google here: ${googleUrl}`,
  });
};

module.exports = { sendEmail, sendVerificationEmail, sendInterviewCompletionEmail, sendPasswordResetEmail, sendGoogleSignInHelpEmail, escapeHtml, renderEmailLayout };
