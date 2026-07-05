function parsePiperPort(baseUrl, fallback = 5001) {
  if (!baseUrl || !String(baseUrl).trim()) return fallback;
  try {
    const url = new URL(String(baseUrl).trim());
    if (url.port) return parseInt(url.port, 10);
    return url.protocol === 'https:' ? 443 : 80;
  } catch {
    return fallback;
  }
}

function getPiperSettings() {
  const baseUrl = (process.env.PIPER_BASE_URL || 'http://localhost:5001').trim().replace(/\/+$/, '');
  const port = parsePiperPort(baseUrl, 5001);
  const voice = (
    process.env.PIPER_VOICE
    || process.env.PIPER_EN_VOICE
    || 'en_US-lessac-medium'
  ).trim() || 'en_US-lessac-medium';
  const python = (process.env.PIPER_PYTHON || 'python').trim();
  const autoStart = process.env.PIPER_AUTO_START === 'true';

  return { baseUrl, port, voice, python, autoStart };
}

module.exports = { parsePiperPort, getPiperSettings };
