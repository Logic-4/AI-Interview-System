const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const EXPLICIT_TIME_ZONE = /T.*(?:Z|[+-]\d{2}:?\d{2})$/i;

function zonedPartsAsUtc(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const value = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value: part }) => [type, part]));
  return Date.UTC(value.year, Number(value.month) - 1, value.day, value.hour, value.minute, value.second);
}

/**
 * Converts a date-time entered without an offset into the company's local
 * timezone. datetime-local values intentionally have no timezone, so parsing
 * them directly on a UTC server shifts Somalia appointments by three hours.
 */
function parseScheduledAt(value, timeZone = 'Africa/Mogadishu') {
  if (!value) return null;
  const input = String(value).trim();

  if (EXPLICIT_TIME_ZONE.test(input)) {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = input.match(LOCAL_DATE_TIME);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '0', milliseconds = '0'] = match;
  if (
    Number(month) < 1 || Number(month) > 12 ||
    Number(day) < 1 || Number(day) > 31 ||
    Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
  ) {
    return null;
  }
  const requestedAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(milliseconds.padEnd(3, '0'))
  );
  const requestedDate = new Date(requestedAsUtc);
  if (
    requestedDate.getUTCFullYear() !== Number(year) ||
    requestedDate.getUTCMonth() !== Number(month) - 1 ||
    requestedDate.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  try {
    // Re-evaluate the offset after converting once so this also works for
    // company timezones that observe daylight saving time.
    let timestamp = requestedAsUtc;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      timestamp += requestedAsUtc - zonedPartsAsUtc(timestamp, timeZone);
    }
    return new Date(timestamp);
  } catch {
    return null;
  }
}

module.exports = { parseScheduledAt };
