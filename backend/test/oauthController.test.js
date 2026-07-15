const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GOOGLE_CLIENT_ID = 'client-id';
process.env.CLIENT_URL = 'https://www.interviewsystem.app';
const { googleRedirect } = require('../controllers/oauthController');

test('Google redirect accepts a valid login hint', () => {
  let location;
  googleRedirect({ query: { login_hint: 'amina@example.com' } }, { redirect: (value) => { location = value; } });
  const url = new URL(location);
  assert.equal(url.searchParams.get('login_hint'), 'amina@example.com');
  assert.equal(url.searchParams.get('prompt'), 'select_account');
});

test('Google redirect ignores an invalid login hint', () => {
  let location;
  googleRedirect({ query: { login_hint: 'not-an-email<script>' } }, { redirect: (value) => { location = value; } });
  assert.equal(new URL(location).searchParams.has('login_hint'), false);
});
