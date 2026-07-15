const test = require('node:test');
const assert = require('node:assert/strict');
const { sendEmail, sendPasswordResetEmail, sendGoogleSignInHelpEmail } = require('../services/emailService');

test('email service fails closed when Resend is not configured', async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  await assert.rejects(() => sendEmail({ to: 'user@example.com', subject: 'Test', text: 'Hello' }), /not configured/);
  if (previousKey) process.env.RESEND_API_KEY = previousKey;
  if (previousFrom) process.env.EMAIL_FROM = previousFrom;
});

test('email service sends through the Resend API', async () => {
  const originalFetch = global.fetch;
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  process.env.RESEND_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'InterviewAI <noreply@example.com>';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ id: 'email_123' }) };
  };

  try {
    const result = await sendEmail({ to: 'user@example.com', subject: 'Test', html: '<p>Hello</p>' });
    assert.equal(result.messageId, 'email_123');
    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.match(request.options.headers.Authorization, /test-key/);
    assert.equal(JSON.parse(request.options.body).to[0], 'user@example.com');
  } finally {
    global.fetch = originalFetch;
    if (previousKey) process.env.RESEND_API_KEY = previousKey; else delete process.env.RESEND_API_KEY;
    if (previousFrom) process.env.EMAIL_FROM = previousFrom; else delete process.env.EMAIL_FROM;
  }
});

test('password reset email is branded, escaped, and includes text fallback', async () => {
  const originalFetch = global.fetch;
  const previous = {
    key: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
    client: process.env.CLIENT_URL,
    logo: process.env.EMAIL_LOGO_URL,
  };
  process.env.RESEND_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'InterviewAI <noreply@example.com>';
  process.env.CLIENT_URL = 'https://www.interviewsystem.app';
  process.env.EMAIL_LOGO_URL = 'https://www.interviewsystem.app/ai-interview-logo.svg';
  let payload;
  global.fetch = async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ id: 'reset_123' }) }; };
  try {
    await sendPasswordResetEmail({ name: '<Amina>', email: 'amina@example.com' }, 'reset-token');
    assert.match(payload.html, /ai-interview-logo\.svg/);
    assert.match(payload.html, /#EE4264/);
    assert.match(payload.html, /Reset password/);
    assert.match(payload.html, /&lt;Amina&gt;/);
    assert.match(payload.html, /expires in one hour/i);
    assert.match(payload.html, /Help and support/);
    assert.match(payload.text, /reset-password\/reset-token/);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      const envKey = { key: 'RESEND_API_KEY', from: 'EMAIL_FROM', client: 'CLIENT_URL', logo: 'EMAIL_LOGO_URL' }[key];
      if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value;
    }
  }
});

test('Google sign-in help email uses the branded template', async () => {
  const originalFetch = global.fetch;
  process.env.RESEND_API_KEY = 'test-key';
  process.env.EMAIL_FROM = 'InterviewAI <noreply@example.com>';
  let payload;
  global.fetch = async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ id: 'google_123' }) }; };
  try {
    await sendGoogleSignInHelpEmail({ name: 'Amina', email: 'amina@example.com' });
    assert.equal(payload.subject, 'InterviewAI - Continue with Google');
    assert.match(payload.html, /Continue with Google/);
    assert.match(payload.text, /uses Google sign-in/);
  } finally {
    global.fetch = originalFetch;
  }
});
