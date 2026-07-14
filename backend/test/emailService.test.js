const test = require('node:test');
const assert = require('node:assert/strict');
const { sendEmail } = require('../services/emailService');

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
