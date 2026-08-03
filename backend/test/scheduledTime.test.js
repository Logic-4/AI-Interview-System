const test = require('node:test');
const assert = require('node:assert/strict');
const { parseScheduledAt } = require('../utils/scheduledTime');

test('schedules a Somalia datetime-local value in Africa/Mogadishu time', () => {
  const scheduledAt = parseScheduledAt('2026-08-03T14:05', 'Africa/Mogadishu');
  assert.equal(scheduledAt.toISOString(), '2026-08-03T11:05:00.000Z');
});

test('preserves a supplied timestamp with an explicit timezone', () => {
  const scheduledAt = parseScheduledAt('2026-08-03T14:05:00.000Z', 'Africa/Mogadishu');
  assert.equal(scheduledAt.toISOString(), '2026-08-03T14:05:00.000Z');
});

test('rejects invalid scheduled date values', () => {
  assert.equal(parseScheduledAt('2026-02-30T14:05', 'Africa/Mogadishu'), null);
  assert.equal(parseScheduledAt('2026-08-03T24:05', 'Africa/Mogadishu'), null);
});
