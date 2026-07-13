const crypto = require('crypto');
const logger = require('../utils/logger');

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

function requestContext(req, res, next) {
  const incoming = String(req.get('x-request-id') || '').trim();
  const requestId = SAFE_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  req.requestId = requestId;
  req.startedAt = startedAt;
  req.serverTimings = [];
  req.addServerTiming = (name, durationMs, description = '') => {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    const safeName = String(name).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48);
    const safeDescription = String(description).replace(/["\\]/g, '').slice(0, 80);
    req.serverTimings.push({ name: safeName, durationMs, description: safeDescription });
  };

  res.setHeader('X-Request-ID', requestId);
  res.on('finish', () => {
    const totalMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    req.addServerTiming('total', totalMs);
    if (!res.headersSent) return;
    logger.info(JSON.stringify({
      event: 'request_complete',
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      totalMs: Number(totalMs.toFixed(1)),
      stages: req.serverTimings.map((entry) => ({
        name: entry.name,
        durationMs: Number(entry.durationMs.toFixed(1)),
      })),
    }));
  });

  const originalWriteHead = res.writeHead;
  res.writeHead = function writeHeadWithTiming(...args) {
    if (req.serverTimings.length && !res.hasHeader('Server-Timing')) {
      const value = req.serverTimings
        .map(({ name, durationMs, description }) => {
          const desc = description ? `;desc="${description}"` : '';
          return `${name};dur=${durationMs.toFixed(1)}${desc}`;
        })
        .join(', ');
      res.setHeader('Server-Timing', value);
    }
    return originalWriteHead.apply(this, args);
  };

  logger.info(JSON.stringify({
    event: 'request_received',
    requestId,
    method: req.method,
    path: req.originalUrl,
  }));
  next();
}

function stageTimer(req, name, description = '') {
  const startedAt = process.hrtime.bigint();
  return () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    req?.addServerTiming?.(name, durationMs, description);
    return durationMs;
  };
}

module.exports = { requestContext, stageTimer };
